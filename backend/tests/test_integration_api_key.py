"""Integration API key authentication tests."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from models.database import get_db
from models.models import AIAssistant, Conversation, Message, User
from routers.conversation import router as conversation_router
from routers.integration import router as integration_router

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
