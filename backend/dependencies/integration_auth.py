"""整合 API 的 X-API-Key 驗證 dependency。"""

from __future__ import annotations

from fastapi import Header, HTTPException, Request, status

from services.integration_api_key import verify_integration_api_key
from utils.client_ip import get_client_ip
from utils.logger import get_logger

logger = get_logger(__name__)

API_KEY_HEADER = "X-API-Key"


def require_integration_api_key(
    request: Request,
    x_api_key: str | None = Header(default=None, alias=API_KEY_HEADER),
) -> None:
    if not verify_integration_api_key(x_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )

    logger.info(
        "integration_api_key authenticated ip=%s method=%s path=%s",
        get_client_ip(request),
        request.method,
        request.url.path,
    )
