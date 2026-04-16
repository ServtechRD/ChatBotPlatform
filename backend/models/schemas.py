from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


# 使用者建立模型
class UserCreate(BaseModel):
    email: str
    password: str


# 登入與註冊成功後的 JWT 回傳模型
class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: Optional[str] = None
    mfa_setup_required: Optional[bool] = False
    mfa_required: Optional[bool] = False
    temp_token: Optional[str] = None


# 助理建立模型
class AssistantCreate(BaseModel):
    name: str
    description: Optional[str] = None
    language: str
    note: Optional[str] = None


class AssistantUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None
    note: Optional[str] = None


# 助理的完整回應模型
class Assistant(BaseModel):
    assistant_id: int
    name: str
    description: Optional[str] = None
    description_use_file: Optional[bool] = False
    status: bool

    image_assistant: Optional[str] = None  # 助理圖路徑
    image_crop: Optional[str] = None  # 裁剪圖路徑
    video_1: Optional[str] = None  # 第一支影片路徑
    video_2: Optional[str] = None  # 第二支影片路徑
    language: Optional[str] = None  # 預設語言
    link: Optional[str] = None  # 外部連結
    note: Optional[str] = None  # 備註

    message_welcome: Optional[str] = None
    message_noidea: Optional[str] = None
    message_other: Optional[str] = None

    created_at: datetime

    class Config:
        orm_mode = True


# 訊息模型
class MessageCreate(BaseModel):
    sender: str
    content: str


class Message(BaseModel):
    message_id: int
    conversation_id: int
    sender: str
    content: str
    timestamp: datetime

    class Config:
        orm_mode = True


# 對話模型
class ConversationCreate(BaseModel):
    customer_id: str
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None


class Conversation(BaseModel):
    conversation_id: int
    assistant_id: int
    customer_id: str
    customer_name: Optional[str]
    customer_email: Optional[str]
    created_at: datetime
    messages: List[Message] = []

    class Config:
        orm_mode = True
