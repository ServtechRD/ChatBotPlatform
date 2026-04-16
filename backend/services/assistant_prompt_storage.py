"""
助理專屬 prompt（表單「描述」）儲存：多數情況寫入 DB 的 description；
超過長度上限時改寫入 assistant_prompts/{assistant_id}.txt，DB 僅保留摘要與旗標。
"""
from __future__ import annotations

import os

from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from models.models import AIAssistant
from utils.logger import get_logger

logger = get_logger(__name__)

# MySQL TEXT 上限 65535 bytes；以字元數保守截斷，避免 UTF-8 多位元組溢出
MAX_DESCRIPTION_INLINE_CHARS = 60000

PROMPT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assistant_prompts")


def prompt_file_path(assistant_id: int) -> str:
    return os.path.join(PROMPT_DIR, f"{assistant_id}.txt")


def _ensure_prompt_dir() -> None:
    os.makedirs(PROMPT_DIR, exist_ok=True)


def _delete_prompt_file(assistant_id: int) -> None:
    path = prompt_file_path(assistant_id)
    try:
        if os.path.isfile(path):
            os.remove(path)
    except OSError as e:
        logger.warning("刪除助理 prompt 檔失敗 assistant_id=%s path=%s err=%s", assistant_id, path, e)


def get_effective_description(assistant: AIAssistant) -> str:
    """對話與編輯載入：回傳完整 prompt 文字。"""
    use_file = bool(getattr(assistant, "description_use_file", False))
    if use_file:
        path = prompt_file_path(assistant.assistant_id)
        if os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return f.read()
            except OSError as e:
                logger.warning("讀取助理 prompt 檔失敗 assistant_id=%s err=%s", assistant.assistant_id, e)
        return assistant.description or ""
    return assistant.description or ""


def sync_description_to_storage(db: Session, assistant: AIAssistant, full_text: str) -> None:
    """
    依長度寫入 DB 或檔案，並更新 description_use_file。
    超長時 DB 的 description 僅保留前段摘要供列表顯示。
    """
    text_body = full_text if full_text is not None else ""
    aid = assistant.assistant_id

    if len(text_body) <= MAX_DESCRIPTION_INLINE_CHARS:
        assistant.description = text_body
        assistant.description_use_file = False
        _delete_prompt_file(aid)
        return

    _ensure_prompt_dir()
    path = prompt_file_path(aid)
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text_body)
    except OSError as e:
        logger.exception("寫入助理 prompt 檔失敗 assistant_id=%s", aid)
        raise RuntimeError(f"無法寫入 prompt 檔案: {e}") from e

    excerpt_len = 3500
    excerpt = text_body[:excerpt_len]
    if len(text_body) > excerpt_len:
        excerpt = excerpt + "\n…（以下省略；完整內容已存於伺服器檔案）"
    assistant.description = excerpt
    assistant.description_use_file = True


def ensure_description_use_file_column(engine: Engine) -> None:
    """啟動時補上舊資料庫缺少的欄位（忽略已存在）。"""
    url = str(engine.url)
    with engine.connect() as conn:
        if "sqlite" in url.lower():
            try:
                conn.execute(
                    text("ALTER TABLE assistants ADD COLUMN description_use_file BOOLEAN DEFAULT 0 NOT NULL")
                )
                conn.commit()
            except Exception:
                conn.rollback()
        elif "mysql" in url.lower():
            try:
                conn.execute(
                    text(
                        "ALTER TABLE assistants ADD COLUMN description_use_file TINYINT(1) "
                        "NOT NULL DEFAULT 0"
                    )
                )
                conn.commit()
            except Exception:
                conn.rollback()
