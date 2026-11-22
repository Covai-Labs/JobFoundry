import os
from fastapi.testclient import TestClient
from src.main import build_app


def test_main_app_boots(monkeypatch):
    monkeypatch.setenv("USE_STUB_LLM", "1")
    monkeypatch.setenv("SCORER_THRESHOLD", "75")
    app = build_app()
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_main_app_boots_without_api_base(monkeypatch):
    monkeypatch.delenv("USE_STUB_LLM", raising=False)
    monkeypatch.delenv("OPENROUTER_API_BASE", raising=False)
    monkeypatch.delenv("SCORER_API_BASE", raising=False)
    monkeypatch.delenv("OPENAI_API_BASE", raising=False)
    monkeypatch.setenv("SCORER_THRESHOLD", "75")
    app = build_app()
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
