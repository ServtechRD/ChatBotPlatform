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


def test_user_conversations_requires_auth(integration_client, conversation_context):
    assistant_id = conversation_context["assistant_id"]
    response = integration_client.get(f"/user/{assistant_id}/conversations")
    assert response.status_code == 401


def test_user_conversations_with_valid_api_key(integration_client, conversation_context):
    assistant_id = conversation_context["assistant_id"]
    response = integration_client.get(
        f"/user/{assistant_id}/conversations",
        headers=api_key_header(),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["conversation_id"] == conversation_context["conversation_id"]
    assert len(data[0]["messages"]) == 2


def test_user_conversations_with_bearer_token(integration_client, conversation_context, db_session):
    from services.auth_service import create_access_token

    owner = db_session.query(User).filter(User.email == OWNER_EMAIL).first()
    token = create_access_token(data={"sub": str(owner.user_id)})
    assistant_id = conversation_context["assistant_id"]
    response = integration_client.get(
        f"/user/{assistant_id}/conversations",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert len(response.json()) == 1


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


def test_latest_qa_skips_conversation_without_messages(
    integration_client, db_session, conversation_context
):
    assistant_id = conversation_context["assistant_id"]
    empty_newer = Conversation(
        assistant_id=assistant_id,
        customer_id="cust-empty",
    )
    db_session.add(empty_newer)
    db_session.commit()
    db_session.refresh(empty_newer)
    assert empty_newer.conversation_id > conversation_context["conversation_id"]

    response = integration_client.get(
        "/integration/assistants/latest-qa",
        headers=api_key_header(),
    )
    item = response.json()[str(assistant_id)]
    assert item["question"] == "hello"
    assert item["answer"] == "hi there"


GUEST_OWNER_EMAIL = "admin@servtech.com.tw"


@pytest.fixture
def guest_assistant_context(db_session):
    admin = User(email=GUEST_OWNER_EMAIL, password="test-hash")
    other = User(email="other-owner@example.com", password="test-hash")
    db_session.add_all([admin, other])
    db_session.commit()
    db_session.refresh(admin)
    db_session.refresh(other)

    guest = AIAssistant(
        name="Guest",
        description="guest assistant",
        owner_id=admin.user_id,
        language="zh-TW",
        link="guest-link",
    )
    wrong_owner_guest = AIAssistant(
        name="guest",
        description="wrong owner",
        owner_id=other.user_id,
        language="zh-TW",
        link="wrong-guest",
    )
    other_named = AIAssistant(
        name="not-guest",
        description="other",
        owner_id=admin.user_id,
        language="zh-TW",
        link="not-guest",
    )
    db_session.add_all([guest, wrong_owner_guest, other_named])
    db_session.commit()
    db_session.refresh(guest)

    return {
        "guest_assistant_id": guest.assistant_id,
        "wrong_owner_guest_id": wrong_owner_guest.assistant_id,
        "other_named_id": other_named.assistant_id,
    }


def test_ips_latest_qa_requires_api_key(integration_client, guest_assistant_context):
    response = integration_client.get("/integration/ips/latest-qa")
    assert response.status_code == 401


def test_ips_latest_qa_404_when_guest_missing(integration_client, db_session):
    # only non-matching assistants exist
    owner = User(email="someone@example.com", password="test-hash")
    db_session.add(owner)
    db_session.commit()
    db_session.refresh(owner)
    db_session.add(
        AIAssistant(
            name="guest",
            description="wrong email owner",
            owner_id=owner.user_id,
            language="zh-TW",
            link="x",
        )
    )
    db_session.commit()

    response = integration_client.get(
        "/integration/ips/latest-qa",
        headers=api_key_header(),
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Guest assistant not found"


def test_ips_latest_qa_groups_by_ip_and_picks_newest_conversation(
    integration_client, db_session, guest_assistant_context
):
    guest_id = guest_assistant_context["guest_assistant_id"]
    wrong_guest_id = guest_assistant_context["wrong_owner_guest_id"]
    other_id = guest_assistant_context["other_named_id"]

    old_a = Conversation(
        assistant_id=guest_id,
        customer_id="g1",
        client_ip="203.0.113.10",
    )
    new_a = Conversation(
        assistant_id=guest_id,
        customer_id="g2",
        client_ip="203.0.113.10",
    )
    ip_b = Conversation(
        assistant_id=guest_id,
        customer_id="g3",
        client_ip="198.51.100.7",
    )
    ignored_dash = Conversation(
        assistant_id=guest_id,
        customer_id="g4",
        client_ip="---",
    )
    wrong_owner_conv = Conversation(
        assistant_id=wrong_guest_id,
        customer_id="g5",
        client_ip="203.0.113.99",
    )
    other_named_conv = Conversation(
        assistant_id=other_id,
        customer_id="g6",
        client_ip="203.0.113.88",
    )
    db_session.add_all(
        [old_a, new_a, ip_b, ignored_dash, wrong_owner_conv, other_named_conv]
    )
    db_session.commit()
    for row in (old_a, new_a, ip_b, ignored_dash, wrong_owner_conv, other_named_conv):
        db_session.refresh(row)

    db_session.add_all(
        [
            Message(
                conversation_id=old_a.conversation_id,
                sender="客户",
                content="舊問題應被忽略",
                timestamp=datetime(2026, 7, 20, 1, 0, 0),
            ),
            Message(
                conversation_id=old_a.conversation_id,
                sender="助理",
                content="舊回答應被忽略",
                timestamp=datetime(2026, 7, 20, 1, 0, 1),
            ),
            Message(
                conversation_id=new_a.conversation_id,
                sender="客户",
                content="IP-A 最新問題",
                timestamp=datetime(2026, 7, 23, 2, 0, 0),
            ),
            Message(
                conversation_id=new_a.conversation_id,
                sender="助理",
                content="IP-A 最新回答",
                timestamp=datetime(2026, 7, 23, 2, 0, 1),
            ),
            Message(
                conversation_id=ip_b.conversation_id,
                sender="客户",
                content="IP-B 問題",
                timestamp=datetime(2026, 7, 23, 3, 0, 0),
            ),
            Message(
                conversation_id=ip_b.conversation_id,
                sender="助理",
                content="IP-B 回答",
                timestamp=datetime(2026, 7, 23, 3, 0, 1),
            ),
            Message(
                conversation_id=ignored_dash.conversation_id,
                sender="客户",
                content="不應出現",
                timestamp=datetime(2026, 7, 23, 4, 0, 0),
            ),
            Message(
                conversation_id=wrong_owner_conv.conversation_id,
                sender="客户",
                content="錯誤擁有者不應出現",
                timestamp=datetime(2026, 7, 23, 5, 0, 0),
            ),
            Message(
                conversation_id=other_named_conv.conversation_id,
                sender="客户",
                content="非 guest 不應出現",
                timestamp=datetime(2026, 7, 23, 6, 0, 0),
            ),
        ]
    )
    db_session.commit()

    response = integration_client.get(
        "/integration/ips/latest-qa",
        headers=api_key_header(),
    )
    assert response.status_code == 200
    data = response.json()
    assert set(data.keys()) == {"203.0.113.10", "198.51.100.7"}
    assert data["203.0.113.10"]["name"].lower() == "guest"
    assert data["203.0.113.10"]["question"] == "IP-A 最新問題"
    assert data["203.0.113.10"]["answer"] == "IP-A 最新回答"
    assert data["203.0.113.10"]["question_at"] == "2026-07-23 10:00:00"
    assert data["203.0.113.10"]["answer_at"] == "2026-07-23 10:00:01"
    assert data["198.51.100.7"]["question"] == "IP-B 問題"
    assert data["198.51.100.7"]["answer"] == "IP-B 回答"


def test_ips_latest_qa_skips_conversation_without_messages(
    integration_client, db_session, guest_assistant_context
):
    guest_id = guest_assistant_context["guest_assistant_id"]
    target_ip = "203.0.113.55"

    with_msg = Conversation(
        assistant_id=guest_id,
        customer_id="with-msg",
        client_ip=target_ip,
    )
    empty_newer = Conversation(
        assistant_id=guest_id,
        customer_id="empty-newer",
        client_ip=target_ip,
    )
    db_session.add_all([with_msg, empty_newer])
    db_session.commit()
    db_session.refresh(with_msg)
    db_session.refresh(empty_newer)
    assert empty_newer.conversation_id > with_msg.conversation_id

    db_session.add_all(
        [
            Message(
                conversation_id=with_msg.conversation_id,
                sender="客户",
                content="有訊息的問題",
                timestamp=datetime(2026, 7, 23, 8, 0, 0),
            ),
            Message(
                conversation_id=with_msg.conversation_id,
                sender="助理",
                content="有訊息的回答",
                timestamp=datetime(2026, 7, 23, 8, 0, 1),
            ),
        ]
    )
    db_session.commit()

    response = integration_client.get(
        "/integration/ips/latest-qa",
        headers=api_key_header(),
    )
    assert response.status_code == 200
    item = response.json()[target_ip]
    assert item["question"] == "有訊息的問題"
    assert item["answer"] == "有訊息的回答"


def test_ip_conversations_requires_api_key(integration_client, guest_assistant_context):
    response = integration_client.get(
        "/integration/ips/conversations",
        params={"ip": "203.0.113.10"},
    )
    assert response.status_code == 401


def test_ip_conversations_requires_ip_param(integration_client, guest_assistant_context):
    response = integration_client.get(
        "/integration/ips/conversations",
        headers=api_key_header(),
    )
    assert response.status_code == 422


def test_ip_conversations_404_when_guest_missing(integration_client, db_session):
    owner = User(email="someone@example.com", password="test-hash")
    db_session.add(owner)
    db_session.commit()
    db_session.refresh(owner)
    db_session.add(
        AIAssistant(
            name="guest",
            description="wrong email owner",
            owner_id=owner.user_id,
            language="zh-TW",
            link="x",
        )
    )
    db_session.commit()

    response = integration_client.get(
        "/integration/ips/conversations",
        params={"ip": "203.0.113.10"},
        headers=api_key_header(),
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Guest assistant not found"


def test_ip_conversations_returns_guest_conversations_for_ip(
    integration_client, db_session, guest_assistant_context
):
    guest_id = guest_assistant_context["guest_assistant_id"]
    wrong_guest_id = guest_assistant_context["wrong_owner_guest_id"]
    other_id = guest_assistant_context["other_named_id"]
    target_ip = "203.0.113.10"

    match_a = Conversation(
        assistant_id=guest_id, customer_id="a", client_ip=target_ip
    )
    match_b = Conversation(
        assistant_id=guest_id, customer_id="b", client_ip=target_ip
    )
    empty_match = Conversation(
        assistant_id=guest_id, customer_id="empty", client_ip=target_ip
    )
    other_ip = Conversation(
        assistant_id=guest_id, customer_id="c", client_ip="198.51.100.7"
    )
    wrong_owner = Conversation(
        assistant_id=wrong_guest_id, customer_id="d", client_ip=target_ip
    )
    other_named = Conversation(
        assistant_id=other_id, customer_id="e", client_ip=target_ip
    )
    db_session.add_all(
        [match_a, match_b, empty_match, other_ip, wrong_owner, other_named]
    )
    db_session.commit()
    for row in (match_a, match_b, empty_match, other_ip, wrong_owner, other_named):
        db_session.refresh(row)

    db_session.add_all(
        [
            Message(
                conversation_id=match_a.conversation_id,
                sender="客户",
                content="A-Q",
            ),
            Message(
                conversation_id=match_a.conversation_id,
                sender="助理",
                content="A-A",
            ),
            Message(
                conversation_id=match_b.conversation_id,
                sender="客户",
                content="B-Q",
            ),
            Message(
                conversation_id=other_ip.conversation_id,
                sender="客户",
                content="other-ip",
            ),
            Message(
                conversation_id=wrong_owner.conversation_id,
                sender="客户",
                content="wrong-owner",
            ),
            Message(
                conversation_id=other_named.conversation_id,
                sender="客户",
                content="other-named",
            ),
        ]
    )
    db_session.commit()

    response = integration_client.get(
        "/integration/ips/conversations",
        params={"ip": target_ip},
        headers=api_key_header(),
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    ids = {item["conversation_id"] for item in data}
    assert ids == {match_a.conversation_id, match_b.conversation_id}
    for item in data:
        assert item["client_ip"] == target_ip
        assert item["assistant_id"] == guest_id
        assert len(item["messages"]) >= 1

    empty_response = integration_client.get(
        "/integration/ips/conversations",
        params={"ip": "192.0.2.1"},
        headers=api_key_header(),
    )
    assert empty_response.status_code == 200
    assert empty_response.json() == []
