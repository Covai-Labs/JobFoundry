from __future__ import annotations

import base64
import copy
import json
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from httpx import ASGITransport, AsyncClient

from resume_ops_api.api.app import create_app
from resume_ops_api.core.config import Settings
from resume_ops_api.core.exceptions import AppError
from resume_ops_api.services.ats_text import json_to_ats_text

from tests.conftest import FakeCallbackService, FakeRenderer, FakeStructuredLLMClient


class RecordingRenderer(FakeRenderer):
    def __init__(self) -> None:
        self.calls: list[dict] = []

    async def render(self, *, resume: dict, theme: str, output_dir: Path) -> Path:
        self.calls.append({"resume": resume, "theme": theme, "output_dir": output_dir})
        return await super().render(resume=resume, theme=theme, output_dir=output_dir)


class FailingRenderer:
    async def render(self, *, resume: dict, theme: str, output_dir: Path) -> Path:
        raise AppError("PDF rendering failed.", code="render_failed", status_code=500)


@asynccontextmanager
async def _client_for(
    settings: Settings,
    sample_resume: dict,
    renderer: object,
) -> AsyncIterator[AsyncClient]:
    app = create_app(
        settings,
        llm_client=FakeStructuredLLMClient(sample_resume),
        renderer=renderer,
        callback_service=FakeCallbackService(),
    )
    async with app.router.lifespan_context(app):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            yield client


async def test_render_returns_pdf_and_ats_text(client: AsyncClient, sample_resume: dict) -> None:
    response = await client.post("/api/v1/render", json={"resume": sample_resume})

    assert response.status_code == 200
    payload = response.json()
    assert payload["theme"] == "jsonresume-theme-stackoverflow"
    assert base64.b64decode(payload["pdf_base64"]).startswith(b"%PDF-")
    assert payload["plain_text"] == json_to_ats_text(sample_resume)
    assert sample_resume["basics"]["name"] in payload["plain_text"]


async def test_render_uses_requested_theme(client: AsyncClient, sample_resume: dict) -> None:
    response = await client.post(
        "/api/v1/render",
        json={"resume": sample_resume, "theme": "jsonresume-theme-even"},
    )

    assert response.status_code == 200
    assert response.json()["theme"] == "jsonresume-theme-even"


async def test_render_rejects_disallowed_theme(client: AsyncClient, sample_resume: dict) -> None:
    response = await client.post(
        "/api/v1/render",
        json={"resume": sample_resume, "theme": "jsonresume-theme-nonexistent"},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "invalid_theme"


async def test_render_rejects_structurally_invalid_resume(
    client: AsyncClient, sample_resume: dict
) -> None:
    invalid_resume = copy.deepcopy(sample_resume)
    invalid_resume["work"] = "not-a-list"

    response = await client.post("/api/v1/render", json={"resume": invalid_resume})

    assert response.status_code == 422
    assert response.json()["code"] == "resume_validation_failed"


async def test_render_falls_back_to_master_resume(settings: Settings, sample_resume: dict) -> None:
    master_path = settings.data_dir / "master-resume.json"
    master_path.parent.mkdir(parents=True, exist_ok=True)
    master_path.write_text(json.dumps(sample_resume), encoding="utf-8")
    render_settings = settings.model_copy(update={"master_resume_path": master_path})

    async with _client_for(render_settings, sample_resume, FakeRenderer()) as client:
        response = await client.post("/api/v1/render", json={})

    assert response.status_code == 200
    assert base64.b64decode(response.json()["pdf_base64"]).startswith(b"%PDF-")


async def test_render_requires_resume_when_no_master_configured(
    client: AsyncClient,
) -> None:
    response = await client.post("/api/v1/render", json={})

    assert response.status_code == 400
    assert "master resume" in response.json()["detail"]


async def test_render_cleans_up_temp_dir_and_forwards_arguments(
    settings: Settings, sample_resume: dict
) -> None:
    renderer = RecordingRenderer()

    async with _client_for(settings, sample_resume, renderer) as client:
        response = await client.post(
            "/api/v1/render",
            json={"resume": sample_resume, "theme": "jsonresume-theme-even"},
        )

    assert response.status_code == 200
    assert len(renderer.calls) == 1
    call = renderer.calls[0]
    assert call["resume"] == sample_resume
    assert call["theme"] == "jsonresume-theme-even"
    assert not call["output_dir"].exists()


async def test_render_reports_renderer_failure(settings: Settings, sample_resume: dict) -> None:
    async with _client_for(settings, sample_resume, FailingRenderer()) as client:
        response = await client.post("/api/v1/render", json={"resume": sample_resume})

    assert response.status_code == 500
    assert response.json()["code"] == "render_failed"
