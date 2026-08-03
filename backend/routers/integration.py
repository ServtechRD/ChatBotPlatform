from datetime import date
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from dependencies.integration_auth import require_integration_api_key
from models.database import get_db
from models.models import AIAssistant, Conversation, Message, User
from models.schemas import (
    IntegrationAssistantSummary,
    IntegrationLatestQaItem,
    IntegrationMessageCount,
)
from utils.timezone import (
    format_utc_naive_as_taipei,
    taipei_inclusive_range_to_utc_naive,
    taipei_today,
)

router = APIRouter(tags=["integration"])

_QUESTION_SENDERS = frozenset({"客户", "客戶", "customer"})
_ANSWER_SENDERS = frozenset({"助理", "assistant"})


def _pick_latest_qa(messages: List[Message]) -> IntegrationLatestQaItem:
    """messages 應已依 timestamp/message_id 新→舊排序且最多兩則。"""
    question = answer = None
    question_at = answer_at = None
    for msg in messages:
        sender = (msg.sender or "").strip()
        if sender in _QUESTION_SENDERS and question is None:
            question = msg.content
            question_at = format_utc_naive_as_taipei(msg.timestamp)
        elif sender in _ANSWER_SENDERS and answer is None:
            answer = msg.content
            answer_at = format_utc_naive_as_taipei(msg.timestamp)
    return IntegrationLatestQaItem(
        name="",  # caller fills
        question=question,
        answer=answer,
        question_at=question_at,
        answer_at=answer_at,
    )


@router.get(
    "/integration/assistants",
    response_model=List[IntegrationAssistantSummary],
)
def list_assistants_by_owner_email(
    email: str = Query(..., min_length=1, description="助理擁有者 Users.email"),
    _: None = Depends(require_integration_api_key),
    db: Session = Depends(get_db),
):
    """外部系統用：依擁有者 email 列出助理（僅 assistant_id / name / link；需 X-API-Key）。"""
    normalized = email.strip()
    return (
        db.query(AIAssistant)
        .join(User, AIAssistant.owner_id == User.user_id)
        .filter(User.email == normalized)
        .order_by(AIAssistant.assistant_id)
        .all()
    )


@router.get(
    "/integration/assistants/latest-qa",
    response_model=Dict[str, IntegrationLatestQaItem],
)
def list_assistants_latest_qa(
    _: None = Depends(require_integration_api_key),
    db: Session = Depends(get_db),
):
    """全站每個助理一筆：最新 conversation 的最新兩則 message 組成問答（台北時間；需 X-API-Key）。"""
    assistants = db.query(AIAssistant).order_by(AIAssistant.assistant_id).all()
    result: Dict[str, IntegrationLatestQaItem] = {
        str(a.assistant_id): IntegrationLatestQaItem(name=a.name)
        for a in assistants
    }
    if not assistants:
        return result

    latest_cid_by_assistant = {
        row.assistant_id: row.latest_cid
        for row in (
            db.query(
                Conversation.assistant_id,
                func.max(Conversation.conversation_id).label("latest_cid"),
            )
            .group_by(Conversation.assistant_id)
            .all()
        )
    }
    if not latest_cid_by_assistant:
        return result

    cid_to_assistant = {cid: aid for aid, cid in latest_cid_by_assistant.items()}
    conversation_ids = list(cid_to_assistant.keys())

    messages = (
        db.query(Message)
        .filter(Message.conversation_id.in_(conversation_ids))
        .order_by(
            Message.conversation_id,
            Message.timestamp.desc(),
            Message.message_id.desc(),
        )
        .all()
    )

    latest_two_by_cid: Dict[int, List[Message]] = {}
    for msg in messages:
        bucket = latest_two_by_cid.setdefault(msg.conversation_id, [])
        if len(bucket) < 2:
            bucket.append(msg)

    for cid, msgs in latest_two_by_cid.items():
        assistant_id = cid_to_assistant[cid]
        key = str(assistant_id)
        qa = _pick_latest_qa(msgs)
        qa.name = result[key].name
        result[key] = qa

    return result


@router.get(
    "/integration/conversations/messages/count",
    response_model=IntegrationMessageCount,
)
def count_messages_by_taipei_date_range(
    start_date: Optional[date] = Query(None, description="起日（台北日曆日 YYYY-MM-DD）；未帶則今天"),
    end_date: Optional[date] = Query(None, description="迄日（台北日曆日 YYYY-MM-DD）；未帶則今天"),
    _: None = Depends(require_integration_api_key),
    db: Session = Depends(get_db),
):
    """外部系統用：全站訊息筆數（依台北時區日曆日起訖過濾 Message.timestamp；需 X-API-Key）。"""
    today = taipei_today()
    start = start_date or today
    end = end_date or today
    if start > end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date must be on or before end_date",
        )

    utc_start, utc_end = taipei_inclusive_range_to_utc_naive(start, end)
    count = (
        db.query(Message)
        .filter(Message.timestamp >= utc_start, Message.timestamp < utc_end)
        .count()
    )
    return IntegrationMessageCount(start_date=start, end_date=end, count=count)
