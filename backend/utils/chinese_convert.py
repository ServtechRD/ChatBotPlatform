"""LLM 回覆簡體轉台灣繁體（OpenCC s2twp）。"""

import os
import threading
from typing import Optional

from utils.logger import get_logger

logger = get_logger(__name__)

_OPENCC_CONFIG = "s2twp"
_converter_lock = threading.Lock()
_converter: Optional[object] = None


def _s2t_enabled() -> bool:
    raw = (os.getenv("LLM_S2T_POSTPROCESS") or "true").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def _get_converter():
    global _converter
    if _converter is not None:
        return _converter
    with _converter_lock:
        if _converter is not None:
            return _converter
        try:
            from opencc import OpenCC  # type: ignore[import-untyped]
        except ImportError as e:
            raise RuntimeError(
                "未安裝 opencc-python-reimplemented，請執行: pip install opencc-python-reimplemented"
            ) from e
        _converter = OpenCC(_OPENCC_CONFIG)
        logger.info("[簡轉繁] OpenCC 已載入 config=%s", _OPENCC_CONFIG)
        return _converter


def to_traditional_tw(text: str) -> str:
    """將文字轉為台灣繁體；未啟用或空字串時原樣回傳。"""
    if not text or not _s2t_enabled():
        return text
    try:
        return _get_converter().convert(text)
    except Exception:
        logger.exception("[簡轉繁] 轉換失敗，回傳原始文字")
        return text
