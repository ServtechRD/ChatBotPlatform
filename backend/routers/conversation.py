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


# 建立新的對話
@router.post("/conversation/", response_model=Conversation)
def create_conversation(
        conversation_data: ConversationCreate,
        db: Session = Depends(get_db)
):
    # 驗證助理是否存在
    assistant = db.query(AIAssistant).filter(AIAssistant.assistant_id == conversation_data.assistant_id).first()
    if not assistant:
        raise HTTPException(status_code=404, detail="Assistant not found")

    # 建立新的對話
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


# 取得指定對話的所有訊息
@router.get("/conversation/{conversation_id}/messages", response_model=List[MessageSchema])
def get_conversation_messages(
        conversation_id: int,
        db: Session = Depends(get_db)
):
    # 檢查對話是否存在
    conversation = db.query(Conversation).filter(Conversation.conversation_id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 取得該對話的所有訊息
    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.timestamp).all()
    return messages


# 取得使用者的所有對話
@router.get("/user/{assistant_id}/conversations", response_model=List[Conversation])
def get_user_conversations(
        assistant_id: int,
        db: Session = Depends(get_db)
):
    # 查詢使用者的所有對話
    conversations = (db.query(ORMConversation).filter(ORMConversation.assistant_id == assistant_id)
                     .filter(exists().where(ORMConversation.conversation_id == Message.conversation_id))
                     .options(joinedload(ORMConversation.messages))  # 預先載入 messages，避免 N+1 查詢
                     .all())
    if not conversations:
        return []

    return conversations


# 結束對話並儲存對話內容
@router.post("/conversation/{conversation_id}/finalize")
def finalize_conversation(
        conversation_id: int,
        db: Session = Depends(get_db)
):
    # 查詢對話
    conversation = db.query(Conversation).filter(Conversation.conversation_id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # 檢查對話是否已完成
    if hasattr(conversation, 'completed') and conversation.completed:
        raise HTTPException(status_code=400, detail="Conversation already finalized")

    # 查詢該對話的所有訊息，確保至少有一則訊息
    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.timestamp).all()
    if not messages:
        raise HTTPException(status_code=400, detail="No messages found in this conversation")

    # 處理完成的對話（例如可新增後續邏輯）
    # 標記為完成
    conversation.completed = True
    conversation.completed_at = datetime.utcnow()

    # 更新資料庫狀態
    db.commit()

    return {
        "status": "success",
        "message": "Conversation finalized and saved.",
        "conversation_id": conversation_id,
        "total_messages": len(messages),
        "final_message": messages[-1].content  # 傳回最後一則訊息的內容
    }
