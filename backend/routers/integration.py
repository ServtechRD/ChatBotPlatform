from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from dependencies.integration_auth import require_integration_api_key
from models.database import get_db
from models.models import AIAssistant, Message, User
from models.schemas import IntegrationAssistantSummary, IntegrationMessageCount
from utils.timezone import taipei_inclusive_range_to_utc_naive, taipei_today

router = APIRouter(tags=["integration"])


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
