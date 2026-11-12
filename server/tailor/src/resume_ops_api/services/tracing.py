from __future__ import annotations

import logging
import os
from typing import Any

from resume_ops_api.core.config import Settings

logger = logging.getLogger(__name__)


def _register_callback(name: str, success_cb: list[Any], failure_cb: list[Any]) -> None:
    if name not in success_cb:
        success_cb.append(name)
    if name not in failure_cb:
        failure_cb.append(name)


def _configure_opik(settings: Settings, success_cb: list[Any], failure_cb: list[Any]) -> None:
    opik_key = settings.opik_api_key or os.getenv("OPIK_API_KEY")
    opik_url = settings.opik_url_override or os.getenv("OPIK_URL_OVERRIDE")
    if not (opik_key or opik_url):
        return
    if settings.opik_api_key:
        os.environ["OPIK_API_KEY"] = settings.opik_api_key
    if settings.opik_project_name:
        os.environ["OPIK_PROJECT_NAME"] = settings.opik_project_name
    if settings.opik_workspace:
        os.environ["OPIK_WORKSPACE"] = settings.opik_workspace
    if settings.opik_url_override:
        os.environ["OPIK_URL_OVERRIDE"] = settings.opik_url_override
    _register_callback("opik", success_cb, failure_cb)
    logger.info("Opik tracing enabled for project '%s'.", settings.opik_project_name)


def _configure_langfuse(settings: Settings, success_cb: list[Any], failure_cb: list[Any]) -> None:
    pub = settings.langfuse_public_key or os.getenv("LANGFUSE_PUBLIC_KEY")
    sec = settings.langfuse_secret_key or os.getenv("LANGFUSE_SECRET_KEY")
    if not (pub and sec):
        return
    os.environ["LANGFUSE_PUBLIC_KEY"] = pub
    os.environ["LANGFUSE_SECRET_KEY"] = sec
    host = settings.langfuse_host or os.getenv("LANGFUSE_HOST") or "https://cloud.langfuse.com"
    os.environ["LANGFUSE_HOST"] = host
    _register_callback("langfuse", success_cb, failure_cb)
    logger.info("Langfuse LLM tracing activated via LiteLLM callbacks.")


def _configure_langsmith(settings: Settings, success_cb: list[Any], failure_cb: list[Any]) -> None:
    key = settings.langsmith_api_key or os.getenv("LANGSMITH_API_KEY") or os.getenv("LANGCHAIN_API_KEY")
    if not key:
        return
    os.environ["LANGSMITH_API_KEY"] = key
    os.environ["LANGCHAIN_API_KEY"] = key
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    proj = settings.langsmith_project or os.getenv("LANGSMITH_PROJECT") or "jobfoundry"
    endpoint = settings.langsmith_endpoint or os.getenv("LANGSMITH_ENDPOINT") or "https://api.smith.langchain.com"
    os.environ["LANGSMITH_PROJECT"] = proj
    os.environ["LANGSMITH_ENDPOINT"] = endpoint
    _register_callback("langsmith", success_cb, failure_cb)
    logger.info("LangSmith LLM tracing activated via LiteLLM callbacks.")


def setup_tracing(settings: Settings) -> None:
    """Configures global tracing integrations (Opik / Langfuse / LangSmith / LiteLLM) if ENABLE_TRACING is True."""
    if not settings.enable_tracing:
        logger.debug("Tracing is disabled (ENABLE_TRACING=false).")
        return

    try:
        import litellm

        success_callbacks: list[Any] = list(getattr(litellm, "success_callback", []) or [])
        failure_callbacks: list[Any] = list(getattr(litellm, "failure_callback", []) or [])

        _configure_opik(settings, success_callbacks, failure_callbacks)
        _configure_langfuse(settings, success_callbacks, failure_callbacks)
        _configure_langsmith(settings, success_callbacks, failure_callbacks)

        litellm.success_callback = success_callbacks
        litellm.failure_callback = failure_callbacks

    except ImportError:
        logger.warning("LiteLLM tracing requested but 'litellm' package is not installed.")
    except Exception as exc:
        logger.warning("Failed to initialize tracing: %s", exc)
