from __future__ import annotations

import logging
import os
from typing import Any

from resume_ops_api.core.config import Settings

logger = logging.getLogger(__name__)


def setup_tracing(settings: Settings) -> None:
    """Configures global tracing integrations (Opik / Langfuse / LangSmith / LiteLLM) if ENABLE_TRACING is True."""
    if not settings.enable_tracing:
        logger.debug("Tracing is disabled (ENABLE_TRACING=false).")
        return

    try:
        import litellm

        success_callbacks: list[Any] = list(getattr(litellm, "success_callback", []) or [])
        failure_callbacks: list[Any] = list(getattr(litellm, "failure_callback", []) or [])

        # 1. Opik Tracing
        if settings.opik_api_key or os.getenv("OPIK_API_KEY") or settings.opik_url_override or os.getenv("OPIK_URL_OVERRIDE"):
            if settings.opik_api_key:
                os.environ["OPIK_API_KEY"] = settings.opik_api_key
            if settings.opik_project_name:
                os.environ["OPIK_PROJECT_NAME"] = settings.opik_project_name
            if settings.opik_workspace:
                os.environ["OPIK_WORKSPACE"] = settings.opik_workspace
            if settings.opik_url_override:
                os.environ["OPIK_URL_OVERRIDE"] = settings.opik_url_override
            if "opik" not in success_callbacks:
                success_callbacks.append("opik")
            if "opik" not in failure_callbacks:
                failure_callbacks.append("opik")
            logger.info(f"Opik tracing enabled for project '{settings.opik_project_name}'.")

        # 2. Langfuse Tracing
        langfuse_pub = settings.langfuse_public_key or os.getenv("LANGFUSE_PUBLIC_KEY")
        langfuse_sec = settings.langfuse_secret_key or os.getenv("LANGFUSE_SECRET_KEY")
        if langfuse_pub and langfuse_sec:
            os.environ["LANGFUSE_PUBLIC_KEY"] = langfuse_pub
            os.environ["LANGFUSE_SECRET_KEY"] = langfuse_sec
            if settings.langfuse_host or os.getenv("LANGFUSE_HOST"):
                os.environ["LANGFUSE_HOST"] = settings.langfuse_host or os.getenv("LANGFUSE_HOST") or "https://cloud.langfuse.com"
            if "langfuse" not in success_callbacks:
                success_callbacks.append("langfuse")
            if "langfuse" not in failure_callbacks:
                failure_callbacks.append("langfuse")
            logger.info("Langfuse LLM tracing activated via LiteLLM callbacks.")

        # 3. LangSmith Tracing
        langsmith_key = settings.langsmith_api_key or os.getenv("LANGSMITH_API_KEY") or os.getenv("LANGCHAIN_API_KEY")
        if langsmith_key:
            os.environ["LANGSMITH_API_KEY"] = langsmith_key
            os.environ["LANGCHAIN_API_KEY"] = langsmith_key
            os.environ["LANGCHAIN_TRACING_V2"] = "true"
            if settings.langsmith_project or os.getenv("LANGSMITH_PROJECT"):
                os.environ["LANGSMITH_PROJECT"] = settings.langsmith_project or os.getenv("LANGSMITH_PROJECT") or "jobfoundry"
            if settings.langsmith_endpoint or os.getenv("LANGSMITH_ENDPOINT"):
                os.environ["LANGSMITH_ENDPOINT"] = settings.langsmith_endpoint or os.getenv("LANGSMITH_ENDPOINT") or "https://api.smith.langchain.com"
            if "langsmith" not in success_callbacks:
                success_callbacks.append("langsmith")
            if "langsmith" not in failure_callbacks:
                failure_callbacks.append("langsmith")
            logger.info("LangSmith LLM tracing activated via LiteLLM callbacks.")

        litellm.success_callback = success_callbacks
        litellm.failure_callback = failure_callbacks

    except ImportError:
        logger.warning("LiteLLM tracing requested but 'litellm' package is not installed.")
    except Exception as exc:
        logger.warning(f"Failed to initialize tracing: {exc}")
