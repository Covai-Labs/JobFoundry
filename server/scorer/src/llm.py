import asyncio
import logging
import os
import time
from typing import Protocol, runtime_checkable, Any
from pydantic import BaseModel, Field
import toons
import instructor
import litellm
from litellm import acompletion

from src.ssrf_guard import assert_safe_url, install_transport_guard

logger = logging.getLogger(__name__)

# C0 control characters other than tab, plus DEL. Every one of them is
# translated to a space before a value reaches a log record.
_LOG_CONTROL_CHARS = {code: 0x20 for code in range(0x20) if code != 0x09}
_LOG_CONTROL_CHARS[0x7F] = 0x20


def _log_safe(value: Any, limit: int = 200) -> str:
    """
    Flatten an untrusted value into a single log-safe line.

    Job records arrive from scraped pages, and provider errors can echo request
    content back, so either can carry CR/LF or other control characters. Log
    records are newline-delimited, which makes that a log-forging primitive
    (CWE-117). Translate control characters to spaces, collapse the remaining
    whitespace, then cap the length so one oversized field cannot dominate a
    record.

    Args:
        value: Anything whose ``str()`` is about to be logged.
        limit: Maximum number of characters kept.

    Returns:
        A single line of plain text, at most ``limit`` characters long.
    """
    text = " ".join(str(value).translate(_LOG_CONTROL_CHARS).split())
    if len(text) > limit:
        text = text[: limit - 3] + "..."
    return text


def format_resume_for_prompt(resume: dict[str, Any]) -> str:
    """
    Format the master resume into TOON (Token-Oriented Object Notation)
    to minimize prompt tokens while preserving structured hierarchy and tabular arrays.
    Falls back to string representation on serialization error.
    """
    if not resume:
        return ""
    try:
        return toons.dumps(resume)
    except Exception as e:
        logger.warning("Failed to serialize resume to TOON format (%s); falling back to string", e)
        return str(resume)


def _register_callback(name: str, enabled: bool, success_cb: list[Any], failure_cb: list[Any]) -> None:
    if not enabled:
        return
    if name not in success_cb:
        success_cb.append(name)
    if name not in failure_cb:
        failure_cb.append(name)
    logger.info("%s LLM tracing activated via LiteLLM callbacks", name.title())


def setup_observability():
    current_success = list(getattr(litellm, "success_callback", []) or [])
    current_failure = list(getattr(litellm, "failure_callback", []) or [])

    opik_enabled = bool(os.getenv("OPIK_API_KEY") or os.getenv("OPIK_URL_OVERRIDE"))
    _register_callback("opik", opik_enabled, current_success, current_failure)

    langfuse_enabled = bool(os.getenv("LANGFUSE_PUBLIC_KEY") and os.getenv("LANGFUSE_SECRET_KEY"))
    _register_callback("langfuse", langfuse_enabled, current_success, current_failure)

    langsmith_key = os.getenv("LANGSMITH_API_KEY") or os.getenv("LANGCHAIN_API_KEY")
    if langsmith_key:
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
    _register_callback("langsmith", bool(langsmith_key), current_success, current_failure)

    litellm.success_callback = current_success
    litellm.failure_callback = current_failure


setup_observability()

# Defense-in-depth: every outbound httpx request in this process is SSRF-checked.
install_transport_guard()


class ScoreResult(BaseModel):
    score: int = Field(..., ge=0, le=100, description="Fit score from 0 to 100")
    reasoning: str = Field(..., description="Explanation of the match and scoring rationale")
    missing_skills: list[str] = Field(default_factory=list, description="Skills required/preferred by the job but missing in the resume")
    matching_skills: list[str] = Field(default_factory=list, description="Skills present in both the resume and the job requirements")
    clean_title: str | None = Field(
        default=None,
        description="Accurate, professional role title. If the scraped title is garbled, generic, or an artifact like '0 notifications' or 'Feed detail update', extract the real role title from the text.",
    )
    clean_company: str | None = Field(
        default=None,
        description="Sanitized hiring company name. If generic like 'LinkedIn Company' or 'Google' (when actually a third-party posting), extract the true hiring company.",
    )
    clean_description: str | None = Field(
        default=None,
        description="Sanitized and structured job description in Markdown (Role Overview, Responsibilities, Requirements). Prunes corporate boilerplate, EEOC disclaimers, cookie notices, and application URL noise while preserving all technical and qualification requirements.",
    )
    is_valid_job: bool = Field(
        default=True,
        description="True if this is an authentic job posting. Set to False if this is non-job web noise, such as a LinkedIn notifications feed, user profile, social update, or login prompt.",
    )
    is_truncated: bool = Field(
        default=False,
        description="True if the provided job description appears incomplete, cut off mid-sentence, or truncated.",
    )


@runtime_checkable
class LLMClient(Protocol):
    async def score(
        self,
        job: dict[str, Any],
        resume: dict[str, Any],
        llm_settings: dict[str, Any] | None = None,
    ) -> ScoreResult:
        ...


class StubLLM:
    def __init__(self, default_result: ScoreResult | None = None):
        self.default_result = default_result or ScoreResult(
            score=80,
            reasoning="Default stub reasoning",
            missing_skills=[],
            matching_skills=[],
            clean_title=None,
            clean_company=None,
            clean_description=None,
            is_valid_job=True,
            is_truncated=False,
        )
        self.call_history: list[tuple[dict[str, Any], dict[str, Any]]] = []

    async def score(
        self,
        job: dict[str, Any],
        resume: dict[str, Any],
        llm_settings: dict[str, Any] | None = None,
    ) -> ScoreResult:
        self.call_history.append((job, resume))
        return self.default_result


def _is_transient_error(e: Exception) -> bool:
    """Classify whether an exception from LiteLLM / Instructor is transient and retryable."""
    exceptions_to_check: list[Any] = [e]
    if hasattr(e, "failed_attempts") and getattr(e, "failed_attempts"):
        for fa in getattr(e, "failed_attempts"):
            if hasattr(fa, "exception") and fa.exception:
                exceptions_to_check.append(fa.exception)
    if getattr(e, "__cause__", None):
        exceptions_to_check.append(e.__cause__)

    for exc in exceptions_to_check:
        status_code = getattr(exc, "status_code", None)
        if status_code in (429, 500, 502, 503, 504, 529):
            return True
        exc_type = type(exc).__name__
        if exc_type in (
            "RateLimitError",
            "APIConnectionError",
            "Timeout",
            "APITimeoutError",
            "InternalServerError",
            "ServiceUnavailableError",
        ):
            return True
        msg = str(exc).lower()
        if any(term in msg for term in ("429", "rate limit", "timeout", "connection", "500", "502", "503", "504", "overloaded")):
            return True
    return False


class LiteLLMClient:
    def __init__(self, model: str = "gpt-4o-mini", api_key: str | None = None, api_base: str | None = None):
        self.model = model
        self.api_key = api_key
        self.api_base = api_base
        self.client = instructor.from_litellm(acompletion, mode=instructor.Mode.MD_JSON)

    async def score(
        self,
        job: dict[str, Any],
        resume: dict[str, Any],
        llm_settings: dict[str, Any] | None = None,
    ) -> ScoreResult:
        settings = llm_settings or {}
        model = settings.get("model") or self.model
        api_key = settings.get("api_key") or self.api_key
        api_base = settings.get("api_base") or self.api_base
        resume_str = format_resume_for_prompt(resume)
        timeout = float(settings.get("timeout", 90.0))

        facts = settings.get("user_facts") or []
        facts_block = ""
        if facts:
            facts_lines = [
                f"- [{f.get('category', 'general').upper()}] {f.get('fact_text', '')}"
                for f in facts
                if f.get("fact_text")
            ]
            if facts_lines:
                facts_block = (
                    f"--- CANDIDATE PRIVATE CONTEXT & NON-NEGOTIABLES ---\n"
                    f"{chr(10).join(facts_lines)}\n\n"
                )

        prompt = (
            f"You are an expert technical recruiter, resume screener, and job analyst.\n"
            f"Evaluate the candidate's master resume against the following job posting.\n"
            f"1. Check if this is a genuine job posting or non-job noise (e.g., social feed, notification counts like '0 notifications', user profile, cookie banner). Set `is_valid_job: false` if not a job posting.\n"
            f"2. If valid, provide a realistic fit score (0-100), concise reasoning, matching skills, and missing skills.\n"
            f"3. Take candidate private context and non-negotiables (e.g. location, visa, remote preference, constraints) into account when calculating fit.\n"
            f"4. Sanitize the job title into `clean_title` (e.g. fix '0 notifications' or bad scrapings) and `clean_company` if needed.\n"
            f"5. Sanitize the job description into clean, well-structured Markdown (Role Overview, Responsibilities, Requirements) "
            f"by stripping all corporate boilerplate, EEOC/diversity statements, and application links in `clean_description`.\n"
            f"6. If the job description is visibly cut off, ends mid-sentence, or lacks actual requirements, set `is_truncated: true`.\n"
            f"7. Reasoning must be crisp and evidence-backed: cite specific matched skills and gaps directly without generic corporate filler.\n\n"
            f"--- JOB POSTING ---\n"
            f"Title: {job.get('title', '')}\n"
            f"Company: {job.get('company', '')}\n"
            f"Location: {job.get('location', '')}\n"
            f"Description:\n{job.get('description', '')}\n\n"
            f"{facts_block}"
            f"--- MASTER RESUME (TOON format) ---\n"
            f"{resume_str}\n"
        )

        kwargs: dict[str, Any] = {
            "model": model,
            "response_model": ScoreResult,
            "messages": [
                {"role": "system", "content": "You evaluate resume-to-job fit and return structured scoring results including cleaned title, company, description, and job validity."},
                {"role": "user", "content": prompt},
            ],
            "max_retries": 2,
            "timeout": timeout,
        }
        if api_key:
            kwargs["api_key"] = api_key
        if api_base:
            # SSRF: block private/loopback/link-local destinations at connection time
            assert_safe_url(api_base)
            kwargs["api_base"] = api_base

        start_time = time.perf_counter()
        job_id = _log_safe(job.get("id", "unknown"), limit=64)
        logger.info("Evaluating job %s with model %s", job_id, _log_safe(model, limit=64))
        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            try:
                result: ScoreResult = await self.client.chat.completions.create(**kwargs)
                duration_ms = (time.perf_counter() - start_time) * 1000
                logger.info(
                    "Job %s evaluated in %.2fms: score=%d, matching=%d, missing=%d",
                    job_id,
                    duration_ms,
                    result.score,
                    len(result.matching_skills),
                    len(result.missing_skills),
                )
                return result
            except Exception as e:
                is_transient = _is_transient_error(e)
                if is_transient and attempt < max_attempts:
                    backoff = 2.0 ** attempt
                    logger.warning(
                        "Job %s LLM call failed transiently (attempt %d/%d): %s. Backing off for %.1fs",
                        job_id,
                        attempt,
                        max_attempts,
                        _log_safe(e, limit=300),
                        backoff,
                    )
                    await asyncio.sleep(backoff)
                    continue

                duration_ms = (time.perf_counter() - start_time) * 1000
                logger.error(
                    "LLM evaluation failed for job %s after %.2fms: %s",
                    job_id,
                    duration_ms,
                    _log_safe(e, limit=300),
                )
                raise
