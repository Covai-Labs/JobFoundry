import json
import pytest
from unittest.mock import AsyncMock
from resume_ops_api.services.copilot import (
    CopilotService,
    OutreachLLMResult,
    QALLMResult,
    CoverLetterLLMResult,
    format_to_toon,
)
from resume_ops_api.services.llm import StructuredLLMClient


SAMPLE_RESUME = {
    "basics": {
        "name": "Jane Developer",
        "label": "Senior Distributed Systems Engineer",
        "email": "jane@example.com",
    },
    "work": [
        {
            "name": "CloudTech",
            "position": "Staff Engineer",
            "highlights": [
                "Migrated legacy monolith to Kubernetes and gRPC, reducing p99 latency by 45%",
                "Led team of 8 engineers across 3 time zones",
            ],
        }
    ],
    "skills": [
        {"name": "Languages", "keywords": ["Go", "Python", "TypeScript"]},
        {"name": "Infrastructure", "keywords": ["Kubernetes", "AWS", "Terraform"]},
    ],
}


def test_format_to_toon():
    toon_out = format_to_toon(SAMPLE_RESUME)
    assert "basics:" in toon_out or "Jane Developer" in toon_out
    assert "Kubernetes" in toon_out


@pytest.mark.asyncio
async def test_generate_outreach():
    mock_llm = AsyncMock(spec=StructuredLLMClient)
    mock_llm.generate_structured.return_value = OutreachLLMResult(
        linkedin_note_free="Hi Jane, saw your team scaling distributed pipelines at CloudCorp. My background in k8s/gRPC aligns well. Would love to connect!",
        linkedin_note_premium="Hi Jane, saw your opening for Staff Distributed Systems Engineer. At CloudTech I migrated our legacy monolith to k8s/gRPC cutting p99 latency 45%. Would love to share my CV if this aligns with what you need.",
        inmail_subject="Staff Distributed Systems Engineer - Jane Developer",
        inmail_body="Hi Jane,\n\nI noticed CloudCorp is scaling its distributed infrastructure...",
        key_match_points=["Kubernetes & gRPC migration", "High-throughput systems"],
    )

    copilot = CopilotService(llm_client=mock_llm)
    result = await copilot.generate_outreach(
        resume=SAMPLE_RESUME,
        tailored_resume=None,
        job_description="Looking for a Distributed Systems Engineer with Kubernetes experience.",
        job_title="Staff Distributed Systems Engineer",
        company="CloudCorp",
        persona="recruiter",
    )

    assert len(result.linkedin_note_free) <= 200
    assert len(result.linkedin_note_premium) <= 300
    assert "Staff Distributed Systems Engineer" in result.inmail_subject
    assert len(result.key_match_points) > 0


@pytest.mark.asyncio
async def test_generate_qa():
    mock_llm = AsyncMock(spec=StructuredLLMClient)
    mock_llm.generate_structured.return_value = QALLMResult(
        answer="At CloudTech, I led our migration from a legacy monolith to Kubernetes and gRPC, cutting p99 latency by 45%.",
        situation="Legacy monolith was experiencing latency spikes under peak load.",
        task="Architect and execute a zero-downtime microservices migration.",
        action="Transitioned core services to Kubernetes clusters with gRPC transport.",
        result="Reduced p99 latency by 45% and improved deployment velocity 3x.",
        knockout_warning=None,
    )

    copilot = CopilotService(llm_client=mock_llm)
    result = await copilot.generate_qa(
        question="Describe a time you migrated a legacy service.",
        resume=SAMPLE_RESUME,
        tailored_resume=None,
        job_description="Seeking engineers with migration experience.",
        job_title="Senior Engineer",
        company="TechCorp",
    )

    assert "CloudTech" in result.answer
    assert "45%" in result.answer
    assert result.result != ""


@pytest.mark.asyncio
async def test_generate_cover_letter():
    mock_llm = AsyncMock(spec=StructuredLLMClient)
    mock_llm.generate_structured.return_value = CoverLetterLLMResult(
        paragraph_1="CloudCorp's focus on mission-critical distributed data systems aligns directly with my engineering focus over the past 8 years.",
        paragraph_2="At CloudTech, I led the migration of our legacy platform to Kubernetes and gRPC, reducing p99 latency by 45% while handling 100k req/s.",
        paragraph_3="I welcome the chance to discuss how my distributed systems experience can help CloudCorp solve its scale challenges.",
    )

    copilot = CopilotService(llm_client=mock_llm)
    result = await copilot.generate_cover_letter(
        resume=SAMPLE_RESUME,
        tailored_resume=None,
        job_description="Seeking a lead engineer for high-scale data systems.",
        job_title="Lead Engineer",
        company="CloudCorp",
    )

    assert "CloudCorp" in result.paragraph_1
    assert "Kubernetes" in result.paragraph_2
    assert "welcome the chance" in result.paragraph_3


def test_qallmresult_normalization_answers_list():
    """Reproduces and verifies fix for user bug where LLM returns {'answers': [...]} for multi-question prompts."""
    raw_data = {
        "answers": [
            {
                "question": "Why are you interested in joining the Supabase team?",
                "answer": "I admire Supabase's open-source architecture and developer experience.",
            },
            {
                "question": "Tell us about your experience working in an async/remote environment.",
                "answer": "I have led distributed remote teams across 3 continents with clear async workflows.",
            },
        ]
    }
    result = QALLMResult.model_validate(raw_data)
    assert result.validation_warning is not None
    assert "Supabase" in result.answer
    assert "distributed remote teams" in result.answer
    assert "---" in result.answer


def test_qallmresult_normalization_plain_string_and_alt_keys():
    # Plain text string
    res_str = QALLMResult.model_validate("Direct plain answer text from model")
    assert res_str.answer == "Direct plain answer text from model"
    assert res_str.validation_warning is not None

    # Alt key: response
    res_alt = QALLMResult.model_validate({"response": "Answer from response field"})
    assert res_alt.answer == "Answer from response field"
    assert res_alt.validation_warning is not None

    # Alt key: content
    res_content = QALLMResult.model_validate({"content": "Answer from content field"})
    assert res_content.answer == "Answer from content field"
    assert res_content.validation_warning is not None

    # List of strings
    res_list = QALLMResult.model_validate(["Answer 1", "Answer 2"])
    assert "Answer 1" in res_list.answer
    assert "Answer 2" in res_list.answer

    # Dict with list-valued 'answer' field
    res_dict_list = QALLMResult.model_validate({
        "answer": [
            {"question": "Q1", "answer": "Part 1"},
            {"question": "Q2", "answer": "Part 2"},
        ]
    })
    assert "Part 1" in res_dict_list.answer
    assert "Part 2" in res_dict_list.answer
    assert res_dict_list.validation_warning is not None


def test_outreach_and_cover_letter_normalization():
    # Outreach plain string
    outreach = OutreachLLMResult.model_validate("Excited about the role. Let's connect!")
    assert outreach.linkedin_note_free == "Excited about the role. Let's connect!"
    assert outreach.validation_warning is not None

    # Cover letter raw text
    letter = CoverLetterLLMResult.model_validate("Para 1 hook.\n\nPara 2 proof.\n\nPara 3 call to action.")
    assert letter.paragraph_1 == "Para 1 hook."
    assert letter.paragraph_2 == "Para 2 proof."
    assert letter.paragraph_3 == "Para 3 call to action."
    assert letter.validation_warning is not None


@pytest.mark.asyncio
async def test_copilot_service_qa_fallback_on_app_error_with_raw_content():
    from resume_ops_api.core.exceptions import AppError

    mock_llm = AsyncMock(spec=StructuredLLMClient)
    # Simulate LLM returning raw JSON with 'answers' list that previously failed standard structured parse
    raw_json_str = json.dumps({
        "answers": [
            {"question": "Q1", "answer": "Answer 1"},
            {"question": "Q2", "answer": "Answer 2"},
        ]
    })
    mock_llm.generate_structured.side_effect = AppError(
        "Structured LLM generation failed",
        code="llm_generation_failed",
        status_code=502,
        details={"model": "gpt-6-luna", "error": "validation error", "raw_content": raw_json_str},
    )

    copilot = CopilotService(llm_client=mock_llm)
    result = await copilot.generate_qa(
        question="Q1 and Q2",
        resume=SAMPLE_RESUME,
        job_description="JD",
    )

    assert "Answer 1" in result.answer
    assert "Answer 2" in result.answer
    assert result.validation_warning is not None


@pytest.mark.asyncio
async def test_copilot_service_qa_fallback_plain_string_error():
    from resume_ops_api.core.exceptions import AppError

    mock_llm = AsyncMock(spec=StructuredLLMClient)
    mock_llm.generate_structured.side_effect = AppError(
        "Structured LLM generation failed",
        code="llm_generation_failed",
        status_code=502,
        details={"model": "test-model", "error": "invalid json", "raw_content": "Here is the raw response from LLM."},
    )

    copilot = CopilotService(llm_client=mock_llm)
    result = await copilot.generate_qa(
        question="Some question",
        resume=SAMPLE_RESUME,
        job_description="JD",
    )

    assert result.answer == "Here is the raw response from LLM."
    assert result.validation_warning is not None
    assert "Schema validation warning" in result.validation_warning

