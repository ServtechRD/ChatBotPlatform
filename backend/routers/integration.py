from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from dependencies.integration_auth import require_integration_api_key
from models.database import get_db
from models.models import AIAssistant, User
from models.schemas import IntegrationAssistantSummary

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
