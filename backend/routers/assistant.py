from typing import List, Optional

from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db
from models.models import AIAssistant, User
from services.vector_service import process_and_store_file, list_knowledge
from services.auth_service import verify_token
from models.schemas import AssistantCreate, Assistant
import os
import uuid

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# 定义文件保存路径
UPLOAD_DIR = "../../uploads/assets"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def save_file(file: UploadFile, sub_dir: str) -> str:
    """
    保存上传文件并返回文件路径
    :param file: 上传的文件
    :param sub_dir: 文件子目录（图片或视频）
    :return: 文件保存路径
    """
    if not file:
        return None

    # 创建子目录
    dir_path = os.path.join(UPLOAD_DIR, sub_dir)
    os.makedirs(dir_path, exist_ok=True)

    # 生成唯一文件名
    file_ext = file.filename.split(".")[-1]
    file_name = f"{uuid.uuid4().hex}.{file_ext}"
    file_path = os.path.join(dir_path, file_name)

    # 保存文件
    with open(file_path, "wb") as f:
        f.write(file.file.read())

    return file_path


# 创建助理
@router.post("/assistant/create")
def create_assistant(assistant_data: AssistantCreate,
                     assistant_image: Optional[UploadFile] = File(None),
                     crop_image: Optional[UploadFile] = File(None),
                     video_1: Optional[UploadFile] = File(None),
                     video_2: Optional[UploadFile] = File(None),
                     token: str = Depends(oauth2_scheme),
                     db: Session = Depends(get_db)):
    user_id = verify_token(token)
    # 验证用户是否存在
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

        # 保存上传的文件
    assistant_image_path = save_file(assistant_image, "images")
    crop_image_path = save_file(crop_image, "images")
    video_1_path = save_file(video_1, "videos")
    video_2_path = save_file(video_2, "videos")

    # 生成唯一 link
    unique_link = f"assistant-{uuid.uuid4().hex[:8]}"

    # 创建新的助理
    new_assistant = AIAssistant(
        name=assistant_data.name,
        description=assistant_data.description,
        owner_id=user_id,

        image_assistant=assistant_image_path,
        image_crop=crop_image_path,
        video_1=video_1_path,
        video_2=video_2_path,
        language=assistant_data.default_language,
        link=unique_link,
        note=assistant_data.note
    )
    db.add(new_assistant)
    db.commit()
    db.refresh(new_assistant)

    return {
        "status": "success",
        "assistant_id": new_assistant.assistant_id,
        "message": "Assistant created successfully",
        "file_paths": {
            "assistant_image": assistant_image_path,
            "crop_image": crop_image_path,
            "video_1": video_1_path,
            "video_2": video_2_path
        }
    }


# 上传文件并处理
@router.post("/assistant/{assistant_id}/upload")
async def upload_file(assistant_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    # 验证助理是否存在
    assistant = db.query(AIAssistant).filter(AIAssistant.assistant_id == assistant_id).first()
    if not assistant:
        raise HTTPException(status_code=404, detail="Assistant not found")

    # 处理上传的文件，生成嵌入并存储到向量数据库
    result = await process_and_store_file(assistant_id, file, db)
    print(type(result), result)

    return {"message": "File uploaded and embeddings stored in vector database.", "data": result["km"]}


@router.get("/assistant/{assistant_id}/knowledge")
async def get_knowlege(assistant_id: int, db: Session = Depends(get_db)):
    # 验证助理是否存在
    assistant = db.query(AIAssistant).filter(AIAssistant.assistant_id == assistant_id).first()
    if not assistant:
        raise HTTPException(status_code=404, detail="Assistant not found")

    # 处理上传的文件，生成嵌入并存储到向量数据库
    knowledge = list_knowledge(assistant_id, db)

    return {"status": "success", "message": "", "data": knowledge}


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
