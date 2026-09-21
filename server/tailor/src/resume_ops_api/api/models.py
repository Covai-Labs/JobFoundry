from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import AnyHttpUrl, BaseModel, Field


class TailorRequest(BaseModel):
    resume: dict[str, Any] | None = None
    job_description: str = Field(min_length=1)
    theme: str | None = None
    callback_url: AnyHttpUrl | None = None
    sections: list[str] | None = None
    model: str | None = None
    api_key: str | None = None
    api_base: str | None = None
    style: str | None = None


class CopilotOutreachRequest(BaseModel):
    resume: dict[str, Any] | None = None
    tailored_resume: dict[str, Any] | None = None
    job_description: str = Field(min_length=1)
    job_title: str | None = None
    company: str | None = None
    persona: str = "recruiter"
    model: str | None = None
    api_key: str | None = None
    api_base: str | None = None
    constraints: str | None = None
    stop_slop: bool = True
    system_prompt_template: str | None = None


class CopilotOutreachResponse(BaseModel):
    linkedin_note_free: str
    linkedin_note_premium: str
    inmail_subject: str
    inmail_body: str
    key_match_points: list[str] = Field(default_factory=list)


class CopilotQARequest(BaseModel):
    question: str = Field(min_length=1)
    resume: dict[str, Any] | None = None
    tailored_resume: dict[str, Any] | None = None
    job_description: str = Field(min_length=1)
    job_title: str | None = None
    company: str | None = None
    model: str | None = None
    api_key: str | None = None
    api_base: str | None = None
    constraints: str | None = None
    stop_slop: bool = True
    system_prompt_template: str | None = None


class CopilotQAResponse(BaseModel):
    question: str
    answer: str
    situation: str = ""
    task: str = ""
    action: str = ""
    result: str = ""
    knockout_warning: str | None = None


class CopilotCoverLetterRequest(BaseModel):
    resume: dict[str, Any] | None = None
    tailored_resume: dict[str, Any] | None = None
    job_description: str = Field(min_length=1)
    job_title: str | None = None
    company: str | None = None
    model: str | None = None
    api_key: str | None = None
    api_base: str | None = None
    constraints: str | None = None
    stop_slop: bool = True
    system_prompt_template: str | None = None


class CopilotCoverLetterResponse(BaseModel):
    cover_letter: str
    paragraph_1: str
    paragraph_2: str
    paragraph_3: str
    word_count: int


class TailorResponse(BaseModel):
    resume: dict[str, Any]
    pdf_base64: str
    theme: str
    plain_text: str


class QueuedTaskResponse(BaseModel):
    task_id: str
    status: str


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class TaskError(BaseModel):
    code: str
    message: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    resume: dict[str, Any] | None = None
    pdf_base64: str | None = None
    plain_text: str | None = None
    error: TaskError | None = None
    theme: str


class ThemeListResponse(BaseModel):
    default_theme: str
    allowed_themes: list[str]


class HealthResponse(BaseModel):
    status: str


class MasterResumeStatus(BaseModel):
    configured: bool
    exists: bool
    valid: bool
    message: str


class TestLlmRequest(BaseModel):
    model: str
    api_key: str | None = None
    api_base: str | None = None


class TestLlmResponse(BaseModel):
    success: bool
    latencyMs: int | None = None
    model: str | None = None
    message: str | None = None
    error: str | None = None

