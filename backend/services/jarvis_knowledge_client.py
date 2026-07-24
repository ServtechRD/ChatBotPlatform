"""JarvisPlatform Integration API client（list notebooks / knowledge search）。

Auth: X-API-Key = INTEGRATION_API_KEY
Mode: NOTEBOOK_KNOWLEDGE_MODE=mock|http（預設 mock）
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

import httpx

from services.integration_api_key import get_configured_api_key
from utils.logger import get_logger

logger = get_logger(__name__)

API_KEY_HEADER = "X-API-Key"

_MOCK_NOTEBOOKS: List[Dict[str, Any]] = [
    {
        "id": 1,
        "name": "[Mock] 產品說明",
        "description": "假資料：產品 FAQ",
        "service_type": "storage",
        "file_count": 3,
    },
    {
        "id": 2,
        "name": "[Mock] 客服 FAQ",
        "description": "假資料：客服知識",
        "service_type": "storage",
        "file_count": 5,
    },
    {
        "id": 3,
        "name": "[Mock] 技術文件",
        "description": "假資料：API 說明",
        "service_type": "data-source",
        "file_count": 2,
    },
]


def _mode() -> str:
    return (os.getenv("NOTEBOOK_KNOWLEDGE_MODE") or "mock").strip().lower()


def _base_url() -> str:
    return (os.getenv("JARVIS_BASE_URL") or "").strip().rstrip("/")


def _timeout() -> float:
    try:
        return float(os.getenv("JARVIS_HTTP_TIMEOUT", "30"))
    except ValueError:
        return 30.0


def _headers() -> Dict[str, str]:
    key = get_configured_api_key()
    if not key:
        raise RuntimeError("INTEGRATION_API_KEY is not configured")
    return {API_KEY_HEADER: key}


def list_notebooks(email: str) -> List[Dict[str, Any]]:
    """GET /api/integration/notebooks?email=..."""
    email = (email or "").strip()
    if not email:
        return []

    if _mode() != "http":
        logger.info("[Jarvis] mock list_notebooks email=%s count=%d", email, len(_MOCK_NOTEBOOKS))
        return list(_MOCK_NOTEBOOKS)

    base = _base_url()
    if not base:
        raise RuntimeError("JARVIS_BASE_URL is not configured")

    url = f"{base}/api/integration/notebooks"
    with httpx.Client(timeout=_timeout(), verify=False) as client:
        resp = client.get(url, params={"email": email}, headers=_headers())
        resp.raise_for_status()
        data = resp.json()

    if isinstance(data, list):
        return data
    if isinstance(data, dict) and isinstance(data.get("notebooks"), list):
        return data["notebooks"]
    logger.warning("[Jarvis] unexpected list_notebooks payload type=%s", type(data).__name__)
    return []


def search_knowledge(notebook_ids: List[int], ask: str) -> List[Dict[str, Any]]:
    """POST /api/integration/knowledge/search — body: notebook_ids + ask。"""
    ids = [int(x) for x in notebook_ids if x is not None]
    ask = (ask or "").strip()
    if not ids or not ask:
        return []

    if _mode() != "http":
        logger.info(
            "[Jarvis] mock search_knowledge notebook_ids=%s ask_len=%d",
            ids,
            len(ask),
        )
        return [
            {
                "content": (
                    f"[Mock] 與問題「{ask[:80]}」相關的知識片段。\n"
                    f"此內容來自 mock notebook_id={ids[0]}，"
                    "請改 NOTEBOOK_KNOWLEDGE_MODE=http 連正式 Jarvis。"
                ),
                "score": 0.91,
                "source": "mock.txt",
                "notebook_id": ids[0],
            }
        ]

    base = _base_url()
    if not base:
        raise RuntimeError("JARVIS_BASE_URL is not configured")

    url = f"{base}/api/integration/knowledge/search"
    payload = {"notebook_ids": ids, "ask": ask}
    with httpx.Client(timeout=_timeout(), verify=False) as client:
        resp = client.post(url, json=payload, headers=_headers())
        resp.raise_for_status()
        data = resp.json()

    results = data.get("results") if isinstance(data, dict) else None
    if not isinstance(results, list):
        logger.warning("[Jarvis] unexpected search payload type=%s", type(data).__name__)
        return []
    return results


def format_search_results_as_context(results: List[Dict[str, Any]]) -> Optional[str]:
    chunks: List[str] = []
    for item in results:
        content = (item.get("content") or "").strip()
        if content:
            chunks.append(content)
    if not chunks:
        return None
    return "\n\n----------------------------------\n\n".join(chunks)
