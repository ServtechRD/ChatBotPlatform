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
