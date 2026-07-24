"""Integration API key authentication tests."""

from datetime import datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from models.database import get_db
from models.models import AIAssistant, Conversation, Message, User
from routers.conversation import router as conversation_router
from routers.integration import router as integration_router
from utils.timezone import TAIPEI

TEST_API_KEY = "test-integration-secret"
OWNER_EMAIL = "owner@example.com"


@pytest.fixture
def integration_client(db_session, app_dirs, monkeypatch):
    monkeypatch.setenv("INTEGRATION_API_KEY", TEST_API_KEY)

    app = FastAPI()
    app.include_router(integration_router)
    app.include_router(conversation_router)

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
def conversation_context(db_session):
    owner = User(email=OWNER_EMAIL, password="test-hash")
    other = User(email="other@example.com", password="test-hash")
    db_session.add_all([owner, other])
    db_session.commit()
    db_session.refresh(owner)
    db_session.refresh(other)

    assistant = AIAssistant(
        name="Integration Assistant",
        description="desc",
        owner_id=owner.user_id,
        language="zh-TW",
        link="integration-test",
    )
    other_assistant = AIAssistant(
        name="Other Owner Assistant",
        description="desc",
        owner_id=other.user_id,
        language="zh-TW",
        link="other-owner",
    )
    db_session.add_all([assistant, other_assistant])
    db_session.commit()
    db_session.refresh(assistant)

    conversation = Conversation(
        assistant_id=assistant.assistant_id,
        customer_id="cust-1",
        customer_name="Alice",
    )
    db_session.add(conversation)
    db_session.commit()
    db_session.refresh(conversation)

    db_session.add_all(
        [
            Message(
                conversation_id=conversation.conversation_id,
                sender="customer",
                content="hello",
            ),
            Message(
                conversation_id=conversation.conversation_id,
                sender="assistant",
                content="hi there",
            ),
        ]
    )
    db_session.commit()

    return {
        "assistant_id": assistant.assistant_id,
        "conversation_id": conversation.conversation_id,
        "owner_email": OWNER_EMAIL,
    }


def api_key_header(key: str = TEST_API_KEY) -> dict:
    return {"X-API-Key": key}


def test_list_assistants_requires_api_key(integration_client, conversation_context):
    response = integration_client.get(
        "/integration/assistants",
        params={"email": conversation_context["owner_email"]},
    )
    assert response.status_code == 401


def test_list_assistants_rejects_invalid_key(integration_client, conversation_context):
    response = integration_client.get(
        "/integration/assistants",
        params={"email": conversation_context["owner_email"]},
        headers=api_key_header("wrong-key"),
    )
    assert response.status_code == 401


def test_list_assistants_requires_email(integration_client, conversation_context):
    response = integration_client.get(
        "/integration/assistants",
        headers=api_key_header(),
    )
    assert response.status_code == 422


def test_list_assistants_by_owner_email(integration_client, conversation_context):
    response = integration_client.get(
        "/integration/assistants",
        params={"email": conversation_context["owner_email"]},
        headers=api_key_header(),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0] == {
        "assistant_id": conversation_context["assistant_id"],
        "name": "Integration Assistant",
        "link": "integration-test",
    }


def test_list_assistants_unknown_email_returns_empty(integration_client, conversation_context):
    response = integration_client.get(
        "/integration/assistants",
        params={"email": "nobody@example.com"},
        headers=api_key_header(),
    )
    assert response.status_code == 200
    assert response.json() == []


def test_conversation_messages_requires_api_key(integration_client, conversation_context):
    conversation_id = conversation_context["conversation_id"]
    response = integration_client.get(f"/conversation/{conversation_id}/messages")
    assert response.status_code == 401


def test_conversation_messages_with_valid_api_key(integration_client, conversation_context):
    conversation_id = conversation_context["conversation_id"]
    response = integration_client.get(
        f"/conversation/{conversation_id}/messages",
        headers=api_key_header(),
    )
    assert response.status_code == 200
    messages = response.json()
    assert len(messages) == 2
    assert messages[0]["content"] == "hello"
    assert messages[1]["content"] == "hi there"


def test_conversation_messages_not_found_with_valid_key(integration_client):
    response = integration_client.get(
        "/conversation/99999/messages",
        headers=api_key_header(),
    )
    assert response.status_code == 404


def test_integration_api_key_not_configured(db_session, app_dirs, monkeypatch):
    monkeypatch.delenv("INTEGRATION_API_KEY", raising=False)

    app = FastAPI()
    app.include_router(integration_router)

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        response = client.get(
            "/integration/assistants",
            params={"email": OWNER_EMAIL},
            headers=api_key_header("any-key"),
        )
        assert response.status_code == 401
    app.dependency_overrides.clear()


def test_message_count_requires_api_key(integration_client, conversation_context):
    response = integration_client.get("/integration/conversations/messages/count")
    assert response.status_code == 401


def test_message_count_defaults_to_taipei_today(integration_client, conversation_context):
    today = datetime.now(TAIPEI).date().isoformat()
    response = integration_client.get(
        "/integration/conversations/messages/count",
        headers=api_key_header(),
    )
    assert response.status_code == 200
    data = response.json()
    assert data["start_date"] == today
    assert data["end_date"] == today
    assert data["count"] == 2


def test_message_count_with_explicit_range(integration_client, db_session, conversation_context):
    conversation_id = conversation_context["conversation_id"]
    old_ts = datetime(2026, 1, 1, 4, 0, 0)  # UTC ≈ 台北 2026-01-01 12:00
    db_session.add(
        Message(
            conversation_id=conversation_id,
            sender="customer",
            content="old",
            timestamp=old_ts,
        )
    )
    db_session.commit()

    response = integration_client.get(
        "/integration/conversations/messages/count",
        params={"start_date": "2026-01-01", "end_date": "2026-01-01"},
        headers=api_key_header(),
    )
    assert response.status_code == 200
    assert response.json() == {
        "start_date": "2026-01-01",
        "end_date": "2026-01-01",
        "count": 1,
    }


def test_message_count_rejects_inverted_range(integration_client):
    response = integration_client.get(
        "/integration/conversations/messages/count",
        params={"start_date": "2026-07-02", "end_date": "2026-07-01"},
        headers=api_key_header(),
    )
    assert response.status_code == 400


def test_latest_qa_requires_api_key(integration_client, conversation_context):
    response = integration_client.get("/integration/assistants/latest-qa")
    assert response.status_code == 401


def test_latest_qa_all_assistants_with_null_when_empty(integration_client, conversation_context):
    response = integration_client.get(
        "/integration/assistants/latest-qa",
        headers=api_key_header(),
    )
    assert response.status_code == 200
    data = response.json()
    owner_key = str(conversation_context["assistant_id"])
    assert owner_key in data
    assert data[owner_key]["name"] == "Integration Assistant"
    assert data[owner_key]["question"] == "hello"
    assert data[owner_key]["answer"] == "hi there"
    assert data[owner_key]["question_at"]
    assert data[owner_key]["answer_at"]

    # other assistant has no conversation → null QA fields
    other_entries = [v for k, v in data.items() if k != owner_key]
    assert len(other_entries) == 1
    assert other_entries[0]["name"] == "Other Owner Assistant"
    assert other_entries[0]["question"] is None
    assert other_entries[0]["answer"] is None


def test_latest_qa_uses_newest_conversation_and_top_two_messages(
    integration_client, db_session, conversation_context
):
    assistant_id = conversation_context["assistant_id"]
    old_cid = conversation_context["conversation_id"]

    newer = Conversation(
        assistant_id=assistant_id,
        customer_id="cust-2",
        customer_name="Bob",
    )
    db_session.add(newer)
    db_session.commit()
    db_session.refresh(newer)
    assert newer.conversation_id > old_cid

    db_session.add_all(
        [
            Message(
                conversation_id=newer.conversation_id,
                sender="客户",
                content="最新問題",
                timestamp=datetime(2026, 7, 23, 2, 0, 0),
            ),
            Message(
                conversation_id=newer.conversation_id,
                sender="助理",
                content="最新回答",
                timestamp=datetime(2026, 7, 23, 2, 0, 1),
            ),
            Message(
                conversation_id=newer.conversation_id,
                sender="客户",
                content="更早的問題應被忽略",
                timestamp=datetime(2026, 7, 23, 1, 0, 0),
            ),
        ]
    )
    db_session.commit()

    response = integration_client.get(
        "/integration/assistants/latest-qa",
        headers=api_key_header(),
    )
    assert response.status_code == 200
    item = response.json()[str(assistant_id)]
    assert item["question"] == "最新問題"
    assert item["answer"] == "最新回答"
    assert item["question_at"] == "2026-07-23 10:00:00"
    assert item["answer_at"] == "2026-07-23 10:00:01"


def test_latest_qa_partial_messages_return_null(
    integration_client, db_session, conversation_context
):
    assistant_id = conversation_context["assistant_id"]
    newer = Conversation(
        assistant_id=assistant_id,
        customer_id="cust-3",
    )
    db_session.add(newer)
    db_session.commit()
    db_session.refresh(newer)
    db_session.add(
        Message(
            conversation_id=newer.conversation_id,
            sender="客户",
            content="只有問題",
            timestamp=datetime(2026, 7, 22, 4, 0, 0),
        )
    )
    db_session.commit()

    response = integration_client.get(
        "/integration/assistants/latest-qa",
        headers=api_key_header(),
    )
    item = response.json()[str(assistant_id)]
    assert item["question"] == "只有問題"
    assert item["answer"] is None
    assert item["answer_at"] is None
    assert item["question_at"] == "2026-07-22 12:00:00"
