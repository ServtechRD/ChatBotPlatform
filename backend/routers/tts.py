from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
import edge_tts
import tempfile
import os
import io
import wave
import numpy as np

router = APIRouter()

_kokoro_pipeline = None

class TTSRequest(BaseModel):
    text: str
    rate: str = "+0%"


class KokoroTTSRequest(BaseModel):
    text: str
    voice: str = "zf_xiaoni"
    speed: float = 1.0


def _float_audio_to_wav_bytes(audio: np.ndarray, sample_rate: int = 24000) -> bytes:
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
    global _kokoro_pipeline
    if _kokoro_pipeline is not None:
        return _kokoro_pipeline

    try:
        from kokoro import KPipeline
    except Exception as e:
        raise RuntimeError(
            "Kokoro is not available. Install it with `pip install kokoro`."
        ) from e

    # "z" language code supports Chinese generation in Kokoro pipeline.
    _kokoro_pipeline = KPipeline(lang_code="z")
    return _kokoro_pipeline


def _synthesize_kokoro(text: str, voice: str, speed: float) -> bytes:
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
    return _float_audio_to_wav_bytes(combined, sample_rate=24000)

@router.post("/tts/edge")
async def edge_tts_endpoint(request: TTSRequest):
    try:
        # 使用微軟台灣男聲
        voice = "zh-TW-YunJheNeural" 
        communicate = edge_tts.Communicate(request.text, voice, rate=request.rate)
        
        # 將音訊寫入記憶體或暫存檔
        # 這裡示範簡單寫入暫存檔後讀取
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
            temp_filename = temp_file.name
            
        await communicate.save(temp_filename)
        
        with open(temp_filename, "rb") as f:
            audio_content = f.read()
            
        os.remove(temp_filename) # 清理檔案
        
        return Response(content=audio_content, media_type="audio/mpeg")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Edge TTS Error: {e}, attempting gTTS fallback...")
        
        # Fallback to gTTS (Google Translate TTS)
        # Note: gTTS usually provides a standard voice (often female/robotic), 
        # but it ensures the service remains available.
        try:
            from gtts import gTTS
            import io
            
            # gTTS save to memory
            tts = gTTS(text=request.text, lang='zh-tw')
            fp = io.BytesIO()
            tts.write_to_fp(fp)
            fp.seek(0)
            
            return Response(content=fp.read(), media_type="audio/mpeg")
        except Exception as gtts_e:
            print(f"gTTS Fallback Error: {gtts_e}")
            raise HTTPException(status_code=500, detail=f"TTS failed: {e} and Fallback failed: {gtts_e}")


@router.post("/tts/kokoro")
async def kokoro_tts_endpoint(request: KokoroTTSRequest):
    try:
        audio_content = _synthesize_kokoro(
            text=request.text,
            voice=request.voice,
            speed=request.speed,
        )
        return Response(content=audio_content, media_type="audio/wav")
    except Exception as e:
        print(f"Kokoro TTS Error: {e}")
        raise HTTPException(status_code=500, detail=f"Kokoro TTS failed: {e}")
