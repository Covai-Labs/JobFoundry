from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock

from resume_ops_api.core.config import Settings
from resume_ops_api.services.tracing import ensure_litellm_logger, resolve_trace_config, trace_context


def test_resolve_trace_config_respects_explicit_disabled():
    settings = Settings(enable_tracing=True, opik_api_key="test-opik-placeholder")
    assert resolve_trace_config({"disabled": True}, settings) is None
    assert resolve_trace_config(None, settings) is not None


def test_trace_context_fans_out_to_all_three_providers(monkeypatch):
    opik_client = MagicMock()
    opik_trace = MagicMock()
    opik_span = MagicMock()
    opik_client.trace.return_value = opik_trace
    opik_trace.span.return_value = opik_span

    langfuse_client = MagicMock()
    langfuse_trace = MagicMock()
    langfuse_client.trace.return_value = langfuse_trace

    langsmith_client = MagicMock()

    monkeypatch.setitem(sys.modules, "opik", types.SimpleNamespace(Opik=MagicMock(return_value=opik_client)))
    monkeypatch.setitem(sys.modules, "langfuse", types.SimpleNamespace(Langfuse=MagicMock(return_value=langfuse_client)))
    monkeypatch.setitem(sys.modules, "langsmith", types.SimpleNamespace(Client=MagicMock(return_value=langsmith_client)))

    cfg = {
        "opik": {"enabled": True, "api_key": "test-opik-placeholder", "project_name": "proj"},
        "langfuse": {"enabled": True, "public_key": "test-lf-public-placeholder", "secret_key": "test-lf-val-placeholder"},
        "langsmith": {"enabled": True, "api_key": "test-ls-placeholder", "project": "ls-proj"},
    }
    meta = {"user_id": "usr_1", "job_id": "job_1", "feature": "tailor"}

    ensure_litellm_logger()
    import litellm

    logger_cb = next(cb for cb in litellm.callbacks if type(cb).__name__ == "MultiProviderTraceLogger")

    with trace_context(trace_config=cfg, trace_metadata=meta, span_name="tailor_resume", input_data={"model": "m"}) as ctx:
        logger_cb.log_success_event(
            {"model": "gpt-4o", "messages": [{"role": "user", "content": "hi"}]},
            {"choices": [{"message": {"content": "hello"}}], "usage": {"prompt_tokens": 5, "completion_tokens": 2, "total_tokens": 7}},
            1.0,
            1.0425,
        )
        ctx.set_output({"ok": True})

    opik_trace.span.assert_called_once()
    opik_span.end.assert_called_once()
    opik_trace.end.assert_called_once()
    opik_client.flush.assert_called_once()

    langfuse_trace.generation.assert_called_once()
    langfuse_client.flush.assert_called_once()

    assert langsmith_client.create_run.call_count == 2
    langsmith_client.update_run.assert_called_once()


def test_trace_context_isolates_failing_provider(monkeypatch):
    def broken_opik(**kwargs):
        raise RuntimeError("opik down")

    langfuse_client = MagicMock()
    langfuse_trace = MagicMock()
    langfuse_client.trace.return_value = langfuse_trace

    monkeypatch.setitem(sys.modules, "opik", types.SimpleNamespace(Opik=broken_opik))
    monkeypatch.setitem(sys.modules, "langfuse", types.SimpleNamespace(Langfuse=MagicMock(return_value=langfuse_client)))

    cfg = {
        "opik": {"enabled": True, "api_key": "test-opik-placeholder"},
        "langfuse": {"enabled": True, "public_key": "test-lf-public-placeholder", "secret_key": "test-lf-val-placeholder"},
    }
    with trace_context(trace_config=cfg, trace_metadata={"user_id": "u1"}, span_name="tailor_resume") as ctx:
        ctx.record_llm_call(model="m", messages=[], output="ok", usage=None, latency_ms=10.0)

    langfuse_trace.generation.assert_called_once()
    langfuse_client.flush.assert_called_once()
