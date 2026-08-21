from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
import edge_tts
import tempfile
import os
import io
import wave
import re
import time
import asyncio
from collections import OrderedDict
from threading import Lock

from utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)

TTS_PROVIDER = (os.getenv("TTS_PROVIDER") or "edge").strip().lower()
if TTS_PROVIDER not in ("edge", "kokoro"):
    logger.warning("Unknown TTS_PROVIDER=%s, falling back to edge", TTS_PROVIDER)
    TTS_PROVIDER = "edge"

KOKORO_REPO_ID = os.getenv("KOKORO_REPO_ID", "hexgrad/Kokoro-82M")
KOKORO_DEFAULT_VOICE = os.getenv("KOKORO_DEFAULT_VOICE", "zf_xiaoxiao")
try:
    KOKORO_SPEED = float(os.getenv("KOKORO_SPEED", "0.85"))
except ValueError:
    KOKORO_SPEED = 0.85

EDGE_DEFAULT_VOICE = os.getenv("EDGE_DEFAULT_VOICE", "zh-TW-HsiaoChenNeural")
EDGE_RATE = os.getenv("EDGE_RATE", "-3%")

_kokoro_pipeline = None
_kokoro_warmed_up = False
_kokoro_pipeline_lock = Lock()
_kokoro_cache_lock = Lock()
_kokoro_audio_cache = OrderedDict()

SAMPLE_RATE = 24000
KOKORO_CACHE_MAX_ITEMS = 128


class TTSRequest(BaseModel):
    text: str
    rate: str = EDGE_RATE
    voice: str = EDGE_DEFAULT_VOICE


def preprocess_tts_text(text: str) -> str:
    processed = text or ""

    english_token = re.compile(r"[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*")
    result_parts = []
    last_idx = 0
    for match in english_token.finditer(processed):
        start, end = match.span()
        token = match.group(0)
        prev_char = processed[start - 1] if start > 0 else ""
        next_char = processed[end] if end < len(processed) else ""

        result_parts.append(processed[last_idx:start])
        if prev_char and not prev_char.isspace():
            result_parts.append(" ")
        result_parts.append(token)
        if next_char and not next_char.isspace():
            result_parts.append(" ")
        last_idx = end

    result_parts.append(processed[last_idx:])
    processed = "".join(result_parts)
    processed = re.sub(r"[ \t]{2,}", " ", processed)
    return processed


def _tts_response(content: bytes, provider: str, media_type: str) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={"X-TTS-Provider": provider},
    )


def _float_audio_to_wav_bytes(audio, sample_rate: int = SAMPLE_RATE) -> bytes:
    import numpy as np

    clipped = np.clip(audio, -1.0, 1.0)
    pcm16 = (clipped * 32767).astype(np.int16)

    output = io.BytesIO()
    with wave.open(output, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm16.tobytes())
    return output.getvalue()


def _get_kokoro_pipeline():
    global _kokoro_pipeline, _kokoro_warmed_up
    with _kokoro_pipeline_lock:
        if _kokoro_pipeline is not None:
            return _kokoro_pipeline

        try:
            from kokoro import KPipeline
        except Exception as e:
            raise RuntimeError(
                "Kokoro is not available. Install it with `pip install kokoro`."
            ) from e

        _kokoro_pipeline = KPipeline(
            lang_code="z",
            repo_id=KOKORO_REPO_ID,
        )

        if not _kokoro_warmed_up:
            try:
                for _, _, audio in _kokoro_pipeline(
                    "預熱", voice=KOKORO_DEFAULT_VOICE, speed=KOKORO_SPEED
                ):
                    if audio is not None:
                        break
            except Exception as warmup_error:
                logger.warning("Kokoro warmup skipped: %s", warmup_error)
            finally:
                _kokoro_warmed_up = True
        return _kokoro_pipeline


def prewarm_kokoro_pipeline():
    """啟動時預熱 Kokoro，降低第一句冷啟動延遲。"""
    _get_kokoro_pipeline()


def _kokoro_cache_get(text: str, voice: str, speed: float):
    cache_key = (text, voice, round(float(speed), 3))
    with _kokoro_cache_lock:
        cached = _kokoro_audio_cache.get(cache_key)
        if cached is None:
            return None
        _kokoro_audio_cache.move_to_end(cache_key)
        return cached


def _kokoro_cache_set(text: str, voice: str, speed: float, wav_bytes: bytes):
    cache_key = (text, voice, round(float(speed), 3))
    with _kokoro_cache_lock:
        _kokoro_audio_cache[cache_key] = wav_bytes
        _kokoro_audio_cache.move_to_end(cache_key)
        while len(_kokoro_audio_cache) > KOKORO_CACHE_MAX_ITEMS:
            _kokoro_audio_cache.popitem(last=False)


def _synthesize_kokoro(text: str) -> bytes:
    import numpy as np

    voice = KOKORO_DEFAULT_VOICE
    speed = KOKORO_SPEED
    synth_start = time.perf_counter()
    cached_audio = _kokoro_cache_get(text=text, voice=voice, speed=speed)
    if cached_audio is not None:
        elapsed_ms = (time.perf_counter() - synth_start) * 1000
        logger.info(
            "[TTS] kokoro cache=hit text_len=%s elapsed_ms=%.1f",
            len(text),
            elapsed_ms,
        )
        return cached_audio

    pipeline = _get_kokoro_pipeline()
    audio_chunks = []
    for _, _, audio in pipeline(text, voice=voice, speed=speed):
        if audio is None:
            continue
        if hasattr(audio, "numpy"):
            audio = audio.numpy()
        audio_chunks.append(np.asarray(audio, dtype=np.float32))

    if not audio_chunks:
        raise RuntimeError("Kokoro returned empty audio.")

    combined = np.concatenate(audio_chunks)
    wav_bytes = _float_audio_to_wav_bytes(combined, sample_rate=SAMPLE_RATE)
    _kokoro_cache_set(text=text, voice=voice, speed=speed, wav_bytes=wav_bytes)
    elapsed_ms = (time.perf_counter() - synth_start) * 1000
    logger.info(
        "[TTS] kokoro synth_done text_len=%s elapsed_ms=%.1f",
        len(text),
        elapsed_ms,
    )
    return wav_bytes


async def _synthesize_edge(text: str, voice: str, rate: str) -> bytes:
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    temp_filename = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
            temp_filename = temp_file.name
        await communicate.save(temp_filename)
        with open(temp_filename, "rb") as f:
            return f.read()
    finally:
        if temp_filename:
            try:
                os.remove(temp_filename)
            except OSError:
                pass


@router.post("/tts")
@router.post("/tts/edge")
async def tts_endpoint(request: TTSRequest):
    processed_text = preprocess_tts_text(request.text)
    if not processed_text.strip():
        raise HTTPException(status_code=400, detail="TTS text is empty")

    if TTS_PROVIDER == "kokoro":
        try:
            audio_content = await asyncio.to_thread(_synthesize_kokoro, processed_text)
            return _tts_response(audio_content, "kokoro", "audio/wav")
        except Exception as e:
            logger.exception("Kokoro TTS failed")
            raise HTTPException(status_code=500, detail=f"Kokoro TTS failed: {e}") from e

    voice = (request.voice or EDGE_DEFAULT_VOICE).strip()
    rate = request.rate or EDGE_RATE
    try:
        audio_content = await _synthesize_edge(processed_text, voice, rate)
        return _tts_response(audio_content, "edge", "audio/mpeg")
    except Exception as edge_err:
        logger.warning("Edge TTS failed, falling back to Kokoro: %s", edge_err)
        try:
            audio_content = await asyncio.to_thread(_synthesize_kokoro, processed_text)
            return _tts_response(audio_content, "kokoro", "audio/wav")
        except Exception as kokoro_err:
            logger.exception("Kokoro TTS fallback failed")
            raise HTTPException(
                status_code=500,
                detail=f"TTS failed: {edge_err} and Kokoro fallback failed: {kokoro_err}",
            ) from kokoro_err
