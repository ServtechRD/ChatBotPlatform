from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
import edge_tts
import tempfile
import os

router = APIRouter()

class TTSRequest(BaseModel):
    text: str
    rate: str = "+0%"

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
