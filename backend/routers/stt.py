import os

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from services.stt_service import transcribe
from utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)

_ALLOWED_SUFFIXES = {".webm", ".wav", ".mp3", ".ogg", ".m4a", ".mp4"}


@router.post("/stt/transcribe")
async def stt_transcribe(
    file: UploadFile = File(...),
    language: str = Form("zh"),
):
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower() or ".webm"
    if ext not in _ALLOWED_SUFFIXES:
        raise HTTPException(status_code=400, detail=f"不支援的音訊格式: {ext}")

    try:
        audio_bytes = await file.read()
        text = transcribe(audio_bytes, suffix=ext, language=language)
        logger.info("STT result (len=%d): %s", len(text), text[:120])
        return {"text": text}
    except Exception as e:
        logger.exception("STT transcribe failed: %s", e)
        raise HTTPException(status_code=500, detail=f"STT failed: {e}")
