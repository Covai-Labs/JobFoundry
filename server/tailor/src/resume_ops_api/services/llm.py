import asyncio
from collections import deque
import json
import logging
import re
import time
from typing import Any, TypeVar, cast, get_origin

import instructor
from litellm import acompletion
from pydantic import BaseModel

from resume_ops_api.core.exceptions import AppError
from resume_ops_api.services.ssrf_guard import SSRFBlockedError, assert_safe_url, install_transport_guard

logger = logging.getLogger(__name__)

ModelT = TypeVar("ModelT", bound=BaseModel)

JSON_BLOCK_RE = re.compile(r"```(?:json\s*)?(.*?)```", re.DOTALL)


def _is_unsupported_format_error(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(p in msg for p in ("response_format", "json_object", "unrecognized parameter", "not supported", "unexpected parameter"))


def _extract_json_string(content_str: str) -> str:
    content_str = content_str.strip()
    match = JSON_BLOCK_RE.search(content_str)
    if match:
        content_str = match.group(1).strip()
    else:
        first_idx = min(
            [idx for idx in [content_str.find("{"), content_str.find("[")] if idx != -1],
            default=-1,
        )
        last_idx = max(
            [idx for idx in [content_str.rfind("}"), content_str.rfind("]")] if idx != -1],
            default=-1,
        )
        if first_idx != -1 and last_idx != -1 and last_idx > first_idx:
            content_str = content_str[first_idx : last_idx + 1].strip()

    if not content_str.startswith("{") and not content_str.startswith("[") and ":" in content_str:
        content_str = "{" + content_str + "}"
    return content_str


def _clamp_parsed_data(d: Any) -> Any:
    if isinstance(d, dict):
        # Clamp project keywords and highlights
        if "projects" in d and isinstance(d["projects"], list):
            for p in d["projects"]:
                if isinstance(p, dict):
                    if "highlights" in p and isinstance(p["highlights"], list):
                        p["highlights"] = p["highlights"][:3]
                    if "keywords" in p and isinstance(p["keywords"], list):
                        p["keywords"] = p["keywords"][:6]

        # Clamp skills keywords
        if "skills" in d and isinstance(d["skills"], list):
            for s in d["skills"]:
                if isinstance(s, dict) and "keywords" in s and isinstance(s["keywords"], list):
                    s["keywords"] = s["keywords"][:8]
    return d


def _reshape_parsed_data(parsed: Any, response_model: type[BaseModel]) -> Any:
    if isinstance(parsed, list):
        model_fields = list(response_model.model_fields.keys())
        if len(parsed) == 1 and not any(isinstance(item, list) for item in parsed):
            first_item = parsed[0]
            if isinstance(first_item, dict) and any(k in model_fields for k in first_item.keys()):
                parsed = first_item

        if isinstance(parsed, list):
            list_field = None
            for field_name, field_info in response_model.model_fields.items():
                if get_origin(field_info.annotation) is list:
                    list_field = field_name
                    break
            if list_field:
                parsed = {list_field: parsed}
    elif isinstance(parsed, dict):
        model_fields = set(response_model.model_fields.keys())
        if not (set(parsed.keys()) & model_fields):
            list_values = [v for v in parsed.values() if isinstance(v, list)]
            if len(list_values) == 1:
                for field_name, field_info in response_model.model_fields.items():
                    if get_origin(field_info.annotation) is list:
                        parsed = {field_name: list_values[0]}
                        break
    return _clamp_parsed_data(parsed)


def _parse_raw_llm_json(content: Any, response_model: type[BaseModel]) -> tuple[Any, str]:
    if isinstance(content, dict):
        return _reshape_parsed_data(content, response_model), json.dumps(content)
    raw_str = str(content)
    extracted = _extract_json_string(raw_str)
    parsed = json.loads(extracted)
    return _reshape_parsed_data(parsed, response_model), raw_str

# ---------------------------------------------------------------------------
# API base URL SSRF guard (connection-time IP-range blocking)
# Replaces the static provider allowlist: any public-host api_base is permitted
# (BYOK), while private/loopback/link-local destinations are blocked unless the
# origin is operator-trusted (local Ollama :11434, or anything
# listed in ALLOWED_LLM_BASES). Wire-in happens at import for defense-in-depth.
# ---------------------------------------------------------------------------

install_transport_guard()


def _validate_api_base(api_base: str | None) -> None:
    """Validate api_base structurally and block SSRF-eligible destinations."""
    if not api_base or not api_base.strip():
        return
    from urllib.parse import urlparse
    stripped = api_base.strip()
    parsed = urlparse(stripped)
    if parsed.scheme not in ("http", "https"):
        raise AppError(
            f'API base URL must use http or https scheme, got "{parsed.scheme}"',
            code="invalid_api_base",
            status_code=400,
        )
    if not parsed.netloc:
        raise AppError(
            f'Invalid api_base URL: "{api_base}"',
            code="invalid_api_base",
            status_code=400,
        )
    if parsed.username or parsed.password:
        raise AppError(
            "API base URL must not contain credentials (user:pass@host)",
            code="invalid_api_base",
            status_code=400,
        )
    try:
        parsed.port
    except ValueError:
        raise AppError(
            f'Invalid port in api_base URL: "{api_base}"',
            code="invalid_api_base",
            status_code=400,
        )
    # Connection-time IP-range enforcement (BYOK-safe: public hosts pass, private blocked)
    try:
        assert_safe_url(stripped)
    except SSRFBlockedError as e:
        raise AppError(
            str(e),
            code="ssrf_api_base_blocked",
            status_code=400,
        )


class AsyncRateLimiter:
    def __init__(self, requests: int, period: float) -> None:
        self.requests = requests
        self.period = period
        self.timestamps: deque[float] = deque()
        self.lock = asyncio.Lock()

    async def acquire(self) -> None:
        if self.requests <= 0:
            return

        async with self.lock:
            while True:
                now = time.monotonic()
                # Remove timestamps older than the period
                while self.timestamps and self.timestamps[0] <= now - self.period:
                    self.timestamps.popleft()

                if len(self.timestamps) < self.requests:
                    self.timestamps.append(now)
                    break

                # We need to wait until the oldest timestamp falls out of the window
                sleep_time = self.timestamps[0] + self.period - now
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)


class StructuredLLMClient:
    def __init__(
        self,
        completion_fn: Any | None = None,
        *,
        rate_limit_requests: int | None = None,
        rate_limit_period: float = 60.0,
        max_concurrency: int | None = None,
        enable_cache: bool = False,
        max_retries: int = 10,
        retry_min_wait: float = 3.0,
        retry_max_wait: float = 60.0,
        retry_multiplier: float = 3.0,
        request_timeout: float = 600.0,
    ) -> None:
        self.completion_fn = completion_fn or acompletion
        self.enable_cache = enable_cache
        self.cache: dict[tuple[str, str, str, str, str, str], Any] = {}
        if self.enable_cache:
            try:
                import litellm
                litellm.enable_cache(type="local")
            except (ImportError, AttributeError) as exc:
                logger.debug("Optional LiteLLM cache support not available: %s", exc)
            except Exception as exc:
                logger.warning("Failed to initialize LiteLLM cache: %s", exc)
        self.max_retries = max_retries
        self.retry_min_wait = retry_min_wait
        self.retry_max_wait = retry_max_wait
        self.retry_multiplier = retry_multiplier
        self.request_timeout = request_timeout
        self.rate_limiter = (
            AsyncRateLimiter(rate_limit_requests, rate_limit_period)
            if rate_limit_requests
            else None
        )
        self.semaphore = (
            asyncio.Semaphore(max_concurrency)
            if max_concurrency
            else None
        )

    async def generate_structured(
        self,
        *,
        model: str,
        system_prompt: str,
        user_prompt: str,
        response_model: type[ModelT],
        session_id: str | None = None,
        validation_context: dict[str, Any] | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
    ) -> ModelT:
        cache_key = (model, api_key, api_base, system_prompt, user_prompt, response_model.__name__)
        if self.enable_cache and cache_key in self.cache:
            import logging
            logging.info(f"Returning cached validated response for model '{model}' and schema '{response_model.__name__}'")
            return self.cache[cache_key]

        from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential, retry_if_exception
        import logging

        def should_retry(exc: Exception) -> bool:
            from pydantic import ValidationError
            # Check if the exception or its original cause is a Pydantic ValidationError
            if isinstance(exc, ValidationError) or isinstance(exc.__cause__, ValidationError):
                return False
            # Do not retry permanent client/auth errors (e.g. 400 Bad Request, 401 Unauthorized)
            exc_name = type(exc).__name__
            if exc_name in ("AuthenticationError", "PermissionDeniedError", "NotFoundError", "BadRequestError"):
                return False
            
            logging.warning(f"Structured LLM client encountered error: {exc}. Retrying...")
            return True

        import sys
        is_testing = "pytest" in sys.modules
        max_attempts = self.max_retries
        min_wait = 0 if is_testing else self.retry_min_wait
        max_wait = 0 if is_testing else self.retry_max_wait
        multiplier = 1 if is_testing else self.retry_multiplier

        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(max_attempts),
            wait=wait_exponential(multiplier=multiplier, min=min_wait, max=max_wait),
            retry=retry_if_exception(should_retry),
            reraise=True,
        ):
            with attempt:
                from typing import cast
                
                async def _call_with_rate_limiting():
                    if self.rate_limiter:
                        await self.rate_limiter.acquire()
                    return await cast(
                        Any,
                        self._generate_structured_internal(
                            model=model,
                            system_prompt=system_prompt,
                            user_prompt=user_prompt,
                            response_model=response_model,
                            session_id=session_id,
                            validation_context=validation_context,
                            api_key=api_key,
                            api_base=api_base,
                        ),
                    )

                if self.semaphore:
                    async with self.semaphore:
                        result = await _call_with_rate_limiting()
                else:
                    result = await _call_with_rate_limiting()

                if self.enable_cache:
                    self.cache[cache_key] = result
                return result

    async def _generate_structured_internal(
        self,
        *,
        model: str,
        system_prompt: str,
        user_prompt: str,
        response_model: type[ModelT],
        session_id: str | None = None,
        validation_context: dict[str, Any] | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
    ) -> ModelT:
        extra_headers: dict[str, str] = {}
        if session_id:
            extra_headers["X-Session-Id"] = session_id

        extra_kwargs: dict[str, Any] = {}
        if api_key:
            extra_kwargs["api_key"] = api_key
        if api_base:
            _validate_api_base(api_base)
            extra_kwargs["api_base"] = api_base

        # Ensure "json" is in the prompts to satisfy APIs enforcing this when response_format is json_object
        if "json" not in system_prompt.lower() and "json" not in user_prompt.lower():
            system_prompt = system_prompt + "\n\nNote: The output must be valid JSON."

        # For OpenRouter models, execute direct completion with markdown JSON parsing and field clamping
        if "openrouter" in model.lower():
            try:
                completion = await self.completion_fn(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.2,
                    drop_params=True,
                    timeout=self.request_timeout,
                    extra_headers=extra_headers or None,
                    caching=self.enable_cache,
                    **extra_kwargs,
                )
                content = completion["choices"][0]["message"]["content"]
                parsed, _ = _parse_raw_llm_json(content, response_model)
                return response_model.model_validate(parsed, context=validation_context)
            except Exception as e:
                logger.debug("Direct OpenRouter completion failed for model '%s': %s. Falling back to standard modes.", model, e)

        # 1. First, try strict JSON Schema mode (OpenAI Structured Outputs)
        try:
            client = cast(Any, instructor.from_litellm(self.completion_fn, mode=instructor.Mode.JSON_OAI, max_retries=2))
            response = await client.chat.completions.create(
                model=model,
                response_model=response_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                drop_params=True,
                timeout=self.request_timeout,
                extra_headers=extra_headers or None,
                validation_context=validation_context,
                caching=self.enable_cache,
                **extra_kwargs,
            )
            if isinstance(response, response_model):
                return response
        except Exception as e:
            logger.debug("JSON_OAI strict mode failed for model '%s': %s. Falling back to tool calling.", model, e)

        # 2. Fall back to standard Tool Calling
        try:
            client = cast(Any, instructor.from_litellm(self.completion_fn, mode=instructor.Mode.TOOLS, max_retries=2))
            response = await client.chat.completions.create(
                model=model,
                response_model=response_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                drop_params=True,
                timeout=self.request_timeout,
                extra_headers=extra_headers or None,
                validation_context=validation_context,
                caching=self.enable_cache,
                **extra_kwargs,
            )
            if isinstance(response, response_model):
                return response
        except Exception as e:
            logger.debug("Tool calling mode failed for model '%s': %s. Falling back to raw JSON object mode.", model, e)

        # 2b. Try MD_JSON fallback before raw parsing
        try:
            client = cast(Any, instructor.from_litellm(self.completion_fn, mode=instructor.Mode.MD_JSON, max_retries=1))
            response = await client.chat.completions.create(
                model=model,
                response_model=response_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                drop_params=True,
                timeout=self.request_timeout,
                extra_headers=extra_headers or None,
                validation_context=validation_context,
                caching=self.enable_cache,
                **extra_kwargs,
            )
            if isinstance(response, response_model):
                return response
        except Exception as e:
            logger.debug("Fallback MD_JSON mode failed for model '%s': %s.", model, e)

        # 3. Final fallback to raw acompletion with json_object
        try:
            try:
                completion = await self.completion_fn(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.2,
                    drop_params=True,
                    timeout=self.request_timeout,
                    response_format={"type": "json_object"},
                    extra_headers=extra_headers or None,
                    caching=self.enable_cache,
                    **extra_kwargs,
                )
            except Exception as format_exc:
                if not _is_unsupported_format_error(format_exc):
                    raise
                logger.debug(
                    "Raw completion with json_object failed for model '%s': %s. Retrying without response_format.",
                    model,
                    format_exc,
                )
                completion = await self.completion_fn(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    temperature=0.2,
                    drop_params=True,
                    timeout=self.request_timeout,
                    extra_headers=extra_headers or None,
                    caching=self.enable_cache,
                    **extra_kwargs,
                )
            content = completion["choices"][0]["message"]["content"]
            try:
                parsed, content_str = _parse_raw_llm_json(content, response_model)
                return response_model.model_validate(parsed, context=validation_context)
            except Exception as val_err:
                # Option B: 1-turn conversational self-correction retry
                logger.warning(
                    "Structured output validation failed for model '%s': %s. Attempting 1-turn self-correction retry.",
                    model,
                    val_err,
                )
                correction_msg = (
                    f"The previously returned JSON was invalid and failed schema validation with error:\n"
                    f"{val_err}\n\n"
                    f"Please output corrected JSON that strictly satisfies the schema and validation constraints. "
                    f"Return ONLY valid JSON."
                )
                retry_messages = [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                    {"role": "assistant", "content": content if isinstance(content, str) else json.dumps(content)},
                    {"role": "user", "content": correction_msg},
                ]
                try:
                    retry_comp = await self.completion_fn(
                        model=model,
                        messages=retry_messages,
                        temperature=0.1,
                        drop_params=True,
                        timeout=self.request_timeout,
                        response_format={"type": "json_object"},
                        extra_headers=extra_headers or None,
                        caching=self.enable_cache,
                        **extra_kwargs,
                    )
                except Exception as retry_format_exc:
                    if not _is_unsupported_format_error(retry_format_exc):
                        raise
                    logger.debug(
                        "Repair completion with json_object failed for model '%s': %s. Retrying without response_format.",
                        model,
                        retry_format_exc,
                    )
                    retry_comp = await self.completion_fn(
                        model=model,
                        messages=retry_messages,
                        temperature=0.1,
                        drop_params=True,
                        timeout=self.request_timeout,
                        extra_headers=extra_headers or None,
                        caching=self.enable_cache,
                        **extra_kwargs,
                    )
                retry_content = retry_comp["choices"][0]["message"]["content"]
                retry_parsed, _ = _parse_raw_llm_json(retry_content, response_model)
                return response_model.model_validate(retry_parsed, context=validation_context)
        except Exception as exc:
            logger.error(
                "Structured LLM generation failed for model '%s': %s. Raw content was: %r",
                model,
                exc,
                locals().get("content"),
            )
            raise AppError(
                f"Structured LLM generation failed for model '{model}'.",
                code="llm_generation_failed",
                status_code=502,
                details={"model": model, "error": str(exc)},
            ) from exc
