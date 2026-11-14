import os
import pytest
from src.llm import (
    LLMClient,
    StubLLM,
    LiteLLMClient,
    ScoreResult,
    _log_safe,
    format_resume_for_prompt,
)


def test_format_resume_for_prompt():
    resume = {
        "basics": {"name": "Jane Doe", "email": "jane@example.com"},
        "skills": [
            {"name": "Python", "level": "Senior"},
            {"name": "TypeScript", "level": "Intermediate"},
        ],
    }
    toon_output = format_resume_for_prompt(resume)
    assert "basics:" in toon_output
    assert "name: Jane Doe" in toon_output
    assert "skills[2]{name,level}:" in toon_output
    assert "Python,Senior" in toon_output
    assert "TypeScript,Intermediate" in toon_output


def test_format_resume_for_prompt_empty():
    assert format_resume_for_prompt({}) == ""
    assert format_resume_for_prompt(None) == ""


def test_score_result_validation():
    res = ScoreResult(
        score=90,
        reasoning="Great fit",
        missing_skills=["Rust"],
        matching_skills=["Python", "FastAPI"],
    )
    assert res.score == 90
    assert res.reasoning == "Great fit"
    assert res.missing_skills == ["Rust"]
    assert res.matching_skills == ["Python", "FastAPI"]


def test_score_result_boundaries():
    with pytest.raises(ValueError):
        ScoreResult(
            score=105,
            reasoning="Too high",
            missing_skills=[],
            matching_skills=[],
        )

    with pytest.raises(ValueError):
        ScoreResult(
            score=-5,
            reasoning="Negative score",
            missing_skills=[],
            matching_skills=[],
        )


@pytest.mark.asyncio
async def test_stub_llm():
    stub = StubLLM(
        default_result=ScoreResult(
            score=80,
            reasoning="Solid match",
            missing_skills=["Docker"],
            matching_skills=["Python"],
        )
    )
    assert isinstance(stub, LLMClient)
    result = await stub.score(job={"title": "Dev"}, resume={"skills": ["Python"]})
    assert result.score == 80
    assert result.reasoning == "Solid match"
    assert result.missing_skills == ["Docker"]
    assert result.matching_skills == ["Python"]


@pytest.mark.asyncio
async def test_litellm_client_skips_without_env(monkeypatch):
    monkeypatch.delenv("SCORER_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    
    # Without API keys or model configured, live calls should be skipped in normal test suite
    if not os.getenv("LIVE"):
        pytest.skip("Skipping live LLM test (LIVE env not set)")


def test_log_safe_collapses_line_breaks():
    forged = "job-1\n2026-01-01 00:00:00 ERROR forged entry"
    cleaned = _log_safe(forged)
    assert "\n" not in cleaned
    assert "\r" not in cleaned
    assert cleaned == "job-1 2026-01-01 00:00:00 ERROR forged entry"


def test_log_safe_replaces_control_characters():
    cleaned = _log_safe("job\x00\x1b\x7f-1")
    assert "\x00" not in cleaned
    assert "\x1b" not in cleaned
    assert "\x7f" not in cleaned
    assert cleaned == "job -1"


def test_log_safe_truncates_long_values():
    cleaned = _log_safe("x" * 500, limit=20)
    assert len(cleaned) == 20
    assert cleaned.endswith("...")


def test_log_safe_accepts_non_string_values():
    assert _log_safe(ValueError("boom\nsecond line")) == "boom second line"


def test_log_safe_keeps_ordinary_values_intact():
    assert _log_safe("job-abc_123", limit=64) == "job-abc_123"
