from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel
import edge_tts
import tempfile
import os

router = APIRouter()

class TTSRequest(BaseModel):
    text: str

@router.post("/tts/edge")
async def edge_tts_endpoint(request: TTSRequest):
    try:
        # 使用微軟台灣男聲
        voice = "zh-TW-YunJheNeural" 
        communicate = edge_tts.Communicate(request.text, voice)
        
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
        print(f"Edge TTS Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
