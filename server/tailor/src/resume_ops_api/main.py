from __future__ import annotations

import logging
import uvicorn

from resume_ops_api.api.app import create_app
from resume_ops_api.core.config import get_settings

logger = logging.getLogger("resume-ops-api")


def run() -> None:
    settings = get_settings()
    if not settings.openai_base_url or not settings.openai_base_url.strip():
        logger.info(
            "No global LLM API base configured. Tailor service will rely on "
            "per-request credentials or settings configured in the UI."
        )
    uvicorn.run(
        "resume_ops_api.main:create_app",
        factory=True,
        host=settings.host,
        port=settings.port,
        reload=False,
    )
