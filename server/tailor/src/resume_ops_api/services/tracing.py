from __future__ import annotations

import contextvars
import logging
import os
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from resume_ops_api.core.config import Settings

logger = logging.getLogger(__name__)

_current_trace_ctx: contextvars.ContextVar[TraceContext | None] = contextvars.ContextVar(
    "jobfoundry_trace_ctx", default=None
)
_logger_installed = False


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _extract_usage(kwargs: dict[str, Any], response_obj: Any) -> dict[str, int] | None:
    usage_obj = None
    if isinstance(response_obj, dict):
        usage_obj = response_obj.get("usage")
    else:
        usage_obj = getattr(response_obj, "usage", None)
    if not usage_obj:
        return None
    if isinstance(usage_obj, dict):
        prompt = int(usage_obj.get("prompt_tokens") or 0)
        completion = int(usage_obj.get("completion_tokens") or 0)
        total = int(usage_obj.get("total_tokens") or (prompt + completion))
    else:
        prompt = int(getattr(usage_obj, "prompt_tokens", 0) or 0)
        completion = int(getattr(usage_obj, "completion_tokens", 0) or 0)
        total = int(getattr(usage_obj, "total_tokens", 0) or (prompt + completion))
    return {"prompt_tokens": prompt, "completion_tokens": completion, "total_tokens": total}


def _extract_output_text(response_obj: Any) -> Any:
    if response_obj is None:
        return None
    if isinstance(response_obj, dict):
        choices = response_obj.get("choices") or []
        if choices and isinstance(choices[0], dict):
            msg = choices[0].get("message") or {}
            return msg.get("content") or response_obj
        return response_obj
    choices = getattr(response_obj, "choices", None)
    if choices:
        msg = getattr(choices[0], "message", None)
        if msg is not None:
            return getattr(msg, "content", None) or str(response_obj)
    return str(response_obj)


class _OpikBackend:
    def __init__(self, cfg: dict[str, Any], span_name: str, input_data: Any, metadata: dict[str, Any]) -> None:
        import opik

        kwargs: dict[str, Any] = {}
        if cfg.get("api_key"):
            kwargs["api_key"] = cfg["api_key"]
        if cfg.get("workspace"):
            kwargs["workspace"] = cfg["workspace"]
        if cfg.get("project_name"):
            kwargs["project_name"] = cfg["project_name"]
        if cfg.get("url_override"):
            kwargs["host"] = cfg["url_override"]
        self.client = opik.Opik(**kwargs)
        tags = [f"{k}:{v}" for k, v in metadata.items() if v]
        self.trace = self.client.trace(
            name=span_name,
            input=input_data,
            metadata=metadata,
            tags=tags or None,
        )

    def record_llm(
        self,
        *,
        model: str,
        messages: Any,
        output: Any,
        usage: dict[str, int] | None,
        metadata: dict[str, Any],
        error: str | None,
    ) -> None:
        span_kwargs: dict[str, Any] = {
            "name": f"llm:{model}",
            "type": "llm",
            "model": model,
            "input": {"messages": messages},
            "output": {"error": error} if error else {"output": output},
            "metadata": metadata,
        }
        if usage:
            span_kwargs["usage"] = usage
        self.trace.span(**span_kwargs).end()

    def finish(self, output_data: Any, error: str | None) -> None:
        update_kwargs: dict[str, Any] = {}
        if error:
            update_kwargs["output"] = {"error": error}
        elif output_data is not None:
            update_kwargs["output"] = output_data
        if update_kwargs:
            self.trace.update(**update_kwargs)
        self.trace.end()
        self.client.flush()


class _LangfuseBackend:
    def __init__(self, cfg: dict[str, Any], span_name: str, input_data: Any, metadata: dict[str, Any]) -> None:
        from langfuse import Langfuse

        self.client = Langfuse(
            public_key=cfg["public_key"],
            secret_key=cfg["secret_key"],
            host=cfg.get("host") or "https://cloud.langfuse.com",
        )
        self.trace = self.client.trace(
            name=span_name,
            user_id=str(metadata.get("user_id") or "") or None,
            input=input_data,
            metadata=metadata,
        )

    def record_llm(
        self,
        *,
        model: str,
        messages: Any,
        output: Any,
        usage: dict[str, int] | None,
        metadata: dict[str, Any],
        error: str | None,
    ) -> None:
        gen_kwargs: dict[str, Any] = {
            "name": f"llm:{model}",
            "model": model,
            "input": messages,
            "output": {"error": error} if error else output,
            "metadata": metadata,
            "level": "ERROR" if error else "DEFAULT",
        }
        if error:
            gen_kwargs["status_message"] = error
        if usage:
            gen_kwargs["usage"] = {
                "input": usage["prompt_tokens"],
                "output": usage["completion_tokens"],
                "total": usage["total_tokens"],
            }
        self.trace.generation(**gen_kwargs)

    def finish(self, output_data: Any, error: str | None) -> None:
        if error:
            self.trace.update(output={"error": error})
        elif output_data is not None:
            self.trace.update(output=output_data)
        self.client.flush()


class _LangSmithBackend:
    def __init__(self, cfg: dict[str, Any], span_name: str, input_data: Any, metadata: dict[str, Any]) -> None:
        from langsmith import Client

        self.client = Client(
            api_key=cfg["api_key"],
            api_url=cfg.get("endpoint") or "https://api.smith.langchain.com",
        )
        self.project_name = cfg.get("project") or "jobfoundry"
        self.run_id = uuid.uuid4()
        self.client.create_run(
            id=self.run_id,
            name=span_name,
            run_type="chain",
            inputs=input_data if isinstance(input_data, dict) else {"input": input_data},
            project_name=self.project_name,
            start_time=_utc_now(),
            extra={"metadata": metadata},
        )

    def record_llm(
        self,
        *,
        model: str,
        messages: Any,
        output: Any,
        usage: dict[str, int] | None,
        metadata: dict[str, Any],
        error: str | None,
    ) -> None:
        now = _utc_now()
        self.client.create_run(
            id=uuid.uuid4(),
            parent_run_id=self.run_id,
            name=f"llm:{model}",
            run_type="llm",
            inputs={"messages": messages},
            outputs=None if error else {"output": output},
            error=error,
            project_name=self.project_name,
            start_time=now,
            end_time=now,
            extra={"metadata": {**metadata, "model": model, **({"usage": usage} if usage else {})}},
        )

    def finish(self, output_data: Any, error: str | None) -> None:
        self.client.update_run(
            self.run_id,
            outputs=None if error else (output_data if isinstance(output_data, dict) else {"output": output_data}),
            error=error,
            end_time=_utc_now(),
        )


class TraceContext:
    def __init__(
        self,
        trace_config: dict[str, Any] | None,
        metadata: dict[str, Any] | None,
        span_name: str,
        input_data: Any,
    ) -> None:
        self.metadata = dict(metadata or {})
        self.output_data: Any = None
        self.backends: list[Any] = []
        if not trace_config:
            return

        backend_specs = [
            ("opik", _OpikBackend),
            ("langfuse", _LangfuseBackend),
            ("langsmith", _LangSmithBackend),
        ]
        for key, cls in backend_specs:
            cfg = trace_config.get(key)
            if isinstance(cfg, dict) and cfg.get("enabled"):
                try:
                    self.backends.append(cls(cfg, span_name, input_data, self.metadata))
                except Exception as exc:
                    logger.warning("Failed to initialize %s tracer: %s", key, exc)

    def set_output(self, output_data: Any) -> None:
        self.output_data = output_data

    def record_llm_call(
        self,
        *,
        model: str,
        messages: Any,
        output: Any,
        usage: dict[str, int] | None,
        latency_ms: float | None,
        error: str | None = None,
    ) -> None:
        if not self.backends:
            return
        meta = {**self.metadata}
        if latency_ms is not None:
            meta["latency_ms"] = round(latency_ms, 2)
        for backend in self.backends:
            try:
                backend.record_llm(
                    model=model,
                    messages=messages,
                    output=output,
                    usage=usage,
                    metadata=meta,
                    error=error,
                )
            except Exception as exc:
                logger.warning("Tracing record_llm failed (%s): %s", type(backend).__name__, exc)

    def finish(self, error: str | None = None) -> None:
        for backend in self.backends:
            try:
                backend.finish(self.output_data, error)
            except Exception as exc:
                logger.warning("Tracing finish failed (%s): %s", type(backend).__name__, exc)


def resolve_trace_config(
    trace_config: dict[str, Any] | None,
    fallback_settings: Settings | None = None,
) -> dict[str, Any] | None:
    if trace_config is not None:
        if trace_config.get("disabled"):
            return None
        return trace_config
    if fallback_settings and fallback_settings.enable_tracing:
        cfg: dict[str, Any] = {}
        opik_key = fallback_settings.opik_api_key or os.getenv("OPIK_API_KEY")
        opik_url = fallback_settings.opik_url_override or os.getenv("OPIK_URL_OVERRIDE")
        if opik_key or opik_url:
            cfg["opik"] = {
                "enabled": True,
                "api_key": opik_key,
                "project_name": fallback_settings.opik_project_name or os.getenv("OPIK_PROJECT_NAME", "jobfoundry"),
                "workspace": fallback_settings.opik_workspace or os.getenv("OPIK_WORKSPACE"),
                "url_override": opik_url,
            }
        lf_pub = fallback_settings.langfuse_public_key or os.getenv("LANGFUSE_PUBLIC_KEY")
        lf_sec = fallback_settings.langfuse_secret_key or os.getenv("LANGFUSE_SECRET_KEY")
        if lf_pub and lf_sec:
            cfg["langfuse"] = {
                "enabled": True,
                "public_key": lf_pub,
                "secret_key": lf_sec,
                "host": fallback_settings.langfuse_host or os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
            }
        ls_key = fallback_settings.langsmith_api_key or os.getenv("LANGSMITH_API_KEY") or os.getenv("LANGCHAIN_API_KEY")
        if ls_key:
            cfg["langsmith"] = {
                "enabled": True,
                "api_key": ls_key,
                "project": fallback_settings.langsmith_project or os.getenv("LANGSMITH_PROJECT", "jobfoundry"),
                "endpoint": fallback_settings.langsmith_endpoint or os.getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com"),
            }
        return cfg or None
    return None


@contextmanager
def trace_context(
    *,
    trace_config: dict[str, Any] | None = None,
    trace_metadata: dict[str, Any] | None = None,
    fallback_settings: Settings | None = None,
    span_name: str = "tailor_resume",
    input_data: Any = None,
) -> Iterator[TraceContext]:
    ensure_litellm_logger()
    resolved = resolve_trace_config(trace_config, fallback_settings)
    ctx = TraceContext(resolved, trace_metadata, span_name, input_data)
    token = _current_trace_ctx.set(ctx)
    err_msg: str | None = None
    try:
        yield ctx
    except Exception as exc:
        err_msg = str(exc)
        raise
    finally:
        ctx.finish(error=err_msg)
        _current_trace_ctx.reset(token)


def ensure_litellm_logger() -> None:
    global _logger_installed
    if _logger_installed:
        return
    try:
        import litellm
        from litellm.integrations.custom_logger import CustomLogger

        class MultiProviderTraceLogger(CustomLogger):
            def _dispatch(self, kwargs: dict[str, Any], response_obj: Any, start_time: Any, end_time: Any, error: str | None = None) -> None:
                ctx = _current_trace_ctx.get()
                if not ctx or not ctx.backends:
                    return
                model = str(kwargs.get("model") or "unknown")
                messages = kwargs.get("messages")
                usage = _extract_usage(kwargs, response_obj)
                output = None if error else _extract_output_text(response_obj)
                latency_ms = None
                if isinstance(start_time, (int, float)) and isinstance(end_time, (int, float)):
                    latency_ms = (end_time - start_time) * 1000.0
                elif hasattr(start_time, "timestamp") and hasattr(end_time, "timestamp"):
                    latency_ms = (end_time.timestamp() - start_time.timestamp()) * 1000.0
                ctx.record_llm_call(
                    model=model,
                    messages=messages,
                    output=output,
                    usage=usage,
                    latency_ms=latency_ms,
                    error=error,
                )

            def log_success_event(self, kwargs: Any, response_obj: Any, start_time: Any, end_time: Any) -> None:
                self._dispatch(kwargs or {}, response_obj, start_time, end_time)

            async def async_log_success_event(self, kwargs: Any, response_obj: Any, start_time: Any, end_time: Any) -> None:
                self._dispatch(kwargs or {}, response_obj, start_time, end_time)

            def log_failure_event(self, kwargs: Any, response_obj: Any, start_time: Any, end_time: Any) -> None:
                err = str((kwargs or {}).get("exception") or response_obj or "LLM call failed")
                self._dispatch(kwargs or {}, response_obj, start_time, end_time, error=err)

            async def async_log_failure_event(self, kwargs: Any, response_obj: Any, start_time: Any, end_time: Any) -> None:
                err = str((kwargs or {}).get("exception") or response_obj or "LLM call failed")
                self._dispatch(kwargs or {}, response_obj, start_time, end_time, error=err)

        logger_instance = MultiProviderTraceLogger()
        callbacks = list(getattr(litellm, "callbacks", []) or [])
        if not any(type(cb).__name__ == "MultiProviderTraceLogger" for cb in callbacks):
            callbacks.append(logger_instance)
            litellm.callbacks = callbacks
        _logger_installed = True
    except ImportError:
        logger.warning("LiteLLM is not installed; LLM call tracing disabled.")
    except Exception as exc:
        logger.warning("Failed to install MultiProviderTraceLogger: %s", exc)


def setup_tracing(settings: Settings) -> None:
    """Initializes the async-safe LiteLLM multi-provider trace logger."""
    ensure_litellm_logger()
    if settings.enable_tracing:
        logger.info("Multi-provider tracing logger ready (startup fallback enabled).")
