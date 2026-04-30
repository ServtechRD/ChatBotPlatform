# -*- coding: utf-8 -*-
"""
HTTP 請求稽核：記錄來源 IP、路徑、查詢／本文參數（敏感欄位遮罩）、狀態碼、耗時、Bearer 對應 user。
"""
from __future__ import annotations

import json
import re
import time
from typing import Callable
from urllib.parse import parse_qs

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from services import auth_service
from utils.logger import get_logger

logger = get_logger("http_audit")

# 含密碼或 token 的 key（不分大小寫比對）
_SENSITIVE_KEY_RE = re.compile(
    r"(password|secret|token|authorization|refresh_token|access_token|client_secret)",
    re.I,
)

# 不記錄 URL 路徑前綴（靜態檔流量大）
_SKIP_PREFIXES: tuple[str, ...] = ("/public/", "/images/", "/videos/")


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "-"


def _redact_obj(obj: object) -> object:
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            ks = str(k)
            if _SENSITIVE_KEY_RE.search(ks):
                out[k] = "***"
            else:
                out[k] = _redact_obj(v)
        return out
    if isinstance(obj, list):
        return [_redact_obj(x) for x in obj[:50]]
    return obj


def _preview_body(content_type: str, raw: bytes, max_len: int = 8192) -> str:
    if not raw:
        return ""
    if "multipart/form-data" in (content_type or ""):
        return "<multipart; body not logged>"
    try:
        text = raw[:max_len].decode("utf-8", errors="replace")
    except Exception:
        return f"<binary len={len(raw)}>"
    if len(raw) > max_len:
        text += f"... [truncated, total={len(raw)} bytes]"
    ct = content_type or ""
    if "application/json" in ct:
        try:
            parsed = json.loads(raw.decode("utf-8"))
            return json.dumps(_redact_obj(parsed), ensure_ascii=False)
        except (json.JSONDecodeError, UnicodeDecodeError):
            pass
    if "application/x-www-form-urlencoded" in ct or "form-urlencoded" in ct:
        try:
            qs = parse_qs(raw.decode("utf-8", errors="replace"), keep_blank_values=True)
            safe = {k: ("***" if _SENSITIVE_KEY_RE.search(k) else v) for k, v in qs.items()}
            return json.dumps(safe, ensure_ascii=False)
        except Exception:
            pass
    return _redact_obj(text) if isinstance(text, str) else str(text)


def _actor_from_request(request: Request) -> str:
    auth = request.headers.get("authorization") or ""
    if not auth.startswith("Bearer "):
        return "-"
    token = auth[7:].strip()
    if not token:
        return "-"
    uid = auth_service.verify_token(token)
    if uid is not None:
        return f"user_id={uid}"
    uid_r = auth_service.verify_refresh_token(token)
    if uid_r is not None:
        return f"user_id={uid_r}(refresh)"
    return "Bearer(invalid_or_temp)"


class RequestAuditMiddleware(BaseHTTPMiddleware):
    def __init__(
        self,
        app: ASGIApp,
        skip_prefixes: tuple[str, ...] = _SKIP_PREFIXES,
    ):
        super().__init__(app)
        self._skip_prefixes = skip_prefixes

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if path.startswith(self._skip_prefixes):
            return await call_next(request)

        method = request.method
        query = str(request.query_params) if request.query_params else ""
        ip = _client_ip(request)
        actor = _actor_from_request(request)

        body_note = ""
        ct = request.headers.get("content-type", "")
        inner_request = request
        if method in ("POST", "PUT", "PATCH", "DELETE"):
            if "multipart/form-data" in ct:
                body_note = "body=<multipart; not read>"
            else:
                try:
                    raw = await request.body()
                    body_note = _preview_body(ct, raw)

                    async def receive():
                        return {"type": "http.request", "body": raw, "more_body": False}

                    inner_request = Request(request.scope, receive)
                except Exception as e:
                    body_note = f"<read body error: {e}>"

        t0 = time.perf_counter()
        try:
            response = await call_next(inner_request)
            status = response.status_code
        except Exception:
            elapsed_ms = (time.perf_counter() - t0) * 1000
            logger.exception(
                "ip=%s method=%s path=%s query=%s actor=%s elapsed_ms=%.2f error",
                ip,
                method,
                path,
                query,
                actor,
                elapsed_ms,
            )
            raise

        elapsed_ms = (time.perf_counter() - t0) * 1000
        ua = request.headers.get("user-agent", "")[:200]
        log_msg = (
            f"ip={ip} method={method} path={path} query={query} "
            f"status={status} elapsed_ms={elapsed_ms:.2f} actor={actor} ua={ua!r}"
        )
        if body_note:
            log_msg += f" body={body_note}"

        if status >= 500:
            logger.error(log_msg)
        elif status >= 400:
            logger.warning(log_msg)
        else:
            logger.info(log_msg)

        return response
