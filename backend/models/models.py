from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from models.database import Base
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    permission_level = Column(Integer, default=3) 
    # permission_level = Column(Integer, default=1) 
    is_admin = Column(Boolean, default=False)
    
    # TOTP MFA fields
    totp_secret = Column(String(255), nullable=True)
    is_totp_enabled = Column(Boolean, default=False)
    # is_totp_enabled = Column(Boolean, default=True)

    # 一个用户可以拥有多个助理
    assistants = relationship("AIAssistant", back_populates="owner")


class AIAssistant(Base):
    __tablename__ = "assistants"

    assistant_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Boolean, default=True)  # 用于表示助理是否启用
    created_at = Column(DateTime, default=datetime.utcnow)

    # 外键关联到用户
    owner_id = Column(Integer, ForeignKey("users.user_id"))
    owner = relationship("User", back_populates="assistants")

    # 一个助理可以有多个对话记录
    conversations = relationship("Conversation", back_populates="assistant")

    knowledges = relationship("KnowledgeBase", back_populates="assistant")

    # 新增字段
    image_assistant = Column(String(255), nullable=True)  # 助理图路径
    image_crop = Column(String(255), nullable=True)  # 裁剪图路径
    video_1 = Column(String(255), nullable=True)  # 第一个视频路径
    video_2 = Column(String(255), nullable=True)  # 第二个视频路径
    language = Column(String(50), nullable=False)  # 预设语言
    link = Column(String(255), nullable=True)  # 外部链接
    note = Column(Text, nullable=True)  # 备注

    # 新增加字段
    message_welcome = Column(Text, nullable=True)
    message_noidea = Column(Text, nullable=True)
    message_other = Column(Text, nullable=True)


class Conversation(Base):
    __tablename__ = "conversations"

    conversation_id = Column(Integer, primary_key=True, index=True)
    assistant_id = Column(Integer, ForeignKey("assistants.assistant_id"), nullable=False)
    customer_id = Column(String(255), nullable=False)  # 存储客户唯一ID
    customer_name = Column(String(255), nullable=True)
    customer_email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # 关联到助理
    assistant = relationship("AIAssistant", back_populates="conversations")

    # 一个对话可以包含多个消息
    messages = relationship("Message", back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"

    message_id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.conversation_id"), nullable=False)
    sender = Column(String(255), nullable=False)  # 记录是谁发送的，可能是“客户”或“助理”
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # 关联到对话
    conversation = relationship("Conversation", back_populates="messages")


class KnowledgeBase(Base):
    __tablename__ = 'knowledge_base'

    id = Column(Integer, primary_key=True, autoincrement=True)
    assistant_id = Column(Integer, ForeignKey("assistants.assistant_id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    summary = Column(Text, nullable=False)
    keywords = Column(Text, nullable=False)
    doc_ids = Column(Text, nullable=False)
    comment = Column(String(255), nullable=True)
    token_count = Column(Integer, nullable=False)
    upload_date = Column(DateTime, default=datetime.utcnow)

    # 关联到助理
    assistant = relationship("AIAssistant", back_populates="knowledges")
