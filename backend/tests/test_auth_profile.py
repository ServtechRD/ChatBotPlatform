"""Auth register / profile update tests."""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from models.database import get_db
from models.models import User
from routers import auth as auth_module
from routers.auth import router as auth_router
from services.auth_service import create_access_token


@pytest.fixture
def auth_client(db_session, app_dirs, monkeypatch):
    monkeypatch.setattr(auth_module, "get_password_hash", lambda p: f"hashed:{p}")
    monkeypatch.setattr(
        auth_module,
        "verify_password",
        lambda plain, hashed: hashed == f"hashed:{plain}",
    )

    app = FastAPI()
    app.include_router(auth_router, prefix="/auth")

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def test_register_requires_at_in_email(auth_client):
    response = auth_client.post(
        "/auth/register",
        json={"email": "not-an-email", "name": "A", "password": "secret"},
    )
    assert response.status_code == 422


def test_register_with_name(auth_client, db_session):
    response = auth_client.post(
        "/auth/register",
        json={"email": "a@example.com", "name": "Alice", "password": "secret"},
    )
    assert response.status_code == 200
    user = db_session.query(User).filter(User.email == "a@example.com").first()
    assert user is not None
    assert user.name == "Alice"
    assert user.password == "hashed:secret"


def test_register_name_defaults_empty(auth_client, db_session):
    response = auth_client.post(
        "/auth/register",
        json={"email": "b@example.com", "password": "secret"},
    )
    assert response.status_code == 200
    user = db_session.query(User).filter(User.email == "b@example.com").first()
    assert user.name == ""


def test_patch_profile_name_and_password(auth_client, db_session):
    user = User(
        email="c@example.com",
        name="",
        password="hashed:old-pass",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    token = create_access_token(data={"sub": str(user.user_id)})
    headers = {"Authorization": f"Bearer {token}"}

    me = auth_client.get("/auth/users/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["name"] == ""

    bad = auth_client.patch(
        "/auth/users/me",
        headers=headers,
        json={
            "name": "Carol",
            "current_password": "wrong",
            "new_password": "new-pass",
        },
    )
    assert bad.status_code == 400

    ok = auth_client.patch(
        "/auth/users/me",
        headers=headers,
        json={
            "name": "Carol",
            "current_password": "old-pass",
            "new_password": "new-pass",
        },
    )
    assert ok.status_code == 200
    assert ok.json()["name"] == "Carol"
    db_session.refresh(user)
    assert user.password == "hashed:new-pass"

    name_only = auth_client.patch(
        "/auth/users/me",
        headers=headers,
        json={"name": "Carol2"},
    )
    assert name_only.status_code == 200
    assert name_only.json()["name"] == "Carol2"
