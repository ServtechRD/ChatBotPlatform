"""助理 ↔ Jarvis Notebook 綁定。"""

from __future__ import annotations

from typing import List, Sequence

from sqlalchemy.orm import Session

from models.models import AssistantNotebook
from models.schemas import AssistantNotebookItem


def list_bindings(db: Session, assistant_id: int) -> List[AssistantNotebook]:
    return (
        db.query(AssistantNotebook)
        .filter(AssistantNotebook.assistant_id == assistant_id)
        .order_by(AssistantNotebook.notebook_id)
        .all()
    )


def list_enabled_notebook_ids(db: Session, assistant_id: int) -> List[int]:
    rows = (
        db.query(AssistantNotebook.notebook_id)
        .filter(
            AssistantNotebook.assistant_id == assistant_id,
            AssistantNotebook.enabled.is_(True),
        )
        .order_by(AssistantNotebook.notebook_id)
        .all()
    )
    return [int(r[0]) for r in rows]


def replace_bindings(
    db: Session,
    assistant_id: int,
    notebooks: Sequence[AssistantNotebookItem],
) -> List[AssistantNotebook]:
    (
        db.query(AssistantNotebook)
        .filter(AssistantNotebook.assistant_id == assistant_id)
        .delete(synchronize_session=False)
    )

    seen = set()
    created: List[AssistantNotebook] = []
    for item in notebooks:
        nid = int(item.notebook_id)
        if nid in seen:
            continue
        seen.add(nid)
        row = AssistantNotebook(
            assistant_id=assistant_id,
            notebook_id=nid,
            notebook_name=(item.notebook_name or None),
            enabled=True,
        )
        db.add(row)
        created.append(row)

    db.commit()
    for row in created:
        db.refresh(row)
    return created
