from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import shutil
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.responses import FileResponse
from litellm import acompletion
from resume_ops_api.api.deps import get_container
from resume_ops_api.api.models import (
    CopilotCoverLetterRequest,
    CopilotCoverLetterResponse,
    CopilotOutreachRequest,
    CopilotOutreachResponse,
    CopilotQARequest,
    CopilotQAResponse,
    HealthResponse,
    MasterResumePreviewRequest,
    MasterResumeStatus,
    QueuedTaskResponse,
    RenderRequest,
    RenderResponse,
    TailorRequest,
    TailorResponse,
    TaskError,
    TaskStatusResponse,
    TestLlmRequest,
    TestLlmResponse,
    ThemeListResponse,
)
from resume_ops_api.core.exceptions import AppError
from resume_ops_api.services.ats_text import json_to_ats_text
from resume_ops_api.services.container import ServiceContainer
from resume_ops_api.services.ssrf_guard import assert_safe_url

router = APIRouter()


@router.get("/healthz", response_model=HealthResponse)
async def healthcheck() -> HealthResponse:
    return HealthResponse(status="ok")


@router.get("/readyz", response_model=HealthResponse)
async def readyz(container: ServiceContainer = Depends(get_container)) -> HealthResponse:
    await container.database.ping()
    return HealthResponse(status="ready")


@router.get("/api/v1/master-resume/status", response_model=MasterResumeStatus)
async def get_master_resume_status(container: ServiceContainer = Depends(get_container)) -> MasterResumeStatus:
    if not container.settings.master_resume_path:
        return MasterResumeStatus(configured=False, exists=False, valid=False, message="No master resume configured")
    if not container.settings.master_resume_path.exists():
        return MasterResumeStatus(configured=True, exists=False, valid=False, message="Master resume file not found")
    if not container.master_resume:
        return MasterResumeStatus(configured=True, exists=True, valid=False, message="Master resume is invalid")
    return MasterResumeStatus(configured=True, exists=True, valid=True, message="Master resume loaded successfully")


@router.get("/api/v1/themes", response_model=ThemeListResponse)
async def list_themes(container: ServiceContainer = Depends(get_container)) -> ThemeListResponse:
    return ThemeListResponse(
        default_theme=container.theme_service.default_theme,
        allowed_themes=container.theme_service.allowed_themes,
    )


# Preview cache policy. PDFs live in content-addressed directories under
# `DATA_DIR/artifacts/master-previews` and are pruned opportunistically.
PREVIEW_CACHE_VERSION = "1"
PREVIEW_CACHE_MAX_DIRS = 64
PREVIEW_CACHE_TTL_SECONDS = 7 * 24 * 3600
PREVIEW_PRUNE_INTERVAL_SECONDS = 3600
_last_preview_prune = 0.0


def _compute_resume_hash(resume: dict[str, Any]) -> str:
    serialized = json.dumps(resume, sort_keys=True, ensure_ascii=True)
    digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    # Bumping `PREVIEW_CACHE_VERSION` invalidates cached PDFs left behind by an
    # older renderer/theme version.
    return f"v{PREVIEW_CACHE_VERSION}-{digest}"


def _preview_pdf_response(pdf_path: Path, theme: str) -> FileResponse:
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        content_disposition_type="inline",
        filename=f"master-resume-{theme}.pdf",
        headers={"Cache-Control": "no-store"},
    )


def _prune_preview_cache(preview_root: Path) -> None:
    """Drop stale/overflowing preview directories.

    Previews are content-addressed, so every edit creates a new directory. Run
    this opportunistically (at most once per hour) instead of keeping an
    unbounded tree of personal PDFs on disk.
    """
    global _last_preview_prune
    now = time.monotonic()
    if now - _last_preview_prune < PREVIEW_PRUNE_INTERVAL_SECONDS:
        return
    _last_preview_prune = now

    try:
        entries = sorted(
            (entry for entry in preview_root.iterdir() if entry.is_dir()),
            key=lambda entry: entry.stat().st_mtime,
            reverse=True,
        )
    except OSError:
        return

    cutoff = time.time() - PREVIEW_CACHE_TTL_SECONDS
    for index, entry in enumerate(entries):
        try:
            if index >= PREVIEW_CACHE_MAX_DIRS or entry.stat().st_mtime < cutoff:
                shutil.rmtree(entry, ignore_errors=True)
        except OSError:
            continue


async def _handle_master_resume_preview(
    resume_payload: dict[str, Any] | None,
    theme: str | None,
    container: ServiceContainer,
) -> FileResponse:
    effective_resume = resume_payload or container.master_resume
    if not effective_resume:
        raise AppError(
            "No master resume configured or master resume is empty.",
            code="resume_missing",
            status_code=400,
        )
    resolved_theme = container.theme_service.resolve(theme)
    resume_hash = _compute_resume_hash(effective_resume)

    preview_root = container.settings.artifacts_dir / "master-previews"
    preview_dir = preview_root / resume_hash
    pdf_path = preview_dir / f"{resolved_theme}.pdf"

    if pdf_path.is_file() and pdf_path.stat().st_size > 0:
        return _preview_pdf_response(pdf_path, resolved_theme)

    # Acquire concurrency semaphore to throttle Chromium processes
    async with container.render_semaphore:
        # Recheck cache after waiting for semaphore
        if pdf_path.is_file() and pdf_path.stat().st_size > 0:
            return _preview_pdf_response(pdf_path, resolved_theme)

        _prune_preview_cache(preview_root)
        preview_dir.mkdir(parents=True, exist_ok=True)
        # Use an isolated temporary directory so concurrent renders don't overwrite output.pdf
        with tempfile.TemporaryDirectory() as temp_dir_str:
            temp_dir = Path(temp_dir_str)
            rendered_path = await container.renderer.render(
                resume=effective_resume,
                theme=resolved_theme,
                output_dir=temp_dir,
            )
            if not rendered_path.is_file() or rendered_path.stat().st_size == 0:
                raise AppError(
                    f"Renderer produced no PDF output for theme {resolved_theme}",
                    code="render_failed",
                    status_code=500,
                )
            temp_target = preview_dir / f"{resolved_theme}.pdf.tmp.{uuid.uuid4().hex}"
            shutil.copyfile(rendered_path, temp_target)
            temp_target.replace(pdf_path)

    return _preview_pdf_response(pdf_path, resolved_theme)


@router.get("/api/v1/master-resume/preview-pdf")
async def get_master_resume_preview_pdf(
    theme: str | None = None,
    container: ServiceContainer = Depends(get_container),
) -> FileResponse:
    return await _handle_master_resume_preview(None, theme, container)


@router.post("/api/v1/master-resume/preview-pdf")
async def post_master_resume_preview_pdf(
    payload: MasterResumePreviewRequest | None = None,
    theme: str | None = None,
    container: ServiceContainer = Depends(get_container),
) -> FileResponse:
    effective_theme = payload.theme if (payload and payload.theme) else theme
    resume_data = payload.resume if payload else None
    return await _handle_master_resume_preview(resume_data, effective_theme, container)


def _encode_pdf(path: Path) -> str:
    """Read a rendered PDF and base64-encode it.

    Kept synchronous so the blocking file read can run in a worker thread
    instead of stalling the event loop.
    """
    return base64.b64encode(path.read_bytes()).decode("ascii")


@router.post(
    "/api/v1/render",
    status_code=status.HTTP_200_OK,
)
async def render_resume(
    payload: RenderRequest,
    container: ServiceContainer = Depends(get_container),
) -> RenderResponse:
    """Render an existing resume to PDF with a chosen theme.

    No LLM is involved, so a tailored resume can be re-styled or re-exported
    after the fact without re-running the tailoring pipeline.
    """
    resume_data = payload.resume if payload.resume is not None else container.master_resume
    if resume_data is None:
        raise AppError(
            "No resume supplied and no master resume is configured.",
            code="resume_missing",
            status_code=400,
        )

    theme = container.theme_service.resolve(payload.theme)
    container.validator.validate(resume_data, context="render resume")

    # Render into a scratch directory: ResumeRenderer writes both resume.json
    # and output.pdf into the directory it is given, so it must never be pointed
    # at a caller's artifact directory.
    async with container.render_semaphore:
        with tempfile.TemporaryDirectory(prefix="resume-render-") as scratch_dir:
            pdf_path = await container.renderer.render(
                resume=resume_data,
                theme=theme,
                output_dir=Path(scratch_dir),
            )
            pdf_base64 = await asyncio.to_thread(_encode_pdf, Path(pdf_path))

    return RenderResponse(
        theme=theme,
        pdf_base64=pdf_base64,
        plain_text=json_to_ats_text(resume_data),
    )


@router.post(
    "/api/v1/tailor",
    response_model=TailorResponse | QueuedTaskResponse,
    status_code=status.HTTP_200_OK,
)
async def tailor_resume(
    payload: TailorRequest,
    response: Response,
    container: ServiceContainer = Depends(get_container),
) -> TailorResponse | QueuedTaskResponse:
    if payload.resume is None:
        if not container.master_resume:
            raise HTTPException(status_code=400, detail="No resume provided and no master resume configured or valid")
        resume_data = container.master_resume
    else:
        resume_data = payload.resume

    effective_model = payload.model or container.settings.strategy_and_basics_model
    if not effective_model or effective_model == "default":
        raise HTTPException(
            status_code=400,
            detail="No model configured. Specify model in request payload or configure DEFAULT_MODEL in settings.",
        )

    # Create a new payload with the resolved resume to pass to the async job runner if needed
    effective_payload = TailorRequest(
        resume=resume_data,
        job_description=payload.job_description,
        theme=payload.theme,
        callback_url=payload.callback_url,
        sections=payload.sections,
        model=payload.model,
        api_key=payload.api_key,
        api_base=payload.api_base,
        style=payload.style,
        custom_instructions=payload.custom_instructions,
        pipeline_mode=payload.pipeline_mode,
        enable_final_check=payload.enable_final_check,
        final_check_model=payload.final_check_model,
        prompt_templates=payload.prompt_templates,
    )

    theme = container.theme_service.resolve(payload.theme)
    if payload.callback_url:
        task_id = await container.job_runner.submit(effective_payload, theme)
        response.status_code = status.HTTP_202_ACCEPTED
        return QueuedTaskResponse(task_id=task_id, status="queued")

    result = await container.orchestrator.run(
        resume=resume_data,
        job_description=payload.job_description,
        theme=theme,
        sections=payload.sections,
        model=payload.model,
        api_key=payload.api_key,
        api_base=payload.api_base,
        style=payload.style,
        custom_instructions=payload.custom_instructions,
        pipeline_mode=payload.pipeline_mode,
        enable_final_check=payload.enable_final_check,
        final_check_model=payload.final_check_model,
        prompt_templates=payload.prompt_templates,
    )
    return TailorResponse(resume=result.resume, pdf_base64=result.pdf_base64, theme=result.theme, plain_text=result.plain_text)


@router.post(
    "/api/v1/copilot/outreach",
    response_model=CopilotOutreachResponse,
    status_code=status.HTTP_200_OK,
)
async def copilot_outreach(
    payload: CopilotOutreachRequest,
    container: ServiceContainer = Depends(get_container),
) -> CopilotOutreachResponse:
    resume_data = payload.resume or container.master_resume
    if not resume_data:
        raise HTTPException(status_code=400, detail="No resume provided and no master resume configured or valid")

    if not (payload.model or container.settings.strategy_and_basics_model):
        raise HTTPException(
            status_code=400,
            detail="No model configured. Specify model in request payload or configure DEFAULT_MODEL in settings.",
        )

    result = await container.copilot_service.generate_outreach(
        resume=resume_data,
        tailored_resume=payload.tailored_resume,
        job_description=payload.job_description,
        job_title=payload.job_title,
        company=payload.company,
        persona=payload.persona,
        model=payload.model,
        api_key=payload.api_key,
        api_base=payload.api_base,
        constraints=payload.constraints,
        stop_slop=payload.stop_slop,
        system_prompt_template=payload.system_prompt_template,
    )
    return CopilotOutreachResponse(
        linkedin_note_free=result.linkedin_note_free,
        linkedin_note_premium=result.linkedin_note_premium,
        inmail_subject=result.inmail_subject,
        inmail_body=result.inmail_body,
        key_match_points=result.key_match_points,
        validation_warning=result.validation_warning,
    )


@router.post(
    "/api/v1/copilot/qa",
    response_model=CopilotQAResponse,
    status_code=status.HTTP_200_OK,
)
async def copilot_qa(
    payload: CopilotQARequest,
    container: ServiceContainer = Depends(get_container),
) -> CopilotQAResponse:
    resume_data = payload.resume or container.master_resume
    if not resume_data:
        raise HTTPException(status_code=400, detail="No resume provided and no master resume configured or valid")

    if not (payload.model or container.settings.strategy_and_basics_model):
        raise HTTPException(
            status_code=400,
            detail="No model configured. Specify model in request payload or configure DEFAULT_MODEL in settings.",
        )

    result = await container.copilot_service.generate_qa(
        question=payload.question,
        resume=resume_data,
        tailored_resume=payload.tailored_resume,
        job_description=payload.job_description,
        job_title=payload.job_title,
        company=payload.company,
        model=payload.model,
        api_key=payload.api_key,
        api_base=payload.api_base,
        constraints=payload.constraints,
        stop_slop=payload.stop_slop,
        system_prompt_template=payload.system_prompt_template,
    )
    return CopilotQAResponse(
        question=payload.question,
        answer=result.answer,
        situation=result.situation,
        task=result.task,
        action=result.action,
        result=result.result,
        knockout_warning=result.knockout_warning,
        validation_warning=result.validation_warning,
    )


@router.post(
    "/api/v1/copilot/cover-letter",
    response_model=CopilotCoverLetterResponse,
    status_code=status.HTTP_200_OK,
)
async def copilot_cover_letter(
    payload: CopilotCoverLetterRequest,
    container: ServiceContainer = Depends(get_container),
) -> CopilotCoverLetterResponse:
    resume_data = payload.resume or container.master_resume
    if not resume_data:
        raise HTTPException(status_code=400, detail="No resume provided and no master resume configured or valid")

    if not (payload.model or container.settings.strategy_and_basics_model):
        raise HTTPException(
            status_code=400,
            detail="No model configured. Specify model in request payload or configure DEFAULT_MODEL in settings.",
        )

    result = await container.copilot_service.generate_cover_letter(
        resume=resume_data,
        tailored_resume=payload.tailored_resume,
        job_description=payload.job_description,
        job_title=payload.job_title,
        company=payload.company,
        model=payload.model,
        api_key=payload.api_key,
        api_base=payload.api_base,
        constraints=payload.constraints,
        stop_slop=payload.stop_slop,
        system_prompt_template=payload.system_prompt_template,
    )
    full_letter = f"{result.paragraph_1}\n\n{result.paragraph_2}\n\n{result.paragraph_3}"
    word_count = len(full_letter.split())
    return CopilotCoverLetterResponse(
        cover_letter=full_letter,
        paragraph_1=result.paragraph_1,
        paragraph_2=result.paragraph_2,
        paragraph_3=result.paragraph_3,
        word_count=word_count,
        validation_warning=result.validation_warning,
    )


@router.get("/api/v1/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    container: ServiceContainer = Depends(get_container),
) -> TaskStatusResponse:
    job = await container.job_store.get_or_raise(task_id)
    error = None
    if job.error_code and job.error_message:
        error = TaskError(code=job.error_code, message=job.error_message)
    pdf_base64 = None
    if job.result_pdf_path:
        pdf_base64 = await container.orchestrator.encode_pdf(job.result_pdf_path)
    plain_text = None
    if job.result_resume_json:
        plain_text = json_to_ats_text(job.result_resume_json)
    return TaskStatusResponse(
        task_id=job.id,
        status=job.status,
        created_at=job.created_at,
        updated_at=job.updated_at,
        resume=job.result_resume_json,
        pdf_base64=pdf_base64,
        plain_text=plain_text,
        error=error,
        theme=job.theme,
    )


@router.post("/api/v1/test-llm", response_model=TestLlmResponse)
async def test_llm_connection(payload: TestLlmRequest) -> TestLlmResponse:
    start_time = time.perf_counter()
    model = payload.model
    if model == "openrouter/free":
        model = "openrouter/openrouter/free"
    elif model == "openrouter/auto":
        model = "openrouter/openrouter/auto"

    kwargs = {
        "model": model,
        "messages": [{"role": "user", "content": "Reply with OK"}],
        "max_tokens": 5,
        "timeout": 15,
    }
    if payload.api_key:
        kwargs["api_key"] = payload.api_key
    if payload.api_base:
        parsed = urlparse(payload.api_base)
        host = (parsed.hostname or "").lower()
        is_loopback = host in ("localhost", "127.0.0.1", "::1", "0.0.0.0")
        if payload.api_key and parsed.scheme != "https" and not is_loopback:
            return TestLlmResponse(
                success=False,
                model=payload.model,
                error="HTTPS is required for remote api_base endpoints when an API key is provided",
            )
        try:
            assert_safe_url(payload.api_base)
        except Exception as e:
            return TestLlmResponse(success=False, model=payload.model, error=str(e))
        kwargs["api_base"] = payload.api_base
    elif (payload.model or "").startswith("openrouter/"):
        kwargs["api_base"] = "https://openrouter.ai/api/v1"

    try:
        await acompletion(**kwargs)
        duration_ms = int((time.perf_counter() - start_time) * 1000)
        return TestLlmResponse(
            success=True,
            latencyMs=duration_ms,
            model=payload.model,
            message=f"Connected successfully to {payload.model} ({duration_ms}ms)",
        )
    except Exception as e:
        duration_ms = int((time.perf_counter() - start_time) * 1000)
        return TestLlmResponse(
            success=False,
            latencyMs=duration_ms,
            model=payload.model,
            error=str(e),
        )

