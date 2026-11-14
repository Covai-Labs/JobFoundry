from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator, ValidationInfo


def _resolve_certificate_name(cert_input: str, original_certificates: list[dict[str, Any]]) -> str | None:
    """Resolve a selected certificate name against master resume entries.

    Handles exact matches as well as common LLM formatting variations such as
    appending the issuer, full URL, or copying the full tabular row
    (e.g. 'Certificate, Issuer, URL', 'Certificate, Issuer', 'Certificate (Issuer)',
    or 'Certificate - Issuer'). Returns the canonical master certificate name,
    or None if no match is found.
    """
    if not cert_input or not isinstance(cert_input, str) or not cert_input.strip():
        return None
    cleaned = cert_input.strip()
    lowered = cleaned.lower()

    # Sort candidates by name length descending so longer/more specific names match first
    # e.g. 'AI Product Manager Professional Certificate' before 'Product Manager Professional Certificate'
    sorted_certs = sorted(
        [c for c in original_certificates if isinstance(c, dict) and c.get("name")],
        key=lambda c: len(c.get("name", "")),
        reverse=True,
    )

    # Pass 1: exact case-insensitive match on certificate name
    for c in sorted_certs:
        name = c.get("name", "").strip()
        if lowered == name.lower():
            return name

    # Pass 2: check if string starts with name followed by delimiter (comma, dash, paren, space, bracket)
    for c in sorted_certs:
        name = c.get("name", "").strip()
        name_lower = name.lower()
        if lowered.startswith(name_lower):
            rest = lowered[len(name_lower):]
            if not rest or rest[0] in (",", "-", "(", "[", ":", " ", "|"):
                return name

    # Pass 3: match by URL if present in the input string
    for c in sorted_certs:
        url = c.get("url", "").strip() if isinstance(c.get("url"), str) else ""
        if url and url.lower() in lowered:
            return c.get("name", "").strip()

    # Pass 4: first comma-separated or dash-separated token matches name
    for sep in (",", " - ", " (", " | "):
        if sep in lowered:
            first_part = lowered.split(sep)[0].strip()
            for c in sorted_certs:
                if first_part == c.get("name", "").strip().lower():
                    return c.get("name", "").strip()

    # Pass 5: token-level normalization
    tokens = set(re.findall(r"[a-z0-9]+", lowered))
    for c in sorted_certs:
        name = c.get("name", "").strip()
        issuer = c.get("issuer", "").strip() if isinstance(c.get("issuer"), str) else ""
        name_tokens = set(re.findall(r"[a-z0-9]+", name.lower()))
        if name_tokens and name_tokens.issubset(tokens):
            issuer_tokens = set(re.findall(r"[a-z0-9]+", issuer.lower())) if issuer else set()
            url_tokens = set(re.findall(r"[a-z0-9]+", c.get("url", "").lower())) if c.get("url") else set()
            extra = tokens - name_tokens
            if extra.issubset(issuer_tokens | url_tokens | {"https", "http", "www", "coursera", "org", "linkedin", "com"}):
                return name

    return None


class StrategyOutput(BaseModel):
    target_narrative: str
    priority_keywords: list[str] | dict[str, Any] | str = Field(default_factory=list)
    section_rules: list[str] | dict[str, Any] | str = Field(default_factory=list)
    red_lines: list[str] | dict[str, Any] | str = Field(default_factory=list)


class StrategyAndBasicsOutput(BaseModel):
    target_narrative: str
    priority_keywords: list[str] | dict[str, Any] | str = Field(default_factory=list)
    section_rules: list[str] | dict[str, Any] | str = Field(default_factory=list)
    red_lines: list[str] | dict[str, Any] | str = Field(default_factory=list)
    label: str | None = Field(default=None, description="Tailored professional title / headline matching the strategy.")
    summary: str | None = Field(
        default=None,
        description="Tailored professional summary paragraph matching the strategy. Keep it concise, writing a single punchy paragraph aiming for under 100 words."
    )


class WorkEntryTailoring(BaseModel):
    summary: str | None = None
    highlights: list[str] = Field(default_factory=list)


class WorkTailoringOutput(BaseModel):
    work: list[WorkEntryTailoring] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_work_count(self, info: ValidationInfo) -> "WorkTailoringOutput":
        context = info.context
        if context and "original_resume" in context:
            expected_count = len(context["original_resume"].get("work", []))
            if len(self.work) != expected_count:
                raise ValueError(
                    f"The number of work items returned ({len(self.work)}) must align 1:1 "
                    f"with the master resume ({expected_count})."
                )
        return self


class EducationEntryTailoring(BaseModel):
    courses: list[str] = Field(default_factory=list)


class EducationTailoringOutput(BaseModel):
    education: list[EducationEntryTailoring] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_education_count(self, info: ValidationInfo) -> "EducationTailoringOutput":
        context = info.context
        if context and "original_resume" in context:
            expected_count = len(context["original_resume"].get("education", []))
            if len(self.education) != expected_count:
                raise ValueError(
                    f"The number of education items returned ({len(self.education)}) must align 1:1 "
                    f"with the master resume ({expected_count})."
                )
        return self


class SkillEntry(BaseModel):
    name: str = Field(..., description="The name of the skill category (e.g., Frontend Development).")
    keywords: list[str] = Field(
        default_factory=list,
        min_length=1,
        max_length=8,
        description="List of 3 to 8 keywords/technologies for this skill category."
    )


class SkillsTailoringOutput(BaseModel):
    skills: list[SkillEntry] = Field(
        default_factory=list,
        min_length=1,
        max_length=6,
        description="List of 4 to 6 skill categories tailored to the job description."
    )


class QualificationsTailoringOutput(BaseModel):
    skills: list[SkillEntry] = Field(
        default_factory=list,
        min_length=0,
        max_length=6,
        description="List of 4 to 6 skill categories tailored to the job description."
    )
    certificates: list[str] = Field(
        default_factory=list,
        description="List of relevant certificate names selected verbatim from the master resume."
    )
    education: list[EducationEntryTailoring] = Field(
        default_factory=list,
        description="Tailored education courses aligned 1:1 with education entries in the master resume."
    )

    @field_validator("skills", mode="before")
    @classmethod
    def cap_skills(cls, v: Any) -> list[Any]:
        if isinstance(v, list):
            capped = []
            for item in v[:6]:
                if isinstance(item, dict) and "keywords" in item and isinstance(item["keywords"], list):
                    item = dict(item)
                    item["keywords"] = item["keywords"][:8]
                capped.append(item)
            return capped
        return v

    @model_validator(mode="after")
    def validate_qualifications(self, info: ValidationInfo) -> "QualificationsTailoringOutput":
        context = info.context
        if context and "original_resume" in context:
            if self.education:
                expected_edu_count = len(context["original_resume"].get("education", []))
                if len(self.education) != expected_edu_count:
                    raise ValueError(
                        f"The number of education items returned ({len(self.education)}) must align 1:1 "
                        f"with the master resume ({expected_edu_count})."
                    )
            if self.certificates:
                resolved_certs: list[str] = []
                original_certs = [
                    c for c in context["original_resume"].get("certificates", [])
                    if isinstance(c, dict) and c.get("name")
                ]
                if original_certs:
                    allowed_names = sorted({c.get("name", "").strip().lower() for c in original_certs})
                    for cert in self.certificates:
                        matched = _resolve_certificate_name(cert, original_certs)
                        if not matched:
                            raise ValueError(
                                f"Certificate '{cert}' does not exist in the master resume. "
                                f"Allowed certificates: {', '.join(allowed_names)}"
                            )
                        resolved_certs.append(matched)
                    self.certificates = resolved_certs
        return self


class ProjectEntryTailoring(BaseModel):
    name: str = Field(..., description="The name of the project, matching the master resume verbatim.")
    description: str | None = Field(default=None, description="Tailored description of the project.")
    highlights: list[str] | None = Field(
        default=None,
        max_length=3,
        description="At most 3 key highlights or accomplishments for this project."
    )
    keywords: list[str] = Field(
        default_factory=list,
        max_length=6,
        description="At most 6 relevant technologies/keywords used in this project."
    )


class ProjectsTailoringOutput(BaseModel):
    projects: list[ProjectEntryTailoring] = Field(
        default_factory=list,
        max_length=4,
        description="List of at most 4 tailored projects that are most relevant to the target job description."
    )

    @model_validator(mode="after")
    def validate_project_names(self, info: ValidationInfo) -> "ProjectsTailoringOutput":
        context = info.context
        if context and "original_resume" in context:
            original_names = {
                p.get("name", "").strip().lower()
                for p in context["original_resume"].get("projects", [])
                if p.get("name")
            }
            for project in self.projects:
                if project.name.strip().lower() not in original_names:
                    raise ValueError(
                        f"Project name '{project.name}' does not match any project name in the master resume verbatim. "
                        f"Allowed project names: {', '.join(sorted(original_names))}"
                    )
        return self


class CertificatesSelectionOutput(BaseModel):
    certificates: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_certificate_names(self, info: ValidationInfo) -> "CertificatesSelectionOutput":
        context = info.context
        if context and "original_resume" in context:
            resolved_certs: list[str] = []
            original_certs = [
                c for c in context["original_resume"].get("certificates", [])
                if isinstance(c, dict) and c.get("name")
            ]
            if original_certs:
                allowed_names = sorted({c.get("name", "").strip().lower() for c in original_certs})
                for cert in self.certificates:
                    matched = _resolve_certificate_name(cert, original_certs)
                    if not matched:
                        raise ValueError(
                            f"Certificate '{cert}' does not exist in the master resume. "
                            f"Allowed certificates: {', '.join(allowed_names)}"
                        )
                    resolved_certs.append(matched)
                self.certificates = resolved_certs
        return self


class InterestTailoring(BaseModel):
    name: str
    keywords: list[str] = Field(default_factory=list)


class OptionalSectionsOutput(BaseModel):
    interests: list[InterestTailoring] = Field(default_factory=list)


class BasicsTailoringOutput(BaseModel):
    label: str | None = Field(default=None, description="Tailored professional title / headline matching the strategy.")
    summary: str | None = Field(
        default=None,
        description="Tailored professional summary paragraph matching the strategy. Keep it concise, writing a single punchy paragraph aiming for under 100 words."
    )


class TailorResult(BaseModel):
    resume: dict[str, Any]
    pdf_path: str
    pdf_base64: str
    theme: str
    plain_text: str


class FullResumeTailoringOutput(BaseModel):
    basics: BasicsTailoringOutput | None = None
    work: list[WorkEntryTailoring] | None = None
    projects: list[ProjectEntryTailoring] | None = None
    skills: list[SkillEntry] | None = None
    certificates: list[str] | None = None
    education: list[EducationEntryTailoring] | None = None


class FinalCheckCriticOutput(BaseModel):
    audit_observations: list[str] = Field(
        default_factory=list,
        description="Observations regarding factual accuracy, instruction compliance, and stylistic improvements."
    )
    basics: BasicsTailoringOutput | None = None
    work: list[WorkEntryTailoring] | None = None
    projects: list[ProjectEntryTailoring] | None = None
    skills: list[SkillEntry] | None = None
    certificates: list[str] | None = None
    education: list[EducationEntryTailoring] | None = None
