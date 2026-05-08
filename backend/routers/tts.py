from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
import edge_tts
import tempfile
import os
import io
import re

router = APIRouter()

# Edge TTS：預設聲線與語速（請求 body 可覆寫；需重啟後端才生效）
EDGE_DEFAULT_VOICE = os.getenv("EDGE_DEFAULT_VOICE", "zh-TW-HsiaoChenNeural")
EDGE_RATE = os.getenv("EDGE_RATE", "-3%")


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

@router.post("/tts/edge")
async def edge_tts_endpoint(request: TTSRequest):
    try:
        voice = (request.voice or EDGE_DEFAULT_VOICE).strip()
        processed_text = preprocess_tts_text(request.text)
        communicate = edge_tts.Communicate(processed_text, voice, rate=request.rate)
        
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
            
            # gTTS save to memory
            processed_text = preprocess_tts_text(request.text)
            tts = gTTS(text=processed_text, lang='zh-TW')
            fp = io.BytesIO()
            tts.write_to_fp(fp)
            fp.seek(0)
            
            return Response(content=fp.read(), media_type="audio/mpeg")
        except Exception as gtts_e:
            print(f"gTTS Fallback Error: {gtts_e}")
            raise HTTPException(status_code=500, detail=f"TTS failed: {e} and Fallback failed: {gtts_e}")


