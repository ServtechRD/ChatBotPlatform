from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


# 用户创建模型
class UserCreate(BaseModel):
    email: str
    password: str


# 登录和注册成功后的JWT返回模型
class Token(BaseModel):
    access_token: str
    token_type: str


# 助理创建模型
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


# 助理的完整响应模型
class Assistant(BaseModel):
    assistant_id: int
    name: str
    description: Optional[str] = None
    status: bool

    image_assistant: Optional[str] = None  # 助理图路径
    image_crop: Optional[str] = None  # 裁剪图路径
    video_1: Optional[str] = None  # 第一个视频路径
    video_2: Optional[str] = None  # 第二个视频路径
    language: Optional[str] = None  # 预设语言
    link: Optional[str] = None  # 外部链接
    note: Optional[str] = None  # 备注

    message_welcome: Optional[str] = None
    message_noidea: Optional[str] = None
    message_other: Optional[str] = None

    created_at: datetime

    class Config:
        orm_mode = True


# 消息模型
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


# 对话模型
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
