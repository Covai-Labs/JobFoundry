from __future__ import annotations

import base64
import uuid
from pathlib import Path

from resume_ops_api.graph.models import TailorResult
from resume_ops_api.graph.pipeline import ResumeGraph
from resume_ops_api.graph.state import ResumeGraphState
from resume_ops_api.services.ats_text import json_to_ats_text
from resume_ops_api.services.schema import ResumeSchemaValidator


class TailorOrchestrator:
    def __init__(self, *, graph: ResumeGraph, validator: ResumeSchemaValidator, jobs_dir: Path) -> None:
        self.graph = graph
        self.validator = validator
        self.jobs_dir = jobs_dir

    async def run(
        self,
        *,
        resume: dict,
        job_description: str,
        theme: str,
        task_id: str | None = None,
        sections: list[str] | None = None,
        model: str | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
        style: str | None = None,
        custom_instructions: str | None = None,
        pipeline_mode: str | None = None,
        enable_final_check: bool = False,
        final_check_model: str | None = None,
        prompt_templates: dict[str, str] | None = None,
    ) -> TailorResult:
        self.validator.validate(resume, context="input resume")
        job_id = task_id or uuid.uuid4().hex
        output_dir = self.jobs_dir / job_id
        output_dir.mkdir(parents=True, exist_ok=True)
        state: ResumeGraphState = {
            "original_resume": resume,
            "job_description": job_description,
            "theme": theme,
            "job_id": job_id,
            "output_dir": output_dir,
            "enable_final_check": enable_final_check,
        }
        if sections is not None:
            state["sections"] = sections
        if model is not None:
            state["model"] = model
        if api_key is not None:
            state["api_key"] = api_key
        if api_base is not None:
            state["api_base"] = api_base
        if style is not None:
            state["style"] = style
        if custom_instructions is not None:
            state["custom_instructions"] = custom_instructions
        if pipeline_mode is not None:
            state["pipeline_mode"] = pipeline_mode
        if final_check_model is not None:
            state["final_check_model"] = final_check_model
        if prompt_templates is not None:
            state["prompt_templates"] = prompt_templates
        final_state = await self.graph.run(state)
        pdf_path = final_state["pdf_path"]
        pdf_base64 = await self.encode_pdf(pdf_path)
        plain_text = json_to_ats_text(final_state["final_resume"])
        return TailorResult(
            resume=final_state["final_resume"],
            pdf_path=pdf_path,
            pdf_base64=pdf_base64,
            theme=theme,
            plain_text=plain_text,
        )

    async def encode_pdf(self, pdf_path: str) -> str:
        return base64.b64encode(Path(pdf_path).read_bytes()).decode("ascii")

