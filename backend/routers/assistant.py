from typing import List
from jose import JWTError, jwt
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db
from models.models import AIAssistant, User
from services.vector_service import process_and_store_file
from services.auth_service import verify_token
from models.schemas import AssistantCreate, Assistant

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


# 创建助理
@router.post("/assistant/create")
def create_assistant(assistant_data: AssistantCreate, token: str = Depends(oauth2_scheme),
                     db: Session = Depends(get_db)):

    user_id = verify_token(token)
    # 验证用户是否存在
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 创建新的助理
    new_assistant = AIAssistant(
        name=assistant_data.name,
        description=assistant_data.description,
        owner_id=user_id
    )
    db.add(new_assistant)
    db.commit()
    db.refresh(new_assistant)

    return {
        "status": "success",
        "assistant_id": new_assistant.assistant_id,
        "message": "Assistant created successfully"
    }


# 上传文件并处理
@router.post("/assistant/{assistant_id}/upload")
async def upload_file(assistant_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # 验证助理是否存在
    assistant = db.query(AIAssistant).filter(AIAssistant.assistant_id == assistant_id).first()
    if not assistant:
        raise HTTPException(status_code=404, detail="Assistant not found")

    # 处理上传的文件，生成嵌入并存储到向量数据库
    await process_and_store_file(assistant_id, file, db)

    return {"message": "File uploaded and embeddings stored in vector database."}


# 获取助理信息
@router.get("/assistant/{assistant_id}")
def get_assistant(assistant_id: int, db: Session = Depends(get_db)):
    # 查找助理信息
    assistant = db.query(AIAssistant).filter(AIAssistant.assistant_id == assistant_id).first()
    if not assistant:
        raise HTTPException(status_code=404, detail="Assistant not found")

    return {
        "assistant_id": assistant.assistant_id,
        "name": assistant.name,
        "description": assistant.description,
        "status": assistant.status,
        "created_at": assistant.created_at
    }


# 切换助理状态 (启用/禁用)
@router.put("/assistant/{assistant_id}/toggle_status")
def toggle_assistant_status(assistant_id: int, db: Session = Depends(get_db)):
    assistant = db.query(AIAssistant).filter(AIAssistant.assistant_id == assistant_id).first()
    if not assistant:
        raise HTTPException(status_code=404, detail="Assistant not found")

    # 切换助理的启用状态
    assistant.status = not assistant.status
    db.commit()

    return {
        "status": "success",
        "assistant_id": assistant.assistant_id,
        "new_status": assistant.status,
        "message": "Assistant status updated."
    }


# 获取用户的所有助理
@router.get("/user/{user_id}/assistants", response_model=List[Assistant])
def get_user_assistants(user_id: int, db: Session = Depends(get_db)):
    # 查询用户是否存在
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 查询用户所有的助理
    assistants = db.query(AIAssistant).filter(AIAssistant.owner_id == user_id).all()

    return assistants
