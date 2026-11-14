from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator, ValidationInfo


URL_RE = re.compile(r"https?://[^\s,()]+")


def _match_exact_name(lowered: str, candidates: list[dict[str, Any]]) -> str | None:
    for c in candidates:
        name = c.get("name", "").strip()
        if lowered == name.lower():
            return name
    return None


def _match_delimited_name(lowered: str, candidates: list[dict[str, Any]]) -> str | None:
    for sep in (",", " - ", " (", " | "):
        if sep in lowered:
            prefix = lowered.split(sep)[0].strip()
            for c in candidates:
                name = c.get("name", "").strip()
                if prefix == name.lower():
                    rest = lowered[len(prefix):].strip(" ,-():[]|")
                    issuer = (c.get("issuer") or "").strip().lower() if isinstance(c.get("issuer"), str) else ""
                    url = (c.get("url") or "").strip().lower() if isinstance(c.get("url"), str) else ""
                    if not rest or (issuer and issuer in rest) or (url and url in rest):
                        return name
    return None


def _match_url(lowered: str, candidates: list[dict[str, Any]]) -> str | None:
    extracted_urls = [u.rstrip(".,);]") for u in URL_RE.findall(lowered)]
    if not extracted_urls:
        return None
    for target_url in extracted_urls:
        matching = [
            c.get("name", "").strip()
            for c in candidates
            if isinstance(c.get("url"), str) and c.get("url", "").strip().lower() == target_url
        ]
        if len(matching) == 1:
            return matching[0]
    return None


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
    lowered = cert_input.strip().lower()
    candidates = [c for c in original_certificates if isinstance(c, dict) and c.get("name")]
    candidates.sort(key=lambda c: len(c.get("name", "")), reverse=True)

    return (
        _match_exact_name(lowered, candidates)
        or _match_delimited_name(lowered, candidates)
        or _match_url(lowered, candidates)
    )


def _validate_and_canonicalize_certificates(
    certificates: list[str],
    context: Any,
) -> list[str]:
    """Validate selected certificates against master resume and canonicalize matched names."""
    if not isinstance(context, dict) or "original_resume" not in context or not certificates:
        return certificates
    resolved_certs: list[str] = []
    original_certs = [
        c for c in context["original_resume"].get("certificates", [])
        if isinstance(c, dict) and c.get("name")
    ]
    allowed_names = sorted({c.get("name", "").strip().lower() for c in original_certs})
    for cert in certificates:
        matched = _resolve_certificate_name(cert, original_certs) if original_certs else None
        if not matched:
            allowed_display = (
                f"Allowed certificates: {', '.join(allowed_names)}"
                if allowed_names
                else "Master resume contains no certificates."
            )
            raise ValueError(
                f"Certificate '{cert}' does not exist in the master resume. {allowed_display}"
            )
        resolved_certs.append(matched)
    return resolved_certs


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
                self.certificates = _validate_and_canonicalize_certificates(self.certificates, context)
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
        if self.certificates:
            self.certificates = _validate_and_canonicalize_certificates(self.certificates, info.context)
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
