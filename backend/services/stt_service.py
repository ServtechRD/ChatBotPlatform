import os
import tempfile

from utils.chinese_convert import to_traditional_tw
from utils.logger import get_logger

logger = get_logger(__name__)

_model = None

STT_MODEL_SIZE = os.getenv("STT_MODEL_SIZE", "medium")
STT_INITIAL_PROMPT = os.getenv(
    "STT_INITIAL_PROMPT",
    "科智企業, MusesAI, JarvisAI, AI SOP, 場域, AMR"
)


def _get_device_and_compute():
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda", "float16"
    except ImportError:
        pass
    return "cpu", "int8"


def get_stt_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        device = os.getenv("STT_DEVICE")
        compute_type = os.getenv("STT_COMPUTE_TYPE")
        if not device or not compute_type:
            auto_device, auto_compute = _get_device_and_compute()
            device = device or auto_device
            compute_type = compute_type or auto_compute
        logger.info("Loading faster-whisper model=%s device=%s compute=%s", STT_MODEL_SIZE, device, compute_type)
        _model = WhisperModel(STT_MODEL_SIZE, device=device, compute_type=compute_type)
        logger.info("faster-whisper model loaded.")
    return _model


def transcribe(audio_bytes: bytes, suffix: str = ".webm", language: str = "zh") -> str:
    import time
    model = get_stt_model()
    logger.info("[STT] 收到音訊 bytes=%d suffix=%s language=%s", len(audio_bytes), suffix, language)
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name
    try:
        t0 = time.perf_counter()
        segments, info = model.transcribe(
            tmp_path,
            language=language,
            initial_prompt=STT_INITIAL_PROMPT,
            vad_filter=True,
        )
        raw = "".join(seg.text for seg in segments).strip()
        elapsed = time.perf_counter() - t0
        logger.info(
            "[STT] 辨識完成 elapsed=%.2fs detected_lang=%s prob=%.2f raw=%s",
            elapsed, info.language, info.language_probability, repr(raw[:120])
        )
        result = to_traditional_tw(raw)
        if result != raw:
            logger.info("[STT] 簡轉繁: %s -> %s", repr(raw[:80]), repr(result[:80]))
        if not result:
            logger.warning("[STT] 辨識結果為空（無語音或雜訊過多）")
        return result
    finally:
        os.remove(tmp_path)
