from fastapi import APIRouter, Request, Response, HTTPException, Depends
from fastapi.responses import FileResponse, JSONResponse
from starlette.responses import HTMLResponse
from starlette.middleware.cors import CORSMiddleware
from typing import Optional
import os

# 引入模型
from models.database import get_db
from models.models import AIAssistant
from sqlalchemy.orm import Session


# 創建路由器
router = APIRouter(tags=["embed"])


# 獲取助手嵌入信息API
@router.get("/api/embed/assistant/{assistant_link}")
async def get_embed_assistant_info(assistant_link: str, db: Session = Depends(get_db)):
    """
    根據ID獲取用於嵌入的助手信息
    """
    try:
        # 查詢助手信息
        assistant = db.query(AIAssistant).filter(AIAssistant.link == assistant_link).first()


        if not assistant:
            raise HTTPException(status_code=404, detail="找不到指定ID的助手")

        # 返回必要的助手信息
        return {
            "id": assistant.assistant_id,
            "name": assistant.name,
            "assistant_image": assistant.image_crop,
            "video_1": assistant.video_1,
            "message_welcome": assistant.message_welcome
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"伺服器錯誤: {str(e)}")


# 處理CORS配置
@router.options("/api/embed/assistant/{assistant_link}", include_in_schema=False)
async def options_embed_assistant_info():
    """
    處理跨域預檢請求
    """
    return Response(
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )


# 嵌入式腳本服務
@router.get("/embed.js")
async def serve_embed_script():
    """
    提供嵌入腳本
    """
    script_path = os.path.join("public", "embed.js")

    if os.path.exists(script_path):
        return FileResponse(
            script_path,
            media_type="application/javascript",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=86400"
            }
        )
    else:
        raise HTTPException(status_code=404, detail="找不到嵌入腳本")