"""語音辨識錯字 → 正字規則：查詢、批次建立、更新與替換引擎。"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import List, Optional, Sequence, Tuple

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from models.models import SpeechCorrectionRule
from models.schemas import (
    SpeechCorrectionRuleCreate,
    SpeechCorrectionRuleGroup,
    SpeechCorrectionRuleGroupUpsert,
    SpeechCorrectionRuleOut,
    SpeechCorrectionRuleUpdate,
)


class SpeechCorrectionValidationError(ValueError):
    """規則欄位驗證失敗。"""


def _rule_sort_key(rule: SpeechCorrectionRule) -> Tuple[int, int, int]:
    return (
        -int(rule.priority or 0),
        -len(rule.wrong_text or ""),
        int(rule.id or 0),
    )


def normalize_wrong_texts(wrong_texts: Sequence[str], correct_text: str) -> List[str]:
    """trim、保序去重、過濾空字串；禁止 wrong 與 correct 相同。"""
    correct = (correct_text or "").strip()
    if not correct:
        raise SpeechCorrectionValidationError("correct_text must not be empty")

    seen: set[str] = set()
    result: List[str] = []
    for raw in wrong_texts:
        w = (raw or "").strip()
        if not w:
            continue
        if w == correct:
            raise SpeechCorrectionValidationError(
                f"wrong_text must not equal correct_text: {w!r}"
            )
        if w in seen:
            continue
        seen.add(w)
        result.append(w)

    if not result:
        raise SpeechCorrectionValidationError(
            "wrong_texts must contain at least one non-empty item after normalization"
        )
    return result


def rule_to_out(rule: SpeechCorrectionRule) -> SpeechCorrectionRuleOut:
    return SpeechCorrectionRuleOut.model_validate(rule)


def _rules_to_group(correct_text: str, rules: List[SpeechCorrectionRule]) -> SpeechCorrectionRuleGroup:
    sorted_rules = sorted(rules, key=_rule_sort_key)
    group_enabled = sorted_rules[0].enabled if sorted_rules else True
    return SpeechCorrectionRuleGroup(
        correct_text=correct_text,
        enabled=group_enabled,
        rules=[rule_to_out(r) for r in sorted_rules],
    )


def list_rules_grouped(
    db: Session,
    assistant_id: int,
    *,
    enabled_only: bool = True,
) -> List[SpeechCorrectionRuleGroup]:
    q = db.query(SpeechCorrectionRule).filter(
        SpeechCorrectionRule.assistant_id == assistant_id
    )
    if enabled_only:
        q = q.filter(SpeechCorrectionRule.enabled.is_(True))
    rules = q.all()
    rules.sort(key=_rule_sort_key)

    groups: dict[str, list[SpeechCorrectionRule]] = defaultdict(list)
    for rule in rules:
        groups[rule.correct_text].append(rule)

    group_keys = sorted(groups.keys(), key=lambda ct: min(r.id for r in groups[ct]))
    return [_rules_to_group(correct_text, groups[correct_text]) for correct_text in group_keys]


def _find_duplicate_wrong_texts(
    db: Session, assistant_id: int, wrong_texts: List[str]
) -> List[str]:
    if not wrong_texts:
        return []
    rows = (
        db.query(SpeechCorrectionRule.wrong_text)
        .filter(
            SpeechCorrectionRule.assistant_id == assistant_id,
            SpeechCorrectionRule.wrong_text.in_(wrong_texts),
        )
        .all()
    )
    existing = {r[0] for r in rows}
    return [w for w in wrong_texts if w in existing]


def create_rules_batch(
    db: Session,
    payload: SpeechCorrectionRuleCreate,
    user_id: int,
) -> List[SpeechCorrectionRuleOut]:
    correct_text = payload.correct_text.strip()
    try:
        items = normalize_wrong_texts(payload.wrong_texts, correct_text)
    except SpeechCorrectionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    duplicates = _find_duplicate_wrong_texts(db, payload.assistant_id, items)
    if duplicates:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "One or more wrong_text values already exist",
                "duplicate_wrong_texts": duplicates,
            },
        )

    now = datetime.utcnow()
    created: List[SpeechCorrectionRule] = []
    try:
        for wrong_text in items:
            rule = SpeechCorrectionRule(
                assistant_id=payload.assistant_id,
                wrong_text=wrong_text,
                correct_text=correct_text,
                enabled=payload.enabled,
                priority=payload.priority,
                created_by=user_id,
                created_at=now,
                updated_at=now,
            )
            db.add(rule)
            created.append(rule)
        db.commit()
        for rule in created:
            db.refresh(rule)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail={
                "message": "One or more wrong_text values already exist",
                "duplicate_wrong_texts": items,
            },
        )

    return [rule_to_out(r) for r in created]


def update_rule(
    db: Session,
    rule_id: int,
    assistant_id: int,
    payload: SpeechCorrectionRuleUpdate,
) -> SpeechCorrectionRuleOut:
    rule = (
        db.query(SpeechCorrectionRule)
        .filter(
            SpeechCorrectionRule.id == rule_id,
            SpeechCorrectionRule.assistant_id == assistant_id,
        )
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    data = payload.model_dump(exclude_unset=True)
    new_wrong = data.get("wrong_text")
    new_correct = data.get("correct_text")

    if new_wrong is not None and new_correct is not None:
        if new_wrong == new_correct:
            raise HTTPException(
                status_code=400,
                detail="wrong_text must not equal correct_text",
            )
    elif new_wrong is not None:
        effective_correct = new_correct if new_correct is not None else rule.correct_text
        if new_wrong == effective_correct:
            raise HTTPException(
                status_code=400,
                detail="wrong_text must not equal correct_text",
            )
    elif new_correct is not None:
        effective_wrong = new_wrong if new_wrong is not None else rule.wrong_text
        if effective_wrong == new_correct:
            raise HTTPException(
                status_code=400,
                detail="wrong_text must not equal correct_text",
            )

    if new_wrong is not None and new_wrong != rule.wrong_text:
        conflict = (
            db.query(SpeechCorrectionRule)
            .filter(
                SpeechCorrectionRule.assistant_id == assistant_id,
                SpeechCorrectionRule.wrong_text == new_wrong,
                SpeechCorrectionRule.id != rule_id,
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "wrong_text already exists",
                    "duplicate_wrong_texts": [new_wrong],
                },
            )

    for key, value in data.items():
        setattr(rule, key, value)
    rule.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(rule)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail={
                "message": "wrong_text already exists",
                "duplicate_wrong_texts": [new_wrong] if new_wrong else [],
            },
        )

    return rule_to_out(rule)


def upsert_rules_group(
    db: Session,
    payload: SpeechCorrectionRuleGroupUpsert,
    user_id: int,
) -> SpeechCorrectionRuleGroup:
    """單一 transaction 建立或同步群組。"""
    assistant_id = payload.assistant_id
    new_ct = payload.correct_text.strip()
    old_ct = (payload.old_correct_text or new_ct).strip()
    try:
        desired_wrongs = normalize_wrong_texts(payload.wrong_texts, new_ct)
    except SpeechCorrectionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    existing = (
        db.query(SpeechCorrectionRule)
        .filter(
            SpeechCorrectionRule.assistant_id == assistant_id,
            SpeechCorrectionRule.correct_text == old_ct,
        )
        .all()
    )

    now = datetime.utcnow()

    if not existing:
        duplicates = _find_duplicate_wrong_texts(db, assistant_id, desired_wrongs)
        if duplicates:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "One or more wrong_text values already exist",
                    "duplicate_wrong_texts": duplicates,
                },
            )
        try:
            for wrong_text in desired_wrongs:
                db.add(
                    SpeechCorrectionRule(
                        assistant_id=assistant_id,
                        wrong_text=wrong_text,
                        correct_text=new_ct,
                        enabled=payload.enabled,
                        priority=100,
                        created_by=user_id,
                        created_at=now,
                        updated_at=now,
                    )
                )
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "One or more wrong_text values already exist",
                    "duplicate_wrong_texts": desired_wrongs,
                },
            )
        rows = (
            db.query(SpeechCorrectionRule)
            .filter(
                SpeechCorrectionRule.assistant_id == assistant_id,
                SpeechCorrectionRule.correct_text == new_ct,
            )
            .all()
        )
        return _rules_to_group(new_ct, rows)

    by_wrong = {r.wrong_text: r for r in existing}
    desired_set = set(desired_wrongs)
    to_add = [w for w in desired_wrongs if w not in by_wrong]
    if to_add:
        duplicates = _find_duplicate_wrong_texts(db, assistant_id, to_add)
        if duplicates:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "One or more wrong_text values already exist",
                    "duplicate_wrong_texts": duplicates,
                },
            )

    try:
        for wrong, rule in list(by_wrong.items()):
            if wrong not in desired_set:
                db.delete(rule)

        for wrong in desired_wrongs:
            rule = by_wrong.get(wrong)
            if rule is not None:
                rule.correct_text = new_ct
                rule.enabled = payload.enabled
                rule.updated_at = now
            else:
                db.add(
                    SpeechCorrectionRule(
                        assistant_id=assistant_id,
                        wrong_text=wrong,
                        correct_text=new_ct,
                        enabled=payload.enabled,
                        priority=100,
                        created_by=user_id,
                        created_at=now,
                        updated_at=now,
                    )
                )

        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail={
                "message": "One or more wrong_text values already exist",
                "duplicate_wrong_texts": to_add,
            },
        )

    rows = (
        db.query(SpeechCorrectionRule)
        .filter(
            SpeechCorrectionRule.assistant_id == assistant_id,
            SpeechCorrectionRule.correct_text == new_ct,
        )
        .all()
    )
    return _rules_to_group(new_ct, rows)


def delete_rule(db: Session, rule_id: int, assistant_id: int) -> None:
    """硬刪單筆錯字規則；同一 correct_text 至少須保留一筆 wrong_text。"""
    rule = (
        db.query(SpeechCorrectionRule)
        .filter(
            SpeechCorrectionRule.id == rule_id,
            SpeechCorrectionRule.assistant_id == assistant_id,
        )
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    siblings_count = (
        db.query(SpeechCorrectionRule)
        .filter(
            SpeechCorrectionRule.assistant_id == assistant_id,
            SpeechCorrectionRule.correct_text == rule.correct_text,
        )
        .count()
    )
    if siblings_count <= 1:
        raise HTTPException(
            status_code=400,
            detail="cannot delete the last wrong_text for this correct_text",
        )

    db.delete(rule)
    db.commit()


def apply_rules(text: str, rules: Sequence[SpeechCorrectionRule]) -> str:
    """依 priority、字串長度、id 排序後做字面替換。"""
    if not text or not isinstance(text, str):
        return text
    sorted_rules = sorted(rules, key=_rule_sort_key)
    result = text
    for rule in sorted_rules:
        if not rule.enabled:
            continue
        wrong = rule.wrong_text
        correct = rule.correct_text
        if not wrong:
            continue
        result = result.split(wrong).join(correct if correct is not None else "")
    return result
