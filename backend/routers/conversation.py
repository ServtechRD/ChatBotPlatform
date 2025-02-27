from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload
from sqlalchemy import exists
from typing import List
from models.database import get_db
from models.models import Conversation as ORMConversation, Message, AIAssistant
from models.schemas import ConversationCreate, Conversation, Message as MessageSchema

router = APIRouter()


# 创建新的对话
@router.post("/conversation/", response_model=Conversation)
def create_conversation(
        conversation_data: ConversationCreate,
        db: Session = Depends(get_db)
):
    # 验证助理是否存在
    assistant = db.query(AIAssistant).filter(AIAssistant.assistant_id == conversation_data.assistant_id).first()
    if not assistant:
        raise HTTPException(status_code=404, detail="Assistant not found")

    # 创建新的对话
    new_conversation = Conversation(
        assistant_id=conversation_data.assistant_id,
        customer_id=conversation_data.customer_id,
        customer_name=conversation_data.customer_name,
        customer_email=conversation_data.customer_email
    )
    db.add(new_conversation)
    db.commit()
    db.refresh(new_conversation)

    return new_conversation


# 获取指定对话的所有消息
@router.get("/conversation/{conversation_id}/messages", response_model=List[MessageSchema])
def get_conversation_messages(
        conversation_id: int,
        db: Session = Depends(get_db)
):
    # 检查对话是否存在
    conversation = db.query(Conversation).filter(Conversation.conversation_id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 获取该对话的所有消息
    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.timestamp).all()
    return messages


# 获取用户的所有对话
@router.get("/user/{assistant_id}/conversations", response_model=List[Conversation])
def get_user_conversations(
        assistant_id: int,
        db: Session = Depends(get_db)
):
    # 查找用户的所有对话
    conversations = (db.query(ORMConversation).filter(ORMConversation.assistant_id == assistant_id)
                     .filter(exists().where(ORMConversation.conversation_id == Message.conversation_id))
                     .options(joinedload(ORMConversation.messages))  # 预加载 messages 避免 N+1 查询问题
                     .all())
    if not conversations:
        raise HTTPException(status_code=404, detail="No conversations found for this user")

    return conversations


# 结束对话并保存对话内容
@router.post("/conversation/{conversation_id}/finalize")
def finalize_conversation(
        conversation_id: int,
        db: Session = Depends(get_db)
):
    # 查找对话
    conversation = db.query(Conversation).filter(Conversation.conversation_id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 检查对话是否已经完成
    if hasattr(conversation, 'completed') and conversation.completed:
        raise HTTPException(status_code=400, detail="Conversation already finalized")

    # 查找该对话的所有消息，确保至少有一条消息
    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.timestamp).all()
    if not messages:
        raise HTTPException(status_code=400, detail="No messages found in this conversation")

    # 处理完成的对话（比如可以添加一些后续逻辑）
    # 标记为完成
    conversation.completed = True
    conversation.completed_at = datetime.utcnow()

    # 更新数据库状态
    db.commit()

    return {
        "status": "success",
        "message": "Conversation finalized and saved.",
        "conversation_id": conversation_id,
        "total_messages": len(messages),
        "final_message": messages[-1].content  # 返回最后一条消息的内容
    }
