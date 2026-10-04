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
            active_sections=["basics", "work"],
        )
        assert "Return structured JSON matching FullResumeTailoringOutput" in mono_sys
        assert "British English" in mono_sys
        assert "Principal Engineer" in mono_usr
        assert "Only tailor these selected sections: basics, work" in mono_usr

        crit_sys, crit_usr = prompts.final_check_prompt(
            final_resume=sample_resume,
            original_resume=sample_resume,
            job_description="Principal Engineer",
            custom_instructions="Verify zero hallucination and no em dashes",
        )
        assert "Lead Resume Quality Auditor" in crit_sys
        assert "Verify zero hallucination and no em dashes" in crit_sys
        assert "Principal Engineer" in crit_usr


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

    @pytest.mark.asyncio
    async def test_monolithic_omitted_projects_preserves_original(
        self, sample_resume: dict[str, Any], validator: ResumeSchemaValidator, tmp_path: Path
    ) -> None:
        # Resume has projects, and mock LLM omits projects in monolithic mode
        resume_with_omit = dict(sample_resume)
        resume_with_omit["_omit_projects_in_monolithic"] = True
        client = FakeStructuredLLMClient(resume_with_omit)
        graph = ResumeGraph(
            llm_client=client,
            merger=ResumeMerger(),
            renderer=FakeRenderer(),
            validator=validator,
        )

        state: ResumeGraphState = {
            "original_resume": resume_with_omit,
            "job_description": "Principal Engineer",
            "theme": "jsonresume-theme-folio",
            "job_id": "mono-omit-proj-test",
            "output_dir": tmp_path,
            "pipeline_mode": "monolithic",
        }

        final_state = await graph.run(state)
        assert "final_resume" in final_state
        # Verify original projects were NOT erased
        original_proj_names = [p["name"] for p in sample_resume.get("projects", [])]
        final_proj_names = [p["name"] for p in final_state["final_resume"].get("projects", [])]
        assert final_proj_names == original_proj_names

    def test_work_prompt_preserves_alignment_rules_with_custom_template(self, sample_resume: dict[str, Any]) -> None:
        system, _ = prompts.work_prompt(
            resume=sample_resume,
            job_description="Staff Engineer",
            strategy={"target_narrative": "Lead", "priority_keywords": []},
            custom_template="Write strong action verbs for every role.",
        )
        assert "Write strong action verbs for every role." in system
        assert "WORK OUTPUT ALIGNMENT:" in system
        assert "Return exactly one work entry for each input entry, in the same order." in system

    @pytest.mark.asyncio
    async def test_critic_model_resolution_hierarchy(
        self, sample_resume: dict[str, Any], validator: ResumeSchemaValidator, tmp_path: Path
    ) -> None:
        # LLM client records the model used
        class RecordingLLMClient(FakeStructuredLLMClient):
            def __init__(self, resume: dict[str, Any]) -> None:
                super().__init__(resume)
                self.models_called: list[str] = []

            async def generate_structured(self, **kwargs: Any) -> Any:
                self.models_called.append(kwargs.get("model", ""))
                return await super().generate_structured(**kwargs)

        client = RecordingLLMClient(sample_resume)
        graph = ResumeGraph(
            llm_client=client,
            merger=ResumeMerger(),
            renderer=FakeRenderer(),
            validator=validator,
        )

        # 1. When request specifies model="request-custom-model" and no final_check_model, critic should use request model
        state: ResumeGraphState = {
            "original_resume": sample_resume,
            "job_description": "Senior Platform Engineer",
            "theme": "jsonresume-theme-folio",
            "job_id": "critic-model-test",
            "output_dir": tmp_path,
            "pipeline_mode": "sequential",
            "model": "request-custom-model",
            "enable_final_check": True,
        }
        await graph.run(state)
        assert "request-custom-model" in client.models_called

    @pytest.mark.asyncio
    async def test_queued_job_runner_forwards_all_custom_options(self, sample_resume: dict[str, Any]) -> None:
        from unittest.mock import AsyncMock, MagicMock
        from resume_ops_api.services.jobs import AsyncJobRunner
        from resume_ops_api.graph.models import TailorResult

        mock_orchestrator = AsyncMock()
        mock_orchestrator.run.return_value = TailorResult(
            resume=sample_resume,
            pdf_path="/tmp/fake.pdf",
            pdf_base64="fake-base64",
            theme="jsonresume-theme-folio",
            plain_text="Plain text resume",
        )
        mock_job = MagicMock()
        mock_job.id = "job-queued-1"
        mock_job.theme = "jsonresume-theme-folio"
        mock_job.callback_url = None
        mock_job.request_payload = {
            "resume": sample_resume,
            "job_description": "Staff Engineer",
            "custom_instructions": "British English",
            "pipeline_mode": "sequential",
            "enable_final_check": True,
            "final_check_model": "gpt-4o-critic",
            "prompt_templates": {"work": "Custom work prompt"},
        }
        mock_store = AsyncMock()
        mock_store.get_or_raise.return_value = mock_job
        runner = AsyncJobRunner(
            store=mock_store,
            orchestrator=mock_orchestrator,
            callback_service=AsyncMock(),
            max_concurrency=1,
        )

        await runner._run_job("job-queued-1")
        assert mock_orchestrator.run.called
        call_kwargs = mock_orchestrator.run.call_args.kwargs
        assert call_kwargs["custom_instructions"] == "British English"
        assert call_kwargs["pipeline_mode"] == "sequential"
        assert call_kwargs["enable_final_check"] is True
        assert call_kwargs["final_check_model"] == "gpt-4o-critic"
        assert call_kwargs["prompt_templates"] == {"work": "Custom work prompt"}
