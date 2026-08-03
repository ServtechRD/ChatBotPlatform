"""外部系統整合用 API Key（環境變數 INTEGRATION_API_KEY）。"""

from __future__ import annotations

import os
import secrets

from utils.logger import get_logger

logger = get_logger(__name__)

_ENV_NAME = "INTEGRATION_API_KEY"


def get_configured_api_key() -> str | None:
    value = (os.getenv(_ENV_NAME) or "").strip()
    return value or None


def is_api_key_configured() -> bool:
    return get_configured_api_key() is not None


def verify_integration_api_key(provided: str | None) -> bool:
    expected = get_configured_api_key()
    if not expected or not provided:
        return False
    return secrets.compare_digest(provided.strip(), expected)
