from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from dependencies.integration_auth import require_integration_api_key
from models.database import get_db
from models.models import AIAssistant
from models.schemas import Assistant

router = APIRouter(tags=["integration"])


@router.get("/integration/assistants", response_model=List[Assistant])
def list_all_assistants(
    _: None = Depends(require_integration_api_key),
    db: Session = Depends(get_db),
):
    """外部系統用：列出全部助理（需 X-API-Key）。"""
    return db.query(AIAssistant).order_by(AIAssistant.assistant_id).all()
