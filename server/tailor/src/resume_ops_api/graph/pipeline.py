from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from langgraph.graph import END, START, StateGraph

from resume_ops_api.core.exceptions import AppError
from resume_ops_api.graph import prompts
from resume_ops_api.graph.merge import ResumeMerger
from resume_ops_api.graph.models import (
    BasicsTailoringOutput,
    FinalCheckCriticOutput,
    FullResumeTailoringOutput,
    ProjectsTailoringOutput,
    QualificationsTailoringOutput,
    StrategyAndBasicsOutput,
    StrategyOutput,
    WorkTailoringOutput,
)
from resume_ops_api.graph.state import ResumeGraphState
from resume_ops_api.services.llm import StructuredLLMClient
from resume_ops_api.services.renderer import ResumeRenderer
from resume_ops_api.services.schema import ResumeSchemaValidator

logger = logging.getLogger(__name__)

DEFAULT_SECTIONS = ["basics", "work", "skills", "projects", "education", "certificates"]


def route_after_merge(state: ResumeGraphState) -> str:
    if state.get("enable_final_check"):
        return "final_check"
    return "render"


class ResumeGraph:
    def __init__(
        self,
        *,
        llm_client: StructuredLLMClient,
        merger: ResumeMerger,
        renderer: ResumeRenderer,
        validator: ResumeSchemaValidator,
        strategy_and_basics_model: str | None = None,
        strategy_model: str | None = None,
        work_model: str | None = None,
        qualifications_model: str | None = None,
        education_model: str | None = None,
        skills_model: str | None = None,
        projects_model: str | None = None,
        certificates_model: str | None = None,
        optional_sections_model: str | None = None,
        basics_model: str | None = None,
        final_check_model: str | None = None,
        monolithic_model: str | None = None,
        style: str | None = None,
        default_sections: list[str] | None = None,
    ) -> None:
        self.llm_client = llm_client
        self.merger = merger
        self.renderer = renderer
        self.validator = validator
        self.strategy_and_basics_model = (
            strategy_and_basics_model
            or strategy_model
            or basics_model
            or "default"
        )
        self.work_model = work_model or "default"
        self.qualifications_model = (
            qualifications_model
            or skills_model
            or certificates_model
            or education_model
            or "default"
        )
        self.projects_model = projects_model or "default"
        self.monolithic_model = monolithic_model or "default"
        self.final_check_model = final_check_model or "default"
        self.style = style
        self.default_sections = default_sections or list(DEFAULT_SECTIONS)

        # 1. Sequential Cascade Graph (Default): strategy -> work -> projects -> qualifications -> merge -> [final_check] -> render
        seq_graph = StateGraph(ResumeGraphState)
        seq_graph.add_node("strategy_and_basics", self.strategy_and_basics_node)
        seq_graph.add_node("work_tailoring", self.work_node)
        seq_graph.add_node("projects_tailoring", self.projects_node)
        seq_graph.add_node("qualifications_tailoring", self.qualifications_node)
        seq_graph.add_node("merge", self.merge_node)
        seq_graph.add_node("final_check", self.final_check_node)
        seq_graph.add_node("render", self.render_node)

        seq_graph.add_edge(START, "strategy_and_basics")
        seq_graph.add_edge("strategy_and_basics", "work_tailoring")
        seq_graph.add_edge("work_tailoring", "projects_tailoring")
        seq_graph.add_edge("projects_tailoring", "qualifications_tailoring")
        seq_graph.add_edge("qualifications_tailoring", "merge")
        seq_graph.add_conditional_edges("merge", route_after_merge, {"final_check": "final_check", "render": "render"})
        seq_graph.add_edge("final_check", "render")
        seq_graph.add_edge("render", END)
        self._compiled_sequential = seq_graph.compile()

        # 2. Parallel Fan-out Graph: strategy -> [work, qualifications, projects] -> merge -> [final_check] -> render
        par_graph = StateGraph(ResumeGraphState)
        par_graph.add_node("strategy_and_basics", self.strategy_and_basics_node)
        par_graph.add_node("work_tailoring", self.work_node)
        par_graph.add_node("qualifications_tailoring", self.qualifications_node)
        par_graph.add_node("projects_tailoring", self.projects_node)
        par_graph.add_node("merge", self.merge_node)
        par_graph.add_node("final_check", self.final_check_node)
        par_graph.add_node("render", self.render_node)

        par_graph.add_edge(START, "strategy_and_basics")
        par_graph.add_edge("strategy_and_basics", "work_tailoring")
        par_graph.add_edge("strategy_and_basics", "qualifications_tailoring")
        par_graph.add_edge("strategy_and_basics", "projects_tailoring")
        par_graph.add_edge("work_tailoring", "merge")
        par_graph.add_edge("qualifications_tailoring", "merge")
        par_graph.add_edge("projects_tailoring", "merge")
        par_graph.add_conditional_edges("merge", route_after_merge, {"final_check": "final_check", "render": "render"})
        par_graph.add_edge("final_check", "render")
        par_graph.add_edge("render", END)
        self._compiled_parallel = par_graph.compile()

        # 3. Monolithic Single-Pass Graph: monolithic_tailoring -> merge -> [final_check] -> render
        mono_graph = StateGraph(ResumeGraphState)
        mono_graph.add_node("monolithic_tailoring", self.monolithic_node)
        mono_graph.add_node("merge", self.merge_node)
        mono_graph.add_node("final_check", self.final_check_node)
        mono_graph.add_node("render", self.render_node)

        mono_graph.add_edge(START, "monolithic_tailoring")
        mono_graph.add_edge("monolithic_tailoring", "merge")
        mono_graph.add_conditional_edges("merge", route_after_merge, {"final_check": "final_check", "render": "render"})
        mono_graph.add_edge("final_check", "render")
        mono_graph.add_edge("render", END)
        self._compiled_monolithic = mono_graph.compile()

        # Keep default compiled property pointing to sequential
        self._compiled = self._compiled_sequential

    def _resolve_active_sections(self, state: ResumeGraphState) -> list[str]:
        return state.get("sections") or self.default_sections

    async def run(self, state: ResumeGraphState) -> ResumeGraphState:
        mode = state.get("pipeline_mode") or "sequential"
        if mode == "parallel":
            return await self._compiled_parallel.ainvoke(state)
        elif mode == "monolithic":
            return await self._compiled_monolithic.ainvoke(state)
        else:
            return await self._compiled_sequential.ainvoke(state)

    async def strategy_and_basics_node(self, state: ResumeGraphState) -> dict[str, Any]:
        active_sections = self._resolve_active_sections(state)
        tailor_basics = "basics" in active_sections
        effective_style = state.get("style") or self.style
        custom_instructions = state.get("custom_instructions")
        custom_template = (state.get("prompt_templates") or {}).get("strategy_and_basics")
        system, user = prompts.strategy_and_basics_prompt(
            resume=state["original_resume"],
            job_description=state["job_description"],
            style=effective_style,
            custom_instructions=custom_instructions,
            tailor_basics=tailor_basics,
            custom_template=custom_template,
        )
        output = await self.llm_client.generate_structured(
            model=state.get("model") or self.strategy_and_basics_model,
            system_prompt=system,
            user_prompt=user,
            response_model=StrategyAndBasicsOutput,
            session_id=state.get("job_id"),
            api_key=state.get("api_key"),
            api_base=state.get("api_base"),
        )
        if not tailor_basics:
            output = output.model_copy(update={"label": None, "summary": None})

        strategy = StrategyOutput(
            target_narrative=output.target_narrative,
            priority_keywords=output.priority_keywords,
            section_rules=output.section_rules,
            red_lines=output.red_lines,
        )
        res: dict[str, Any] = {
            "strategy_and_basics": output,
            "strategy": strategy,
        }
        if tailor_basics and (output.label is not None or output.summary is not None):
            res["tailored_basics"] = BasicsTailoringOutput(label=output.label, summary=output.summary)
        return res

    async def work_node(self, state: ResumeGraphState) -> dict[str, Any]:
        active_sections = self._resolve_active_sections(state)
        if "work" not in active_sections:
            return {}
        if not state["original_resume"].get("work"):
            return {"tailored_work": WorkTailoringOutput(work=[])}
        strategy_dict = state["strategy"].model_dump()
        effective_style = state.get("style") or self.style
        custom_instructions = state.get("custom_instructions")
        custom_template = (state.get("prompt_templates") or {}).get("work")
        basics_context = state["tailored_basics"].model_dump() if state.get("tailored_basics") else None

        system, user = prompts.work_prompt(
            resume=state["original_resume"],
            job_description=state["job_description"],
            strategy=strategy_dict,
            style=effective_style,
            custom_instructions=custom_instructions,
            custom_template=custom_template,
            basics_context=basics_context,
        )
        output = await self.llm_client.generate_structured(
            model=state.get("model") or self.work_model,
            system_prompt=system,
            user_prompt=user,
            response_model=WorkTailoringOutput,
            session_id=state.get("job_id"),
            validation_context={"original_resume": state["original_resume"]},
            api_key=state.get("api_key"),
            api_base=state.get("api_base"),
        )
        return {"tailored_work": output}

    async def projects_node(self, state: ResumeGraphState) -> dict[str, Any]:
        active_sections = self._resolve_active_sections(state)
        if "projects" not in active_sections:
            return {}
        if not state["original_resume"].get("projects"):
            return {"tailored_projects": ProjectsTailoringOutput(projects=[])}
        strategy_dict = state["strategy"].model_dump()
        effective_style = state.get("style") or self.style
        custom_instructions = state.get("custom_instructions")
        custom_template = (state.get("prompt_templates") or {}).get("projects")
        work_context = (
            [w.model_dump() for w in state["tailored_work"].work]
            if state.get("tailored_work")
            else None
        )

        system, user = prompts.projects_prompt(
            resume=state["original_resume"],
            job_description=state["job_description"],
            strategy=strategy_dict,
            style=effective_style,
            custom_instructions=custom_instructions,
            custom_template=custom_template,
            work_context=work_context,
        )
        output = await self.llm_client.generate_structured(
            model=state.get("model") or self.projects_model,
            system_prompt=system,
            user_prompt=user,
            response_model=ProjectsTailoringOutput,
            session_id=state.get("job_id"),
            validation_context={"original_resume": state["original_resume"]},
            api_key=state.get("api_key"),
            api_base=state.get("api_base"),
        )
        return {"tailored_projects": output}

    async def qualifications_node(self, state: ResumeGraphState) -> dict[str, Any]:
        active_sections = self._resolve_active_sections(state)
        qual_sections = {"skills", "certificates", "education"} & set(active_sections)
        if not qual_sections:
            return {}
        
        has_any_data = any(
            state["original_resume"].get(k)
            for k in ("skills", "certificates", "education")
            if k in qual_sections
        )
        if not has_any_data:
            return {"tailored_qualifications": QualificationsTailoringOutput()}

        strategy_dict = state["strategy"].model_dump()
        effective_style = state.get("style") or self.style
        custom_instructions = state.get("custom_instructions")
        custom_template = (state.get("prompt_templates") or {}).get("qualifications")
        work_context = (
            [w.model_dump() for w in state["tailored_work"].work]
            if state.get("tailored_work")
            else None
        )
        projects_context = (
            [p.model_dump() for p in state["tailored_projects"].projects]
            if state.get("tailored_projects")
            else None
        )

        system, user = prompts.qualifications_prompt(
            resume=state["original_resume"],
            job_description=state["job_description"],
            strategy=strategy_dict,
            active_sections=list(qual_sections),
            style=effective_style,
            custom_instructions=custom_instructions,
            custom_template=custom_template,
            work_context=work_context,
            projects_context=projects_context,
        )
        output = await self.llm_client.generate_structured(
            model=state.get("model") or self.qualifications_model,
            system_prompt=system,
            user_prompt=user,
            response_model=QualificationsTailoringOutput,
            session_id=state.get("job_id"),
            validation_context={"original_resume": state["original_resume"]},
            api_key=state.get("api_key"),
            api_base=state.get("api_base"),
        )
        return {"tailored_qualifications": output}

    async def monolithic_node(self, state: ResumeGraphState) -> dict[str, Any]:
        effective_style = state.get("style") or self.style
        custom_instructions = state.get("custom_instructions")
        custom_template = (state.get("prompt_templates") or {}).get("monolithic")
        system, user = prompts.monolithic_prompt(
            resume=state["original_resume"],
            job_description=state["job_description"],
            style=effective_style,
            custom_instructions=custom_instructions,
            custom_template=custom_template,
        )
        output = await self.llm_client.generate_structured(
            model=state.get("model") or self.monolithic_model,
            system_prompt=system,
            user_prompt=user,
            response_model=FullResumeTailoringOutput,
            session_id=state.get("job_id"),
            api_key=state.get("api_key"),
            api_base=state.get("api_base"),
        )
        return {
            "tailored_basics": output.basics,
            "tailored_work": WorkTailoringOutput(work=output.work),
            "tailored_projects": ProjectsTailoringOutput(projects=output.projects),
            "tailored_qualifications": QualificationsTailoringOutput(
                skills=output.skills,
                certificates=output.certificates,
                education=output.education,
            ),
        }

    async def merge_node(self, state: ResumeGraphState) -> dict[str, dict]:
        final_resume = self.merger.merge(
            original_resume=state["original_resume"],
            tailored_strategy_and_basics=state.get("strategy_and_basics"),
            tailored_qualifications=state.get("tailored_qualifications"),
            tailored_basics=state.get("tailored_basics"),
            tailored_work=state.get("tailored_work"),
            tailored_education=state.get("tailored_education"),
            tailored_skills=state.get("tailored_skills"),
            tailored_projects=state.get("tailored_projects"),
            selected_certificates=state.get("selected_certificates"),
            tailored_optional_sections=state.get("tailored_optional_sections"),
        )
        self.validator.validate(final_resume, context="tailored resume", status_code=500, strict=False)
        return {"final_resume": final_resume}

    async def final_check_node(self, state: ResumeGraphState) -> dict[str, Any]:
        final_resume = state.get("final_resume")
        if not final_resume:
            return {}
        effective_style = state.get("style") or self.style
        custom_instructions = state.get("custom_instructions")
        custom_template = (state.get("prompt_templates") or {}).get("final_check")
        system, user = prompts.final_check_prompt(
            final_resume=final_resume,
            original_resume=state["original_resume"],
            job_description=state["job_description"],
            style=effective_style,
            custom_instructions=custom_instructions,
            custom_template=custom_template,
        )
        critic_model = state.get("final_check_model") or self.final_check_model or state.get("model") or "default"
        try:
            output = await self.llm_client.generate_structured(
                model=critic_model,
                system_prompt=system,
                user_prompt=user,
                response_model=FinalCheckCriticOutput,
                session_id=state.get("job_id"),
                api_key=state.get("api_key"),
                api_base=state.get("api_base"),
            )
            logger.info("Critic review observations: %s", output.audit_observations)
            # Re-merge polished sections over final_resume to ensure schema integrity
            polished_resume = self.merger.merge(
                original_resume=final_resume,
                tailored_basics=output.basics,
                tailored_work=WorkTailoringOutput(work=output.work) if output.work else None,
                tailored_projects=ProjectsTailoringOutput(projects=output.projects) if output.projects else None,
                tailored_qualifications=QualificationsTailoringOutput(
                    skills=output.skills,
                    certificates=output.certificates,
                    education=output.education,
                ) if (output.skills or output.certificates or output.education) else None,
            )
            self.validator.validate(polished_resume, context="critic polished resume", status_code=500, strict=False)
            return {"final_resume": polished_resume}
        except Exception as e:
            logger.warning("Final check critic pass failed or was rejected by validator; keeping merged resume intact: %s", e)
            return {"final_resume": final_resume}

    async def render_node(self, state: ResumeGraphState) -> dict[str, str]:
        output_dir: Path = state["output_dir"]
        if not state.get("final_resume"):
            raise AppError("Cannot render before merge completes.", code="render_without_resume", status_code=500)
        pdf_path = await self.renderer.render(
            resume=state["final_resume"],
            theme=state["theme"],
            output_dir=output_dir,
        )
        return {"pdf_path": str(pdf_path)}
