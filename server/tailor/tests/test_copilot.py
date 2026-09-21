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
