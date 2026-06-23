"""Shared pytest fixtures for backend API tests."""

import os
import sys
import types
from unittest.mock import AsyncMock, MagicMock

# Must be set before any backend module imports the database engine.
os.environ["DATABASE_URL"] = "sqlite://"

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _install_import_stubs() -> None:
    """Stub heavy services so assistant router can load without ML dependencies."""
    if "services" not in sys.modules:
        pkg = types.ModuleType("services")
        pkg.__path__ = [os.path.join(_BACKEND_ROOT, "services")]
        sys.modules["services"] = pkg

    if "routers" not in sys.modules:
        pkg = types.ModuleType("routers")
        pkg.__path__ = [os.path.join(_BACKEND_ROOT, "routers")]
        sys.modules["routers"] = pkg

    heavy_roots = (
        "langchain_community",
        "langchain_core",
        "langchain_text_splitters",
        "transformers",
        "faiss",
        "torch",
        "rake_nltk",
        "tiktoken",
        "langid",
    )
    for name in heavy_roots:
        sys.modules.setdefault(name, MagicMock())

    vector_stub = types.ModuleType("services.vector_service")
    vector_stub.prewarm_bge_embeddings = lambda: None
    vector_stub.process_and_store_file = AsyncMock(return_value={"km": {}})
    vector_stub.list_knowledge = lambda assistant_id, db: []
    vector_stub.get_knowledge_content = lambda assistant_id, knowledge_id, db: ""
    vector_stub.update_knowledge_base_item = AsyncMock(return_value={})
    vector_stub.delete_knowledge_base_item = lambda assistant_id, knowledge_id, db: {}
    vector_stub.get_vector_store_status = lambda assistant_id: {
        "document_count": 0,
        "vector_count": 0,
    }
    sys.modules["services.vector_service"] = vector_stub


_install_import_stubs()

import pytest
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models.database import Base, get_db
from services.assistant_prompt_storage import ensure_description_use_file_column
from routers.assistant import router as assistant_router


def _build_test_app() -> FastAPI:
    app = FastAPI()
    app.include_router(assistant_router)

    public_dir = Path("public")
    images_dir = public_dir / "images"
    videos_dir = public_dir / "videos"
    for directory in (public_dir, images_dir, videos_dir):
        directory.mkdir(parents=True, exist_ok=True)

    app.mount("/public", StaticFiles(directory=str(public_dir)), name="public")
    app.mount("/images", StaticFiles(directory=str(images_dir)), name="images")
    app.mount("/videos", StaticFiles(directory=str(videos_dir)), name="videos")
    return app


@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    ensure_description_use_file_column(engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session(test_engine):
    connection = test_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection)()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def app_dirs(tmp_path, monkeypatch):
    """Run the app with public / private dirs under a temp working directory."""
    (tmp_path / "public" / "images").mkdir(parents=True)
    (tmp_path / "public" / "videos").mkdir(parents=True)
    (tmp_path / "uploaded_files").mkdir(parents=True)
    (tmp_path / "vector_stores").mkdir(parents=True)
    monkeypatch.chdir(tmp_path)
    return tmp_path


@pytest.fixture
def client(db_session, app_dirs):
    app = _build_test_app()

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def owner_context(db_session):
    from models.models import AIAssistant, KnowledgeBase, User
    from services.auth_service import create_access_token

    owner = User(email="owner@example.com", password="test-hash")
    other = User(email="other@example.com", password="test-hash")
    db_session.add_all([owner, other])
    db_session.commit()
    db_session.refresh(owner)
    db_session.refresh(other)

    assistant = AIAssistant(
        name="Test Assistant",
        description="desc",
        owner_id=owner.user_id,
        language="zh-TW",
        link="assistant-test01",
    )
    db_session.add(assistant)
    db_session.commit()
    db_session.refresh(assistant)

    kb = KnowledgeBase(
        assistant_id=assistant.assistant_id,
        file_name="notes.txt",
        file_type="text/plain",
        description="d",
        summary="s",
        keywords="k",
        doc_ids="doc-1",
        token_count=10,
    )
    db_session.add(kb)
    db_session.commit()
    db_session.refresh(kb)

    owner_token = create_access_token(data={"sub": str(owner.user_id)})
    other_token = create_access_token(data={"sub": str(other.user_id)})

    return {
        "owner_token": owner_token,
        "other_token": other_token,
        "owner_user_id": owner.user_id,
        "other_user_id": other.user_id,
        "assistant_id": assistant.assistant_id,
        "knowledge_id": kb.id,
    }


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
