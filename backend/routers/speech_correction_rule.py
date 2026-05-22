from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from models.database import get_db
from models.schemas import (
    SpeechCorrectionRuleCreate,
    SpeechCorrectionRuleGroup,
    SpeechCorrectionRuleGroupUpsert,
    SpeechCorrectionRuleOut,
    SpeechCorrectionRuleUpdate,
)
from services.auth_service import verify_token
from services.speech_correction_service import (
    create_rules_batch,
    delete_rule,
    list_rules_grouped,
    update_rule,
    upsert_rules_group,
)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user_id(token: str = Depends(oauth2_scheme)) -> int:
    user_id = verify_token(token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return int(user_id)


@router.get("", response_model=List[SpeechCorrectionRuleGroup])
def get_speech_correction_rules(
    assistant_id: int,
    enabled_only: bool = True,
    db: Session = Depends(get_db),
    _user_id: int = Depends(get_current_user_id),
):
    """依 correct_text 分組回傳規則列表（需登入）。"""
    return list_rules_grouped(db, assistant_id, enabled_only=enabled_only)


@router.post(
    "",
    response_model=List[SpeechCorrectionRuleOut],
    status_code=status.HTTP_201_CREATED,
)
def post_speech_correction_rules(
    payload: SpeechCorrectionRuleCreate,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """批次建立規則；wrong_texts 為前端去重後的陣列（單筆時長度為 1）。"""
    return create_rules_batch(db, payload, user_id)


@router.put("/group", response_model=SpeechCorrectionRuleGroup)
def put_speech_correction_rule_group(
    payload: SpeechCorrectionRuleGroupUpsert,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """一次同步正確關鍵字群組（錯字清單 + 群組 enabled）。"""
    return upsert_rules_group(db, payload, user_id)


@router.put("/{rule_id}", response_model=SpeechCorrectionRuleOut)
def put_speech_correction_rule(
    rule_id: int,
    assistant_id: int,
    payload: SpeechCorrectionRuleUpdate,
    db: Session = Depends(get_db),
    _user_id: int = Depends(get_current_user_id),
):
    """更新單筆規則（含群組啟用 enabled）。"""
    return update_rule(db, rule_id, assistant_id, payload)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_speech_correction_rule(
    rule_id: int,
    assistant_id: int,
    db: Session = Depends(get_db),
    _user_id: int = Depends(get_current_user_id),
):
    """硬刪單筆錯字；同一正確關鍵字至少須保留一筆錯字。"""
    delete_rule(db, rule_id, assistant_id)
