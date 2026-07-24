from datetime import date
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import exists, func
from sqlalchemy.orm import Session, joinedload

from dependencies.integration_auth import require_integration_api_key
from models.database import get_db
from models.models import AIAssistant, Conversation, Message, User
from models.schemas import (
    Conversation as ConversationSchema,
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
_GUEST_ASSISTANT_NAME = "guest"
_GUEST_OWNER_EMAIL = "admin@servtech.com.tw"
_IGNORED_CLIENT_IPS = frozenset({"", "---"})


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


def _resolve_guest_assistant(db: Session) -> AIAssistant:
    guest = (
        db.query(AIAssistant)
        .join(User, AIAssistant.owner_id == User.user_id)
        .filter(func.lower(AIAssistant.name) == _GUEST_ASSISTANT_NAME)
        .filter(User.email == _GUEST_OWNER_EMAIL)
        .order_by(AIAssistant.assistant_id.asc())
        .first()
    )
    if guest is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Guest assistant not found",
        )
    return guest


def _latest_qa_by_conversation_ids(
    db: Session,
    cid_to_meta: Dict[int, Dict[str, str]],
) -> Dict[str, IntegrationLatestQaItem]:
    """cid_to_meta: conversation_id → {key, name}；回傳 key → QA item。"""
    if not cid_to_meta:
        return {}

    messages = (
        db.query(Message)
        .filter(Message.conversation_id.in_(list(cid_to_meta.keys())))
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

    result: Dict[str, IntegrationLatestQaItem] = {}
    for cid, msgs in latest_two_by_cid.items():
        meta = cid_to_meta[cid]
        qa = _pick_latest_qa(msgs)
        qa.name = meta["name"]
        result[meta["key"]] = qa
    return result


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
    """全站每個助理一筆：有訊息的最新 conversation 之最新兩則 message 組成問答（台北時間；需 X-API-Key）。"""
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
            .filter(exists().where(Conversation.conversation_id == Message.conversation_id))
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
    "/integration/ips/latest-qa",
    response_model=Dict[str, IntegrationLatestQaItem],
)
def list_ips_latest_qa(
    _: None = Depends(require_integration_api_key),
    db: Session = Depends(get_db),
):
    """guest 助理：每個 client_ip 一筆「有訊息的」最新 conversation 的最新問答（需 X-API-Key）。"""
    guest = _resolve_guest_assistant(db)

    latest_cid_by_ip = {
        row.client_ip: row.latest_cid
        for row in (
            db.query(
                Conversation.client_ip,
                func.max(Conversation.conversation_id).label("latest_cid"),
            )
            .filter(Conversation.assistant_id == guest.assistant_id)
            .filter(Conversation.client_ip.isnot(None))
            .filter(~Conversation.client_ip.in_(list(_IGNORED_CLIENT_IPS)))
            .filter(exists().where(Conversation.conversation_id == Message.conversation_id))
            .group_by(Conversation.client_ip)
            .all()
        )
    }
    if not latest_cid_by_ip:
        return {}

    cid_to_meta = {
        cid: {"key": ip, "name": guest.name}
        for ip, cid in latest_cid_by_ip.items()
    }
    return _latest_qa_by_conversation_ids(db, cid_to_meta)


@router.get(
    "/integration/ips/conversations",
    response_model=List[ConversationSchema],
)
def list_guest_conversations_by_ip(
    ip: str = Query(..., min_length=1, description="client_ip（IPv4 / IPv6）"),
    _: None = Depends(require_integration_api_key),
    db: Session = Depends(get_db),
):
    """guest 助理：依 client_ip 列出含訊息的對話（回傳同 /user/{assistant_id}/conversations；需 X-API-Key）。"""
    guest = _resolve_guest_assistant(db)
    normalized_ip = ip.strip()
    conversations = (
        db.query(Conversation)
        .filter(Conversation.assistant_id == guest.assistant_id)
        .filter(Conversation.client_ip == normalized_ip)
        .filter(exists().where(Conversation.conversation_id == Message.conversation_id))
        .options(joinedload(Conversation.messages))
        .order_by(Conversation.conversation_id.asc())
        .all()
    )
    return conversations or []


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
