from __future__ import annotations

from pathlib import Path
from typing import Any
import pytest

from resume_ops_api.graph import prompts
from resume_ops_api.graph.merge import ResumeMerger
from resume_ops_api.graph.pipeline import ResumeGraph
from resume_ops_api.graph.state import ResumeGraphState
from resume_ops_api.services.schema import ResumeSchemaValidator
from tests.conftest import FakeStructuredLLMClient, FakeRenderer


@pytest.fixture
def sample_resume() -> dict[str, Any]:
    return {
        "basics": {
            "name": "Alex Mercer",
            "label": "Engineering Generalist",
            "summary": "Original summary.",
        },
        "work": [
            {
                "name": "Foundry Tech",
                "position": "Lead Architect",
                "startDate": "2021-01-01",
                "summary": "Led cloud migrations.",
                "highlights": ["Built distributed relay system."],
            },
        ],
        "skills": [
            {
                "name": "Backend Development",
                "keywords": ["Python", "FastAPI"],
            }
        ],
        "projects": [
            {
                "name": "Chat Exporter",
                "description": "Chrome extension exporter",
                "highlights": ["Exported 10k transcripts"],
            }
        ],
        "education": [
            {
                "institution": "University of Tech",
                "studyType": "B.S.",
                "area": "Computer Science",
            }
        ],
        "certificates": [
            {"name": "AWS Solutions Architect"}
        ],
    }


@pytest.fixture
def validator() -> ResumeSchemaValidator:
    schema_path = Path(__file__).resolve().parent.parent / "src" / "resume_ops_api" / "resources" / "resume_schema.json"
    return ResumeSchemaValidator(schema_path)


class TestPromptsCustomInstructions:
    def test_apply_style_appends_custom_instructions(self) -> None:
        base = "You are tailoring a resume."
        res = prompts._apply_style(base, style="British English", custom_instructions="Avoid em dashes. Drop courses.")
        assert "British English" in res
        assert "Avoid em dashes. Drop courses." in res
        assert "USER CUSTOM INSTRUCTIONS & CANDIDATE GUIDELINES" in res

    def test_strategy_and_basics_prompt_supports_custom_template(self, sample_resume: dict[str, Any]) -> None:
        system, user = prompts.strategy_and_basics_prompt(
            resume=sample_resume,
            job_description="Senior Python Lead",
            custom_instructions="Be concise and candid.",
            custom_template="Custom strategy template for candidate.",
        )
        assert "Custom strategy template for candidate." in system
        assert "Be concise and candid." in system
        assert "Senior Python Lead" in user

    def test_work_prompt_with_basics_cascade_context(self, sample_resume: dict[str, Any]) -> None:
        strategy = {"target_narrative": "Lead Engineer", "priority_keywords": ["Python"]}
        basics_context = {"label": "Hands-on Technical Generalist", "summary": "Ships software."}
        system, user = prompts.work_prompt(
            resume=sample_resume,
            job_description="Staff Engineer",
            strategy=strategy,
            custom_instructions="Avoid em dashes.",
            basics_context=basics_context,
        )
        assert "Anchor Basics Narrative" in user
        assert "Hands-on Technical Generalist" in user
        assert "Avoid em dashes." in system

    def test_projects_prompt_with_work_cascade_context(self, sample_resume: dict[str, Any]) -> None:
        strategy = {"target_narrative": "Lead Engineer", "priority_keywords": ["Python"]}
        work_context = [{"summary": "Led distributed relay", "highlights": ["Reduced latency 40%"]}]
        system, user = prompts.projects_prompt(
            resume=sample_resume,
            job_description="Staff Engineer",
            strategy=strategy,
            custom_instructions="Drop keywords under projects.",
            work_context=work_context,
        )
        assert "CROSS-SECTION COHERENCE RULE (SEQUENTIAL CASCADE)" in system
        assert "Tailored Work Experience Context" in user
        assert "Drop keywords under projects." in system

    def test_qualifications_prompt_with_context(self, sample_resume: dict[str, Any]) -> None:
        strategy = {"target_narrative": "Lead Engineer", "priority_keywords": ["Python"]}
        system, user = prompts.qualifications_prompt(
            resume=sample_resume,
            job_description="Staff Engineer",
            strategy=strategy,
            custom_instructions="Drop courses under education.",
            work_context=[{"name": "Foundry Tech"}],
            projects_context=[{"name": "Chat Exporter"}],
        )
        assert "Demonstrated Work Experience Context" in user
        assert "Demonstrated Projects Context" in user
        assert "Drop courses under education." in system

    def test_monolithic_and_final_check_prompts(self, sample_resume: dict[str, Any]) -> None:
        mono_sys, mono_usr = prompts.monolithic_prompt(
            resume=sample_resume,
            job_description="Principal Engineer",
            custom_instructions="British English",
        )
        assert "Return structured JSON matching FullResumeTailoringOutput" in mono_sys
        assert "British English" in mono_sys

        crit_sys, crit_usr = prompts.final_check_prompt(
            final_resume=sample_resume,
            original_resume=sample_resume,
            job_description="Principal Engineer",
            custom_instructions="Verify zero hallucination and no em dashes",
        )
        assert "Lead Resume Quality Auditor" in crit_sys
        assert "Verify zero hallucination and no em dashes" in crit_sys


class TestResumeGraphTopologies:
    @pytest.mark.asyncio
    async def test_sequential_cascade_execution_default(self, sample_resume: dict[str, Any], validator: ResumeSchemaValidator, tmp_path: Path) -> None:
        client = FakeStructuredLLMClient(sample_resume)
        graph = ResumeGraph(
            llm_client=client,
            merger=ResumeMerger(),
            renderer=FakeRenderer(),
            validator=validator,
        )

        state: ResumeGraphState = {
            "original_resume": sample_resume,
            "job_description": "Senior Platform Engineer",
            "theme": "jsonresume-theme-folio",
            "job_id": "seq-test-1",
            "output_dir": tmp_path,
            "pipeline_mode": "sequential",
            "custom_instructions": "British English, no em dashes",
        }

        final_state = await graph.run(state)
        assert "final_resume" in final_state
        assert "pdf_path" in final_state
        assert Path(final_state["pdf_path"]).exists()

    @pytest.mark.asyncio
    async def test_parallel_execution_mode(self, sample_resume: dict[str, Any], validator: ResumeSchemaValidator, tmp_path: Path) -> None:
        client = FakeStructuredLLMClient(sample_resume)
        graph = ResumeGraph(
            llm_client=client,
            merger=ResumeMerger(),
            renderer=FakeRenderer(),
            validator=validator,
        )

        state: ResumeGraphState = {
            "original_resume": sample_resume,
            "job_description": "Senior Platform Engineer",
            "theme": "jsonresume-theme-folio",
            "job_id": "par-test-1",
            "output_dir": tmp_path,
            "pipeline_mode": "parallel",
        }

        final_state = await graph.run(state)
        assert "final_resume" in final_state
        assert "pdf_path" in final_state

    @pytest.mark.asyncio
    async def test_monolithic_execution_mode(self, sample_resume: dict[str, Any], validator: ResumeSchemaValidator, tmp_path: Path) -> None:
        client = FakeStructuredLLMClient(sample_resume)
        graph = ResumeGraph(
            llm_client=client,
            merger=ResumeMerger(),
            renderer=FakeRenderer(),
            validator=validator,
        )

        state: ResumeGraphState = {
            "original_resume": sample_resume,
            "job_description": "Senior Platform Engineer",
            "theme": "jsonresume-theme-folio",
            "job_id": "mono-test-1",
            "output_dir": tmp_path,
            "pipeline_mode": "monolithic",
        }

        final_state = await graph.run(state)
        assert "final_resume" in final_state
        assert final_state["final_resume"]["basics"]["label"] == "Monolithic Headline"

    @pytest.mark.asyncio
    async def test_final_check_critic_node(self, sample_resume: dict[str, Any], validator: ResumeSchemaValidator, tmp_path: Path) -> None:
        client = FakeStructuredLLMClient(sample_resume)
        graph = ResumeGraph(
            llm_client=client,
            merger=ResumeMerger(),
            renderer=FakeRenderer(),
            validator=validator,
        )

        state: ResumeGraphState = {
            "original_resume": sample_resume,
            "job_description": "Senior Platform Engineer",
            "theme": "jsonresume-theme-folio",
            "job_id": "critic-test-1",
            "output_dir": tmp_path,
            "pipeline_mode": "sequential",
            "enable_final_check": True,
        }

        final_state = await graph.run(state)
        assert "final_resume" in final_state
        # Critic updated label to "Critic Polished Headline"
        assert final_state["final_resume"]["basics"]["label"] == "Critic Polished Headline"

    @pytest.mark.asyncio
    async def test_final_check_critic_graceful_fallback_on_error(self, sample_resume: dict[str, Any], validator: ResumeSchemaValidator, tmp_path: Path) -> None:
        # Critic model fails; graph must smoothly degrade and keep merged resume intact
        client = FakeStructuredLLMClient(sample_resume, fail_model="failing-critic-model")
        graph = ResumeGraph(
            llm_client=client,
            merger=ResumeMerger(),
            renderer=FakeRenderer(),
            validator=validator,
        )

        state: ResumeGraphState = {
            "original_resume": sample_resume,
            "job_description": "Senior Platform Engineer",
            "theme": "jsonresume-theme-folio",
            "job_id": "critic-fail-test",
            "output_dir": tmp_path,
            "pipeline_mode": "sequential",
            "enable_final_check": True,
            "final_check_model": "failing-critic-model",
        }

        final_state = await graph.run(state)
        assert "final_resume" in final_state
        # Resume rendered without crashing despite critic failure
        assert "pdf_path" in final_state
