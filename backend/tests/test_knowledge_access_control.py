"""Access-control tests for knowledge base and static asset exposure."""

from datetime import datetime
from unittest.mock import AsyncMock, patch

import pytest

from tests.conftest import auth_header


@pytest.mark.parametrize(
    "method,path_suffix",
    [
        ("GET", "/knowledge"),
        ("GET", "/knowledge/stats"),
        ("GET", "/knowledge/{knowledge_id}/content"),
        ("PUT", "/knowledge/{knowledge_id}"),
        ("DELETE", "/knowledge/{knowledge_id}"),
    ],
)
def test_knowledge_endpoints_require_auth(client, owner_context, method, path_suffix):
    assistant_id = owner_context["assistant_id"]
    knowledge_id = owner_context["knowledge_id"]
    path = f"/assistant/{assistant_id}{path_suffix.format(knowledge_id=knowledge_id)}"

    if method == "PUT":
        response = client.put(path, data={"content": "updated"})
    elif method == "DELETE":
        response = client.delete(path)
    else:
        response = client.get(path)

    assert response.status_code == 401


@pytest.mark.parametrize(
    "method,path_suffix",
    [
        ("GET", "/knowledge"),
        ("GET", "/knowledge/stats"),
        ("GET", "/knowledge/{knowledge_id}/content"),
        ("PUT", "/knowledge/{knowledge_id}"),
        ("DELETE", "/knowledge/{knowledge_id}"),
    ],
)
def test_knowledge_endpoints_reject_non_owner(
    client, owner_context, method, path_suffix
):
    assistant_id = owner_context["assistant_id"]
    knowledge_id = owner_context["knowledge_id"]
    path = f"/assistant/{assistant_id}{path_suffix.format(knowledge_id=knowledge_id)}"
    headers = auth_header(owner_context["other_token"])

    if method == "PUT":
        response = client.put(path, data={"content": "updated"}, headers=headers)
    elif method == "DELETE":
        response = client.delete(path, headers=headers)
    else:
        response = client.get(path, headers=headers)

    assert response.status_code == 403


def test_unauthenticated_upload_returns_401(client, owner_context):
    assistant_id = owner_context["assistant_id"]
    response = client.post(
        f"/assistant/{assistant_id}/upload",
        files={"file": ("doc.txt", b"hello", "text/plain")},
    )
    assert response.status_code == 401


def test_non_owner_upload_returns_403(client, owner_context):
    assistant_id = owner_context["assistant_id"]
    headers = auth_header(owner_context["other_token"])
    response = client.post(
        f"/assistant/{assistant_id}/upload",
        files={"file": ("doc.txt", b"hello", "text/plain")},
        headers=headers,
    )
    assert response.status_code == 403


def test_owner_can_list_knowledge(client, owner_context):
    headers = auth_header(owner_context["owner_token"])
    assistant_id = owner_context["assistant_id"]

    with patch(
        "routers.assistant.list_knowledge",
        return_value=[{"id": owner_context["knowledge_id"], "file_name": "notes.txt"}],
    ):
        response = client.get(f"/assistant/{assistant_id}/knowledge", headers=headers)

    assert response.status_code == 200
    assert response.json()["data"][0]["file_name"] == "notes.txt"


def test_owner_can_read_knowledge_stats(client, owner_context):
    headers = auth_header(owner_context["owner_token"])
    assistant_id = owner_context["assistant_id"]

    with patch(
        "services.vector_service.get_vector_store_status",
        return_value={"document_count": 1, "vector_count": 3},
    ):
        response = client.get(
            f"/assistant/{assistant_id}/knowledge/stats", headers=headers
        )

    assert response.status_code == 200
    assert response.json()["document_count"] == 1


def test_owner_can_read_knowledge_content(client, owner_context, app_dirs):
    headers = auth_header(owner_context["owner_token"])
    assistant_id = owner_context["assistant_id"]
    knowledge_id = owner_context["knowledge_id"]

    kb_dir = app_dirs / "uploaded_files" / f"assistant_{assistant_id}"
    kb_dir.mkdir(parents=True, exist_ok=True)
    (kb_dir / "notes.txt").write_text("editable text", encoding="utf-8")

    with patch(
        "services.vector_service.get_knowledge_content",
        return_value="editable text",
    ):
        response = client.get(
            f"/assistant/{assistant_id}/knowledge/{knowledge_id}/content",
            headers=headers,
        )

    assert response.status_code == 200
    assert response.json()["content"] == "editable text"


def test_owner_can_update_knowledge(client, owner_context):
    headers = auth_header(owner_context["owner_token"])
    assistant_id = owner_context["assistant_id"]
    knowledge_id = owner_context["knowledge_id"]
    updated = {
        "id": knowledge_id,
        "file_name": "notes.txt",
        "token_count": 12,
    }

    with patch(
        "services.vector_service.update_knowledge_base_item",
        new_callable=AsyncMock,
        return_value=updated,
    ):
        response = client.put(
            f"/assistant/{assistant_id}/knowledge/{knowledge_id}",
            data={"content": "new body"},
            headers=headers,
        )

    assert response.status_code == 200
    assert response.json()["data"]["token_count"] == 12


def test_owner_can_delete_knowledge(client, owner_context):
    headers = auth_header(owner_context["owner_token"])
    assistant_id = owner_context["assistant_id"]
    knowledge_id = owner_context["knowledge_id"]

    with patch(
        "routers.assistant.delete_knowledge_base_item",
        return_value={"deleted_id": knowledge_id},
    ):
        response = client.delete(
            f"/assistant/{assistant_id}/knowledge/{knowledge_id}",
            headers=headers,
        )

    assert response.status_code == 200
    assert response.json()["data"]["deleted_id"] == knowledge_id


def test_owner_can_upload_knowledge(client, owner_context):
    headers = auth_header(owner_context["owner_token"])
    assistant_id = owner_context["assistant_id"]
    km = {
        "id": 99,
        "file_name": "doc.txt",
        "upload_date": datetime.utcnow(),
    }

    with patch(
        "routers.assistant.process_and_store_file",
        new_callable=AsyncMock,
        return_value={"km": km},
    ):
        response = client.post(
            f"/assistant/{assistant_id}/upload",
            files={"file": ("doc.txt", b"training data", "text/plain")},
            headers=headers,
        )

    assert response.status_code == 200
    assert "上傳完成" in response.json()["message"]


def test_public_image_is_anonymous(client, app_dirs):
    image_path = app_dirs / "public" / "images" / "banner.png"
    image_path.write_bytes(b"\x89PNG\r\n")

    assert client.get("/images/banner.png").status_code == 200
    assert client.get("/public/images/banner.png").status_code == 200


def test_public_video_is_anonymous(client, app_dirs):
    video_path = app_dirs / "public" / "videos" / "intro.mp4"
    video_path.write_bytes(b"fake-video")

    assert client.get("/videos/intro.mp4").status_code == 200
    assert client.get("/public/videos/intro.mp4").status_code == 200


def test_uploaded_files_not_served_as_static(client, app_dirs, owner_context):
    assistant_id = owner_context["assistant_id"]
    private_dir = app_dirs / "uploaded_files" / f"assistant_{assistant_id}"
    private_dir.mkdir(parents=True, exist_ok=True)
    (private_dir / "secret.txt").write_text("private", encoding="utf-8")

    assert client.get(f"/uploaded_files/assistant_{assistant_id}/secret.txt").status_code == 404
    assert client.get("/uploaded_files/assistant_1/secret.txt").status_code == 404


def test_vector_stores_not_served_as_static(client, app_dirs, owner_context):
    assistant_id = owner_context["assistant_id"]
    store_dir = app_dirs / "vector_stores" / f"assistant_{assistant_id}"
    store_dir.mkdir(parents=True, exist_ok=True)
    (store_dir / "index.faiss").write_bytes(b"faiss-data")

    assert client.get(f"/vector_stores/assistant_{assistant_id}/index.faiss").status_code == 404


def test_owner_can_list_own_assistants(client, owner_context):
    headers = auth_header(owner_context["owner_token"])
    owner_id = owner_context["owner_user_id"]

    response = client.get(f"/user/{owner_id}/assistants", headers=headers)

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["assistant_id"] == owner_context["assistant_id"]


def test_user_assistants_rejects_non_owner(client, owner_context):
    headers = auth_header(owner_context["other_token"])
    owner_id = owner_context["owner_user_id"]

    response = client.get(f"/user/{owner_id}/assistants", headers=headers)

    assert response.status_code == 403


def test_user_assistants_requires_auth(client):
    assert client.get("/user/1/assistants").status_code == 401
