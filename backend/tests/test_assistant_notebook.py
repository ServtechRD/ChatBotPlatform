"""Tests for assistant ↔ Jarvis notebook binding APIs."""

from unittest.mock import patch

from models.models import AssistantNotebook
from tests.conftest import auth_header


def test_available_notebooks_requires_auth(client):
    response = client.get("/assistant/notebooks/available")
    assert response.status_code in (401, 403)


def test_available_notebooks_returns_mock_list(client, owner_context, monkeypatch):
    monkeypatch.setenv("NOTEBOOK_KNOWLEDGE_MODE", "mock")
    response = client.get(
        "/assistant/notebooks/available",
        headers=auth_header(owner_context["owner_token"]),
    )
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "id" in data[0]
    assert "name" in data[0]


def test_notebook_bindings_replace_and_list(client, owner_context, db_session):
    assistant_id = owner_context["assistant_id"]
    headers = auth_header(owner_context["owner_token"])

    put_resp = client.put(
        f"/assistant/{assistant_id}/notebooks",
        headers=headers,
        json={
            "notebooks": [
                {"notebook_id": 10, "notebook_name": "A"},
                {"notebook_id": 20, "notebook_name": "B"},
            ]
        },
    )
    assert put_resp.status_code == 200
    put_data = put_resp.json()
    assert len(put_data) == 2
    assert {x["notebook_id"] for x in put_data} == {10, 20}

    get_resp = client.get(f"/assistant/{assistant_id}/notebooks", headers=headers)
    assert get_resp.status_code == 200
    get_data = get_resp.json()
    assert len(get_data) == 2

    rows = (
        db_session.query(AssistantNotebook)
        .filter(AssistantNotebook.assistant_id == assistant_id)
        .all()
    )
    assert len(rows) == 2

    # replace with empty clears bindings
    clear_resp = client.put(
        f"/assistant/{assistant_id}/notebooks",
        headers=headers,
        json={"notebooks": []},
    )
    assert clear_resp.status_code == 200
    assert clear_resp.json() == []


def test_notebook_bindings_reject_non_owner(client, owner_context):
    assistant_id = owner_context["assistant_id"]
    response = client.put(
        f"/assistant/{assistant_id}/notebooks",
        headers=auth_header(owner_context["other_token"]),
        json={"notebooks": [{"notebook_id": 1, "notebook_name": "x"}]},
    )
    assert response.status_code == 403


def test_jarvis_search_mock_formats_context(monkeypatch):
    monkeypatch.setenv("NOTEBOOK_KNOWLEDGE_MODE", "mock")
    from services.jarvis_knowledge_client import (
        format_search_results_as_context,
        search_knowledge,
    )

    results = search_knowledge([1, 2], "備份保留幾天？")
    assert len(results) == 1
    assert results[0]["notebook_id"] == 1
    ctx = format_search_results_as_context(results)
    assert ctx and "備份保留幾天" in ctx


def test_available_notebooks_http_passes_email(client, owner_context, monkeypatch):
    monkeypatch.setenv("NOTEBOOK_KNOWLEDGE_MODE", "http")
    monkeypatch.setenv("JARVIS_BASE_URL", "https://jarvis.example")
    monkeypatch.setenv("INTEGRATION_API_KEY", "test-key")

    with patch(
        "routers.assistant.jarvis_knowledge_client.list_notebooks",
        return_value=[
            {
                "id": 93,
                "name": "0504測試",
                "description": None,
                "service_type": "storage",
                "file_count": 4,
            }
        ],
    ) as mocked:
        response = client.get(
            "/assistant/notebooks/available",
            headers=auth_header(owner_context["owner_token"]),
        )
        assert response.status_code == 200
        assert response.json()[0]["id"] == 93
        mocked.assert_called_once_with("owner@example.com")


def test_available_notebooks_jarvis_500_email_not_found(client, owner_context):
    from services.jarvis_knowledge_client import (
        JARVIS_EMAIL_NOT_FOUND_MSG,
        JarvisEmailNotFoundError,
    )

    with patch(
        "routers.assistant.jarvis_knowledge_client.list_notebooks",
        side_effect=JarvisEmailNotFoundError(JARVIS_EMAIL_NOT_FOUND_MSG),
    ):
        response = client.get(
            "/assistant/notebooks/available",
            headers=auth_header(owner_context["owner_token"]),
        )
    assert response.status_code == 502
    assert response.json()["detail"] == JARVIS_EMAIL_NOT_FOUND_MSG


def test_list_notebooks_http_500_raises_email_not_found(monkeypatch):
    import httpx

    from services import jarvis_knowledge_client as client_mod

    monkeypatch.setenv("NOTEBOOK_KNOWLEDGE_MODE", "http")
    monkeypatch.setenv("JARVIS_BASE_URL", "https://jarvis.example")
    monkeypatch.setenv("INTEGRATION_API_KEY", "test-key")

    mock_resp = httpx.Response(500, request=httpx.Request("GET", "https://jarvis.example/x"))

    class _FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, *args, **kwargs):
            return mock_resp

    monkeypatch.setattr(client_mod.httpx, "Client", _FakeClient)

    try:
        client_mod.list_notebooks("missing@example.com")
        assert False, "expected JarvisEmailNotFoundError"
    except client_mod.JarvisEmailNotFoundError as exc:
        assert str(exc) == client_mod.JARVIS_EMAIL_NOT_FOUND_MSG
