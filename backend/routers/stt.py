import os
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from services.stt_queue import enqueue_stt
from services.stt_service import STT_INITIAL_PROMPT
from models.database import SessionLocal
from models.models import SpeechCorrectionRule
from utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)

_ALLOWED_SUFFIXES = {".webm", ".wav", ".mp3", ".ogg", ".m4a", ".mp4"}


def _build_initial_prompt(assistant_id: int) -> str:
    """從該助理的誤字對照表取 correct_text，合併到 STT_INITIAL_PROMPT。"""
    db = SessionLocal()
    try:
        rules = (
            db.query(SpeechCorrectionRule)
            .filter(
                SpeechCorrectionRule.assistant_id == assistant_id,
                SpeechCorrectionRule.enabled == True,
            )
            .all()
        )
        terms = [r.correct_text for r in rules if r.correct_text]
    finally:
        db.close()

    if not terms:
        return STT_INITIAL_PROMPT

    extra = "、".join(dict.fromkeys(terms))  # 去重、保序
    prompt = f"{STT_INITIAL_PROMPT}、{extra}" if STT_INITIAL_PROMPT else extra
    logger.debug("[STT] assistant_id=%s initial_prompt terms=%d", assistant_id, len(terms))
    return prompt


@router.post("/stt/transcribe")
async def stt_transcribe(
    file: UploadFile = File(...),
    language: str = Form("zh"),
    assistant_id: Optional[str] = Form(None),
):
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower() or ".webm"
    if ext not in _ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail=f"不支援的音訊格式: {ext}")

    initial_prompt = STT_INITIAL_PROMPT
    if assistant_id:
        try:
            initial_prompt = _build_initial_prompt(int(assistant_id))
        except Exception as e:
            logger.warning("[STT] 取得助理對照表失敗，改用預設 prompt: %s", e)

    try:
        audio_bytes = await file.read()
        text = await enqueue_stt(audio_bytes, suffix=ext, language=language, initial_prompt=initial_prompt)
        logger.info("STT result (len=%d): %s", len(text), text[:120])
        return {"text": text}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("STT transcribe failed: %s", e)
        raise HTTPException(status_code=500, detail=f"STT failed: {e}")
