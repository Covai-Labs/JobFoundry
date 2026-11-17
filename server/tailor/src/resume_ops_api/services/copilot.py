from __future__ import annotations

import json
import logging
from typing import Any
from pydantic import BaseModel, Field, model_validator
import toons

from resume_ops_api.core.exceptions import AppError
from resume_ops_api.services.llm import StructuredLLMClient

logger = logging.getLogger(__name__)


def format_to_toon(data: Any) -> str:
    """Format structured object into TOON (Token-Oriented Object Notation)."""
    if not data:
        return ""
    try:
        return toons.dumps(data)
    except Exception as e:
        logger.warning("Failed to serialize to TOON format (%s); falling back to json", e)
        return json.dumps(data, ensure_ascii=False)


STOP_SLOP_RULES = (
    "\n\nCRITICAL ANTI-AI-SLOP & GHOSTWRITER RULES:\n"
    "1. Strict Truthfulness Invariant: Never invent or hallucinate metrics, dates, companies, credentials, or projects not present in the candidate's resume.\n"
    "2. Anti-AI Cliches Ban: Never use generic corporate AI buzzwords such as 'excited to apply', 'thrilled to submit', 'passionate about', 'spearheaded', 'synergy', 'seamless', 'cutting-edge', 'unique blend of skills', 'proven track record', 'testament to', or 'look no further'.\n"
    "3. Active Voice: Use clear, direct, active phrasing (e.g., 'built', 'led', 'designed', 'scaled') instead of passive constructions.\n"
    "4. No Em-Dashes: Avoid em-dashes ('—') in generated prose; use clear punctuation instead.\n"
    "5. Specificity: Ground every claim in concrete outcomes, real technologies, and genuine projects from the resume."
)


class OutreachLLMResult(BaseModel):
    linkedin_note_free: str = Field(
        ...,
        description="LinkedIn connection request note strictly under 200 characters for free accounts. Punchy, authentic, mentioning specific role/fit and courteous CTA.",
    )
    linkedin_note_premium: str = Field(
        ...,
        description="LinkedIn connection request note strictly under 300 characters for Premium accounts. Mentions 1 concrete relevant skill or project.",
    )
    inmail_subject: str = Field(
        ...,
        description="Punchy, professional subject line (under 60 characters).",
    )
    inmail_body: str = Field(
        ...,
        description="InMail draft (150-220 words) referencing 1-2 real projects/achievements from the candidate's resume that directly map to the JD requirements.",
    )
    key_match_points: list[str] = Field(
        default_factory=list,
        description="1-3 bullet points highlighting the strongest resume-to-job match criteria used.",
    )
    validation_warning: str | None = Field(
        default=None,
        description="Optional warning when result is recovered from non-standard schema or raw generation.",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_outreach_input(cls, data: Any) -> Any:
        if isinstance(data, str):
            clean_str = data.strip()
            return {
                "linkedin_note_free": clean_str[:200],
                "linkedin_note_premium": clean_str[:300],
                "inmail_subject": "Recruiter Outreach",
                "inmail_body": clean_str,
                "key_match_points": [],
                "validation_warning": "Recovered outreach from plain text draft.",
            }
        if isinstance(data, dict):
            body = (
                data.get("inmail_body")
                or data.get("body")
                or data.get("message")
                or data.get("content")
                or data.get("text")
            )
            subj = data.get("inmail_subject") or data.get("subject") or "Application Outreach"
            free_note = data.get("linkedin_note_free") or data.get("connection_note") or data.get("note")
            prem_note = data.get("linkedin_note_premium") or data.get("connection_note_premium") or free_note

            needs_fix = not (
                data.get("linkedin_note_free")
                and data.get("linkedin_note_premium")
                and data.get("inmail_subject")
                and data.get("inmail_body")
            )
            if needs_fix and body:
                data["inmail_body"] = str(body)
                data["inmail_subject"] = str(subj)[:60]
                data["linkedin_note_free"] = str(free_note or body)[:200]
                data["linkedin_note_premium"] = str(prem_note or body)[:300]
                if not data.get("validation_warning"):
                    data["validation_warning"] = "Mapped outreach fields from partial LLM response."
        return data


class QALLMResult(BaseModel):
    answer: str = Field(
        ...,
        description="Factual, articulate response to the screening question grounded strictly in candidate resume. Concise and punchy.",
    )
    situation: str = Field(
        default="",
        description="Brief STAR Situation if applicable, or summary context.",
    )
    task: str = Field(
        default="",
        description="Brief STAR Task / Challenge.",
    )
    action: str = Field(
        default="",
        description="Brief STAR Action taken using real resume skills.",
    )
    result: str = Field(
        default="",
        description="Brief STAR Quantifiable Result or outcome achieved.",
    )
    knockout_warning: str | None = Field(
        default=None,
        description="Warning if question represents a knockout filter (e.g. citizenship, sponsorship, required degree) where candidate resume may have tension.",
    )
    validation_warning: str | None = Field(
        default=None,
        description="Optional warning when result is recovered from non-standard schema or raw generation.",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_qa_input(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {
                "answer": data.strip(),
                "validation_warning": "Recovered response from plain text.",
            }

        def format_answer_item(item: Any, idx: int) -> str:
            if isinstance(item, dict):
                q = item.get("question") or item.get("prompt") or item.get("q")
                a = item.get("answer") or item.get("response") or item.get("content") or item.get("text")
                if q and a:
                    return f"**{q}**\n\n{a}"
                if a:
                    return str(a)
                if q:
                    return str(q)
                return json.dumps(item)
            return str(item)

        if isinstance(data, list):
            parts = [format_answer_item(item, idx) for idx, item in enumerate(data, 1)]
            return {
                "answer": "\n\n---\n\n".join(parts),
                "validation_warning": "Parsed multiple answers from list response.",
            }

        if isinstance(data, dict):
            # If answer is present and valid non-empty string, accept as-is
            if "answer" in data and isinstance(data["answer"], str) and data["answer"].strip():
                return data

            # If answers list is provided (e.g. multi-question prompts where LLM returns {'answers': [...]})
            if "answers" in data and isinstance(data["answers"], list):
                parts = [format_answer_item(item, idx) for idx, item in enumerate(data["answers"], 1)]
                data["answer"] = "\n\n---\n\n".join(parts)
                if not data.get("validation_warning"):
                    data["validation_warning"] = "Formatted multiple answers from structured response."
                return data

            # Alternative keys for answer
            for alt_key in ("response", "content", "text", "output", "screening_answer", "draft"):
                if alt_key in data and data[alt_key]:
                    val = data[alt_key]
                    if isinstance(val, list):
                        parts = [format_answer_item(item, idx) for idx, item in enumerate(val, 1)]
                        data["answer"] = "\n\n---\n\n".join(parts)
                    else:
                        data["answer"] = str(val)
                    if not data.get("validation_warning"):
                        data["validation_warning"] = f"Extracted answer from '{alt_key}' field."
                    return data

            # If result is provided and not STAR result
            if "result" in data and data["result"] and not data.get("situation") and not data.get("action"):
                data["answer"] = str(data["result"])
                data["result"] = ""
                if not data.get("validation_warning"):
                    data["validation_warning"] = "Extracted answer from 'result' field."
                return data

            # If dictionary is non-empty, serialize as fallback
            if data:
                data["answer"] = json.dumps(data, indent=2)
                data["validation_warning"] = "Rendered structured response dictionary as answer."
                return data

        return data


class CoverLetterLLMResult(BaseModel):
    paragraph_1: str = Field(
        ...,
        description="Paragraph 1: Hook and alignment. Specific interest in the company and role, crisp functional positioning without filler openers.",
    )
    paragraph_2: str = Field(
        ...,
        description="Paragraph 2: Core proof points. 1-2 concrete achievements or projects from candidate resume solving problems described in the JD.",
    )
    paragraph_3: str = Field(
        ...,
        description="Paragraph 3: Forward-looking conclusion and proactive call to action.",
    )
    validation_warning: str | None = Field(
        default=None,
        description="Optional warning when result is recovered from non-standard schema or raw generation.",
    )

    @model_validator(mode="before")
    @classmethod
    def normalize_cover_letter_input(cls, data: Any) -> Any:
        if isinstance(data, str):
            paragraphs = [p.strip() for p in data.split("\n\n") if p.strip()]
            p1 = paragraphs[0] if len(paragraphs) > 0 else data.strip()
            p2 = paragraphs[1] if len(paragraphs) > 1 else ""
            p3 = "\n\n".join(paragraphs[2:]) if len(paragraphs) > 2 else ""
            return {
                "paragraph_1": p1,
                "paragraph_2": p2,
                "paragraph_3": p3,
                "validation_warning": "Parsed cover letter paragraphs from plain text.",
            }
        if isinstance(data, dict):
            alt = (
                data.get("cover_letter")
                or data.get("letter")
                or data.get("body")
                or data.get("text")
                or data.get("content")
            )
            if not data.get("paragraph_1") and alt:
                paragraphs = [p.strip() for p in str(alt).split("\n\n") if p.strip()]
                data["paragraph_1"] = paragraphs[0] if len(paragraphs) > 0 else str(alt)
                data["paragraph_2"] = paragraphs[1] if len(paragraphs) > 1 else ""
                data["paragraph_3"] = "\n\n".join(paragraphs[2:]) if len(paragraphs) > 2 else ""
                if not data.get("validation_warning"):
                    data["validation_warning"] = "Extracted cover letter paragraphs from full letter text."
        return data


class CopilotService:
    def __init__(self, llm_client: StructuredLLMClient, default_model: str = "openrouter/google/gemini-2.0-flash-exp:free") -> None:
        self.llm_client = llm_client
        self.default_model = default_model

    async def generate_outreach(
        self,
        *,
        resume: dict[str, Any],
        tailored_resume: dict[str, Any] | None = None,
        job_description: str,
        job_title: str | None = None,
        company: str | None = None,
        persona: str = "recruiter",
        model: str | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
        constraints: str | None = None,
        stop_slop: bool = True,
        system_prompt_template: str | None = None,
    ) -> OutreachLLMResult:
        selected_model = model or self.default_model
        persona_guide = (
            "Target Persona: RECRUITER.\n"
            "Focus: Hard criteria match (role, core stack, years of experience, availability/location). Low friction CTA (happy to share CV)."
            if persona.lower() == "recruiter"
            else "Target Persona: HIRING MANAGER / TEAM LEAD.\n"
            "Focus: Specific technical problem/challenge from the JD, candidate's strongest matching project/achievement, conversational hook (interested in their approach)."
        )

        base_system = (
            system_prompt_template
            or "You are an expert Ghost Writer and Executive Career Strategist creating high-converting recruiter outreach."
        )
        if stop_slop:
            base_system += STOP_SLOP_RULES
        if constraints:
            base_system += f"\n\nUSER CONSTRAINTS:\n{constraints}"

        master_toon = format_to_toon(resume)
        tailored_toon = format_to_toon(tailored_resume) if tailored_resume else ""

        user_prompt = (
            f"{persona_guide}\n\n"
            f"--- TARGET ROLE ---\n"
            f"Title: {job_title or 'Target Role'}\n"
            f"Company: {company or 'Target Company'}\n"
            f"Job Description:\n{job_description}\n\n"
            f"--- MASTER RESUME (TOON format) ---\n"
            f"{master_toon}\n"
        )
        if tailored_toon:
            user_prompt += f"\n--- TAILORED RESUME ALIGNMENT (TOON format) ---\n{tailored_toon}\n"

        user_prompt += (
            "\nGenerate the following outreach drafts:\n"
            "1. linkedin_note_free: STRICTLY <= 200 characters (LinkedIn free tier limit). Never exceed 200 chars!\n"
            "2. linkedin_note_premium: STRICTLY <= 300 characters (LinkedIn Premium limit). Never exceed 300 chars!\n"
            "3. inmail_subject: Crisp subject line under 60 chars.\n"
            "4. inmail_body: 150-220 word direct outreach draft citing 1-2 real projects.\n"
            "5. key_match_points: Top 1-3 alignment highlights."
        )

        try:
            result = await self.llm_client.generate_structured(
                model=selected_model,
                system_prompt=base_system,
                user_prompt=user_prompt,
                response_model=OutreachLLMResult,
                api_key=api_key,
                api_base=api_base,
            )
        except Exception as exc:
            raw_content = exc.details.get("raw_content") if isinstance(getattr(exc, "details", None), dict) else None
            if raw_content:
                logger.warning("Falling back to raw LLM output for outreach after error: %s", exc)
                try:
                    parsed_raw = json.loads(raw_content) if isinstance(raw_content, str) else raw_content
                    if isinstance(parsed_raw, (dict, list)):
                        recovered = OutreachLLMResult.model_validate(parsed_raw)
                        if not recovered.validation_warning:
                            recovered.validation_warning = f"Output recovered with schema warning: {getattr(exc, 'message', str(exc))}"
                        return recovered
                except Exception as parse_err:
                    logger.debug("Failed to model_validate raw outreach output: %s", parse_err)
                raw_str = str(raw_content)
                return OutreachLLMResult(
                    linkedin_note_free=raw_str[:200],
                    linkedin_note_premium=raw_str[:300],
                    inmail_subject="Application Outreach",
                    inmail_body=raw_str,
                    key_match_points=[],
                    validation_warning=f"Schema validation warning: {getattr(exc, 'message', str(exc))}",
                )
            raise

        # Enforce hard length constraints as defense in depth
        if len(result.linkedin_note_free) > 200:
            result.linkedin_note_free = result.linkedin_note_free[:197].rsplit(" ", 1)[0] + "..."
        if len(result.linkedin_note_premium) > 300:
            result.linkedin_note_premium = result.linkedin_note_premium[:297].rsplit(" ", 1)[0] + "..."

        return result

    async def generate_qa(
        self,
        *,
        question: str,
        resume: dict[str, Any],
        tailored_resume: dict[str, Any] | None = None,
        job_description: str,
        job_title: str | None = None,
        company: str | None = None,
        model: str | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
        constraints: str | None = None,
        stop_slop: bool = True,
        system_prompt_template: str | None = None,
    ) -> QALLMResult:
        selected_model = model or self.default_model
        base_system = (
            system_prompt_template
            or "You are an articulate candidate ghost writer drafting job application screening responses."
        )
        if stop_slop:
            base_system += STOP_SLOP_RULES
        if constraints:
            base_system += f"\n\nUSER CONSTRAINTS:\n{constraints}"

        master_toon = format_to_toon(resume)
        tailored_toon = format_to_toon(tailored_resume) if tailored_resume else ""

        user_prompt = (
            f"--- APPLICATION QUESTION ---\n"
            f"{question}\n\n"
            f"--- TARGET ROLE ---\n"
            f"Title: {job_title or 'Target Role'}\n"
            f"Company: {company or 'Target Company'}\n"
            f"Job Description:\n{job_description}\n\n"
            f"--- CANDIDATE MASTER RESUME (TOON format) ---\n"
            f"{master_toon}\n"
        )
        if tailored_toon:
            user_prompt += f"\n--- TAILORED RESUME (TOON format) ---\n{tailored_toon}\n"

        user_prompt += (
            "\nInstructions:\n"
            "1. Answer the question directly and factually from the candidate's genuine experience.\n"
            "2. If behavioral/situational, use STAR principles (Situation, Task, Action, Result) concisely.\n"
            "3. If candidate lacks an exact keyword, pivot truthfully to adjacent transferable achievements.\n"
            "4. Check for knock-out filters (e.g. visa sponsorship, salary floors, clearance requirements) and flag if needed."
        )

        try:
            return await self.llm_client.generate_structured(
                model=selected_model,
                system_prompt=base_system,
                user_prompt=user_prompt,
                response_model=QALLMResult,
                api_key=api_key,
                api_base=api_base,
            )
        except Exception as exc:
            raw_content = exc.details.get("raw_content") if isinstance(getattr(exc, "details", None), dict) else None
            if raw_content:
                logger.warning("Falling back to raw LLM output for QA after error: %s", exc)
                try:
                    parsed_raw = json.loads(raw_content) if isinstance(raw_content, str) else raw_content
                    if isinstance(parsed_raw, (dict, list)):
                        recovered = QALLMResult.model_validate(parsed_raw)
                        if not recovered.validation_warning:
                            recovered.validation_warning = f"Output recovered with schema warning: {getattr(exc, 'message', str(exc))}"
                        return recovered
                except Exception as parse_err:
                    logger.debug("Failed to model_validate raw QA output: %s", parse_err)
                return QALLMResult(
                    answer=str(raw_content),
                    validation_warning=f"Schema validation warning: {getattr(exc, 'message', str(exc))}",
                )
            raise

    async def generate_cover_letter(
        self,
        *,
        resume: dict[str, Any],
        tailored_resume: dict[str, Any] | None = None,
        job_description: str,
        job_title: str | None = None,
        company: str | None = None,
        model: str | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
        constraints: str | None = None,
        stop_slop: bool = True,
        system_prompt_template: str | None = None,
    ) -> CoverLetterLLMResult:
        selected_model = model or self.default_model
        base_system = (
            system_prompt_template
            or "You are an expert executive cover letter writer crafting a clean, compelling 3-paragraph letter."
        )
        if stop_slop:
            base_system += STOP_SLOP_RULES
        if constraints:
            base_system += f"\n\nUSER CONSTRAINTS:\n{constraints}"

        master_toon = format_to_toon(resume)
        tailored_toon = format_to_toon(tailored_resume) if tailored_resume else ""

        user_prompt = (
            f"--- TARGET ROLE ---\n"
            f"Title: {job_title or 'Target Role'}\n"
            f"Company: {company or 'Target Company'}\n"
            f"Job Description:\n{job_description}\n\n"
            f"--- CANDIDATE MASTER RESUME (TOON format) ---\n"
            f"{master_toon}\n"
        )
        if tailored_toon:
            user_prompt += f"\n--- TAILORED RESUME (TOON format) ---\n{tailored_toon}\n"

        user_prompt += (
            "\nWrite a clean 3-paragraph letter:\n"
            "- paragraph_1: Hook & functional positioning. No filler openers ('I am writing to...').\n"
            "- paragraph_2: Core proof points with 1-2 real projects/metrics solving problems from the JD.\n"
            "- paragraph_3: Forward-looking wrap-up and proactive call to action."
        )

        try:
            return await self.llm_client.generate_structured(
                model=selected_model,
                system_prompt=base_system,
                user_prompt=user_prompt,
                response_model=CoverLetterLLMResult,
                api_key=api_key,
                api_base=api_base,
            )
        except Exception as exc:
            raw_content = exc.details.get("raw_content") if isinstance(getattr(exc, "details", None), dict) else None
            if raw_content:
                logger.warning("Falling back to raw LLM output for cover letter after error: %s", exc)
                try:
                    parsed_raw = json.loads(raw_content) if isinstance(raw_content, str) else raw_content
                    if isinstance(parsed_raw, (dict, list)):
                        recovered = CoverLetterLLMResult.model_validate(parsed_raw)
                        if not recovered.validation_warning:
                            recovered.validation_warning = f"Output recovered with schema warning: {getattr(exc, 'message', str(exc))}"
                        return recovered
                except Exception as parse_err:
                    logger.debug("Failed to model_validate raw cover letter output: %s", parse_err)
                raw_str = str(raw_content)
                return CoverLetterLLMResult(
                    paragraph_1=raw_str,
                    paragraph_2="",
                    paragraph_3="",
                    validation_warning=f"Schema validation warning: {getattr(exc, 'message', str(exc))}",
                )
            raise
