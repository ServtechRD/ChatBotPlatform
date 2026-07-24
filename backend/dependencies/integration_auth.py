"""整合 API 的 X-API-Key 驗證 dependency。"""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer

from services.auth_service import verify_token
from services.integration_api_key import verify_integration_api_key
from utils.client_ip import get_client_ip
from utils.logger import get_logger

logger = get_logger(__name__)

API_KEY_HEADER = "X-API-Key"

_oauth2_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


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


def require_integration_api_key_or_bearer(
    request: Request,
    x_api_key: str | None = Header(default=None, alias=API_KEY_HEADER),
    token: str | None = Depends(_oauth2_optional),
) -> None:
    """允許 X-API-Key（整合）或 Bearer token（前端登入使用者）。"""
    if verify_integration_api_key(x_api_key):
        logger.info(
            "integration_api_key authenticated ip=%s method=%s path=%s",
            get_client_ip(request),
            request.method,
            request.url.path,
        )
        return

    if token and verify_token(token) is not None:
        return

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing API key / bearer token",
    )
