from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock

from src.tracing import build_trace_config_from_settings, trace_context


def test_build_trace_config_from_settings_supports_all_providers():
    cfg = build_trace_config_from_settings(
        {
            "opik_enabled": "true",
            "opik_api_key": "test-opik-placeholder",
            "opik_project_name": "jf",
            "langfuse_enabled": "true",
            "langfuse_public_key": "test-lf-public-placeholder",
            "langfuse_secret_key": "test-lf-val-placeholder",
            "langsmith_enabled": "true",
            "langsmith_api_key": "test-ls-placeholder",
        }
    )
    assert cfg is not None
    assert cfg["opik"]["enabled"] is True
    assert cfg["langfuse"]["enabled"] is True
    assert cfg["langsmith"]["enabled"] is True


def test_scorer_trace_context_emits_to_enabled_provider(monkeypatch):
    opik_client = MagicMock()
    opik_trace = MagicMock()
    opik_span = MagicMock()
    opik_client.trace.return_value = opik_trace
    opik_trace.span.return_value = opik_span
    monkeypatch.setitem(sys.modules, "opik", types.SimpleNamespace(Opik=MagicMock(return_value=opik_client)))

    cfg = {"opik": {"enabled": True, "api_key": "test-opik-placeholder", "project_name": "jf"}}
    with trace_context(trace_config=cfg, trace_metadata={"user_id": "u1", "job_id": "j1"}, span_name="score_job") as ctx:
        ctx.record_llm_call(model="m", messages=[], output="80", usage=None, latency_ms=12.0)
        ctx.set_output({"score": 80})

    opik_trace.span.assert_called_once()
    opik_span.end.assert_called_once()
    opik_trace.end.assert_called_once()
    opik_client.flush.assert_called_once()
