# -*- coding: utf-8 -*-
"""從 HTTP Request / WebSocket 取出客戶端 IP（優先 X-Forwarded-For）。"""
from __future__ import annotations

from typing import Any, Mapping, Optional


_DEFAULT_IP = "---"


def get_client_ip(request_or_ws: Any) -> str:
    """
    支援 Starlette/FastAPI Request 與 WebSocket。
    有反向代理時讀 X-Forwarded-For 第一個；否則用 client.host。
    取不到時回傳 ---。
    """
    headers: Optional[Mapping[str, str]] = getattr(request_or_ws, "headers", None)
    if headers is not None:
        xff = headers.get("x-forwarded-for") or headers.get("X-Forwarded-For")
        if xff:
            return xff.split(",")[0].strip() or _DEFAULT_IP

    client = getattr(request_or_ws, "client", None)
    if client is not None:
        host = getattr(client, "host", None)
        if host:
            return host
    return _DEFAULT_IP
