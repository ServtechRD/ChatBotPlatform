#!/usr/bin/env python3
"""
本機壓測用輕量 API 伺服器（假 embedding，真實上傳 + FAISS 鎖路徑）。

啟動：
    cd backend
    python load_tests/load_test_server.py

預設 http://127.0.0.1:3200（可用 LOAD_TEST_PORT 覆寫）
測試帳號：loadtest@local / loadtest123
"""
from __future__ import annotations

import os
import sys
import types
import uuid
from pathlib import Path
from unittest.mock import MagicMock

BACKEND_ROOT = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_ROOT)
sys.path.insert(0, str(BACKEND_ROOT))

DB_PATH = BACKEND_ROOT / "load_tests" / "loadtest_run.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{DB_PATH.as_posix()}")
os.environ.setdefault("RAG_GPU_CONCURRENCY", "5")
os.environ.setdefault("RAG_QUEUE_MAX_SIZE", "50")

# SQLite 併發寫入需較長 busy timeout
from sqlalchemy import event  # noqa: E402

def _configure_sqlite(engine):
    if engine.dialect.name == "sqlite":
        @event.listens_for(engine, "connect")
        def _set_sqlite_pragma(dbapi_conn, _):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=30000")
            cursor.close()

EMBED_DIM = 768


class _FakeEmbeddings:
    def embed_documents(self, texts):
        return [[0.01] * EMBED_DIM for _ in texts]

    def embed_query(self, _text):
        return [0.01] * EMBED_DIM

    def __call__(self, text):
        return self.embed_query(text)


def _install_stubs() -> None:
    for name in ("rake_nltk",):
        sys.modules.setdefault(name, MagicMock())

    tiktoken_mod = types.ModuleType("tiktoken")
    enc = MagicMock()
    enc.encode = lambda s: list(range(max(1, len(s) // 4)))
    tiktoken_mod.get_encoding = lambda _name: enc
    sys.modules["tiktoken"] = tiktoken_mod

    langid_mod = types.ModuleType("langid")
    langid_mod.classify = lambda _text: ("zh", 0.99)
    sys.modules["langid"] = langid_mod

    chat_models = types.ModuleType("langchain_community.chat_models")
    chat_models.ChatOpenAI = MagicMock()
    sys.modules["langchain_community.chat_models"] = chat_models

    transformers = types.ModuleType("transformers")
    transformers.pipeline = MagicMock(return_value=MagicMock())
    sys.modules["transformers"] = transformers

    llm_stub = types.ModuleType("services.llm_service")
    sys.modules["services.llm_service"] = llm_stub


_install_stubs()

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile  # noqa: E402
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
import bcrypt  # noqa: E402
import uvicorn  # noqa: E402

from models.database import Base, engine, get_db  # noqa: E402

_configure_sqlite(engine)
from models.models import AIAssistant, User  # noqa: E402
from services.auth_service import (  # noqa: E402
    create_access_token,
    verify_token,
)
from services import vector_service  # noqa: E402

vector_service.HuggingFaceEmbeddings = _FakeEmbeddings  # type: ignore[misc]
vector_service._bge_embeddings = _FakeEmbeddings()
vector_service.generate_summary_and_keywords = lambda text, **_: (  # type: ignore[assignment]
    "壓測摘要",
    "loadtest",
)
vector_service.summarizer = MagicMock()

from services.vector_service import (  # noqa: E402
    list_knowledge,
    process_and_store_file,
)

def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
app = FastAPI(title="LoadTest API")


def get_owned_assistant(
    assistant_id: int,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> AIAssistant:
    user_id = verify_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="invalid token")
    assistant = db.query(AIAssistant).filter(AIAssistant.assistant_id == assistant_id).first()
    if not assistant:
        raise HTTPException(status_code=404, detail="assistant not found")
    if assistant.owner_id != int(user_id):
        raise HTTPException(status_code=403, detail="forbidden")
    return assistant


def _seed_data(db: Session) -> tuple[str, int]:
    email = "loadtest@local"
    password = "loadtest123"
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, password=_hash_password(password), is_totp_enabled=False)
        db.add(user)
        db.commit()
        db.refresh(user)

    assistant = (
        db.query(AIAssistant)
        .filter(AIAssistant.owner_id == user.user_id)
        .order_by(AIAssistant.assistant_id.asc())
        .first()
    )
    if not assistant:
        assistant = AIAssistant(
            name="LoadTest Assistant",
            description="壓測用",
            description_use_file=False,
            owner_id=user.user_id,
            language="zh-TW",
            link=f"assistant-{uuid.uuid4().hex[:8]}",
            message_welcome="hi",
            message_noidea="no",
            enabled_voice=False,
        )
        db.add(assistant)
        db.commit()
        db.refresh(assistant)

    token = create_access_token(data={"sub": str(user.user_id)})
    return token, assistant.assistant_id


@app.on_event("startup")
def on_startup():
    if DB_PATH.exists():
        try:
            DB_PATH.unlink()
        except OSError:
            pass
    Base.metadata.create_all(bind=engine)
    from models.database import SessionLocal

    db = SessionLocal()
    try:
        token, assistant_id = _seed_data(db)
        app.state.seed_token = token
        app.state.seed_assistant_id = assistant_id
        print(f"[load_test_server] seeded assistant_id={assistant_id}")
        print(f"[load_test_server] token={token[:40]}...")
    finally:
        db.close()


@app.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not _verify_password(form.password, user.password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    if user.is_totp_enabled:
        raise HTTPException(status_code=400, detail="MFA enabled; use load test server seed token")
    return {
        "access_token": create_access_token(data={"sub": str(user.user_id)}),
        "token_type": "bearer",
    }


@app.post("/assistant/create")
def create_assistant(
    name: str = Form(...),
    description: str = Form(""),
    language: str = Form("zh-TW"),
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user_id = verify_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="invalid token")
    row = AIAssistant(
        name=name,
        description=description or "",
        description_use_file=False,
        owner_id=int(user_id),
        language=language,
        link=f"assistant-{uuid.uuid4().hex[:8]}",
        message_welcome="hi",
        message_noidea="no",
        enabled_voice=False,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"status": "success", "assistant_id": row.assistant_id}


@app.post("/assistant/{assistant_id}/upload")
async def upload_file(
    assistant_id: int,
    file: UploadFile = File(...),
    assistant: AIAssistant = Depends(get_owned_assistant),
    db: Session = Depends(get_db),
):
    _ = assistant
    result = await process_and_store_file(assistant_id, file, db)
    return {"message": "檔案上傳完成，並已儲存至向量資料庫。", "data": result["km"]}


@app.get("/assistant/{assistant_id}/knowledge")
def get_knowledge(
    assistant_id: int,
    assistant: AIAssistant = Depends(get_owned_assistant),
    db: Session = Depends(get_db),
):
    _ = assistant
    return {"status": "success", "data": list_knowledge(assistant_id, db)}


if __name__ == "__main__":
    port = int(os.getenv("LOAD_TEST_PORT", "3200"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
