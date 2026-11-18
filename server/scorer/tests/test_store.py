import json
import sqlite3
import time
import pytest
from src.llm import ScoreResult
from src.store import JobStore


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  posted_at INTEGER,
  description TEXT,
  fingerprint TEXT,
  liveness TEXT NOT NULL DEFAULT 'unknown',
  fit_score INTEGER,
  fit_notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  tailored_resume_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
"""


@pytest.fixture
def in_memory_store():
    # SQLite connection in memory (shared cache or standalone connection)
    store = JobStore(db_path=":memory:", threshold=75)
    store.init_schema(SCHEMA_SQL)
    return store


def test_init_schema_and_get_unscored_jobs(in_memory_store: JobStore):
    now = int(time.time() * 1000)
    in_memory_store.conn.execute(
        """
        INSERT INTO jobs (id, title, company, url, source, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("job-1", "Backend Engineer", "Acme", "https://example.com/1", "test", "Python backend role", now, now),
    )
    in_memory_store.conn.execute(
        """
        INSERT INTO jobs (id, title, company, url, source, description, fit_score, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("job-2", "Frontend Engineer", "Acme", "https://example.com/2", "test", "React role", 85, "new", now, now),
    )
    in_memory_store.conn.commit()

    unscored = in_memory_store.get_unscored_jobs(limit=10)
    assert len(unscored) == 1
    assert unscored[0]["id"] == "job-1"
    assert unscored[0]["title"] == "Backend Engineer"


def test_score_job_above_threshold(in_memory_store: JobStore):
    now = int(time.time() * 1000)
    in_memory_store.conn.execute(
        """
        INSERT INTO jobs (id, title, company, url, source, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("job-pass", "Senior Engineer", "Acme", "https://example.com/pass", "test", "Python", now, now),
    )
    in_memory_store.conn.commit()

    result = ScoreResult(
        score=82,
        reasoning="Strong technical match",
        matching_skills=["Python"],
        missing_skills=[],
    )

    updated_job = in_memory_store.score_job(job_id="job-pass", result=result)
    assert updated_job["fit_score"] == 82
    assert updated_job["status"] == "new"  # remains 'new' / ready for tailoring

    # Verify directly in SQLite
    row = in_memory_store.conn.execute(
        "SELECT fit_score, fit_notes, status, updated_at FROM jobs WHERE id = ?", ("job-pass",)
    ).fetchone()
    assert row[0] == 82
    fit_notes = json.loads(row[1])
    assert fit_notes["reasoning"] == "Strong technical match"
    assert fit_notes["matching_skills"] == ["Python"]
    assert row[2] == "new"
    assert row[3] >= now


def test_score_job_below_threshold(in_memory_store: JobStore):
    now = int(time.time() * 1000)
    in_memory_store.conn.execute(
        """
        INSERT INTO jobs (id, title, company, url, source, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("job-fail", "DevOps Engineer", "Acme", "https://example.com/fail", "test", "Kubernetes", now, now),
    )
    in_memory_store.conn.commit()

    result = ScoreResult(
        score=60,
        reasoning="Lacks Kubernetes experience",
        matching_skills=[],
        missing_skills=["Kubernetes"],
    )

    updated_job = in_memory_store.score_job(job_id="job-fail", result=result)
    assert updated_job["fit_score"] == 60
    assert updated_job["status"] == "rejected_by_score"

    row = in_memory_store.conn.execute(
        "SELECT fit_score, status FROM jobs WHERE id = ?", ("job-fail",)
    ).fetchone()
    assert row[0] == 60
    assert row[1] == "rejected_by_score"


def test_score_job_updates_clean_description(in_memory_store: JobStore):
    now = int(time.time() * 1000)
    in_memory_store.conn.execute(
        """
        INSERT INTO jobs (id, title, company, url, source, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("job-clean", "0 notifications", "LinkedIn Company", "https://example.com/clean", "test", "Raw messy description with EEOC...", now, now),
    )
    in_memory_store.conn.commit()

    result = ScoreResult(
        score=90,
        reasoning="Great fit",
        matching_skills=["PyTorch"],
        missing_skills=[],
        clean_title="Staff Machine Learning Engineer",
        clean_company="Acme AI Corp",
        clean_description="Clean sanitized markdown description",
        is_valid_job=True,
        is_truncated=False,
    )

    in_memory_store.score_job(job_id="job-clean", result=result)

    row = in_memory_store.conn.execute(
        "SELECT title, company, description, fit_score, status FROM jobs WHERE id = ?", ("job-clean",)
    ).fetchone()
    assert row[0] == "Staff Machine Learning Engineer"
    assert row[1] == "Acme AI Corp"
    assert row[2] == "Clean sanitized markdown description"
    assert row[3] == 90
    assert row[4] == "new"


def test_score_job_marks_invalid_job_when_not_real_posting(in_memory_store: JobStore):
    now = int(time.time() * 1000)
    in_memory_store.conn.execute(
        """
        INSERT INTO jobs (id, title, company, url, source, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        ("job-junk", "0 notifications", "LinkedIn", "https://www.linkedin.com/notifications", "linkedin", "Notification feed items...", now, now),
    )
    in_memory_store.conn.commit()

    result = ScoreResult(
        score=0,
        reasoning="Not a job posting: LinkedIn notifications feed",
        matching_skills=[],
        missing_skills=[],
        is_valid_job=False,
    )

    in_memory_store.score_job(job_id="job-junk", result=result)

    row = in_memory_store.conn.execute(
        "SELECT fit_score, status FROM jobs WHERE id = ?", ("job-junk",)
    ).fetchone()
    assert row[0] is None
    assert row[1] == "invalid_job"


def test_get_user_effective_llm_with_named_connections(in_memory_store: JobStore):
    now = int(time.time() * 1000)
    in_memory_store.conn.execute(
        """
        CREATE TABLE IF NOT EXISTS connections (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          name TEXT NOT NULL,
          api_type TEXT NOT NULL,
          base_url TEXT NOT NULL,
          api_key TEXT NOT NULL DEFAULT '',
          is_built_in INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
        """
    )
    in_memory_store.conn.execute(
        """
        CREATE TABLE IF NOT EXISTS user_connection_keys (
          user_id TEXT NOT NULL,
          connection_id TEXT NOT NULL,
          api_key TEXT NOT NULL DEFAULT '',
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (user_id, connection_id)
        )
        """
    )
    in_memory_store.conn.execute(
        """
        INSERT INTO connections (id, user_id, name, api_type, base_url, api_key, is_built_in, created_at, updated_at)
        VALUES ('conn_builtin_groq', NULL, 'Groq', 'groq', 'https://api.groq.com/openai/v1', '', 1, ?, ?)
        """,
        (now, now),
    )
    in_memory_store.conn.execute(
        """
        INSERT INTO user_connection_keys (user_id, connection_id, api_key, updated_at)
        VALUES ('u1', 'conn_builtin_groq', 'gsk-test-groq-key', ?)
        """,
        (now,),
    )
    in_memory_store.conn.execute(
        """
        INSERT INTO user_settings (user_id, key, value, updated_at)
        VALUES
          ('u1', 'gateway_connection_id', 'conn_builtin_groq', ?),
          ('u1', 'default_llm_model', 'groq/llama-3.3-70b-versatile', ?)
        """,
        (now, now),
    )
    in_memory_store.conn.commit()

    config = in_memory_store.get_user_effective_llm("u1")
    assert config["api_base"] == "https://api.groq.com/openai/v1"
    assert config["api_key"] == "gsk-test-groq-key"
    assert config["model"] == "groq/llama-3.3-70b-versatile"
    assert config["has_user_key"] is True

    tailor_config = in_memory_store.get_user_effective_tailor("u1")
    assert tailor_config["api_base"] == "https://api.groq.com/openai/v1"
    assert tailor_config["api_key"] == "gsk-test-groq-key"


