"""Integration tests for login, logout, me, refresh endpoints."""

import pytest
from httpx import AsyncClient

from app.security.tokens import decode_token


@pytest.fixture
async def auth_client(client: AsyncClient, db_tables: None) -> AsyncClient:
    return client


@pytest.fixture
async def registered_user(auth_client: AsyncClient) -> dict[str, str]:
    """Creates a user via /setup and returns email, password, access_token, refresh_token."""
    resp = await auth_client.post(
        "/api/v1/auth/setup",
        json={"email": "user@example.com", "password": "validpassword"},
    )
    assert resp.status_code == 201
    data = resp.json()
    return {
        "email": "user@example.com",
        "password": "validpassword",
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
    }


# --- login ---

async def test_login_success(auth_client: AsyncClient, registered_user: dict[str, str]) -> None:
    resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(
    auth_client: AsyncClient, registered_user: dict[str, str]
) -> None:
    resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": "wrongpassword"},
    )
    assert resp.status_code == 401


async def test_login_unknown_email(
    auth_client: AsyncClient, registered_user: dict[str, str]
) -> None:
    resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "anything"},
    )
    assert resp.status_code == 401


async def test_login_token_types(auth_client: AsyncClient, registered_user: dict[str, str]) -> None:
    resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    data = resp.json()
    assert decode_token(data["access_token"])["type"] == "access"
    assert decode_token(data["refresh_token"])["type"] == "refresh"


# --- me ---

async def test_me_returns_current_user(
    auth_client: AsyncClient, registered_user: dict[str, str]
) -> None:
    resp = await auth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {registered_user['access_token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == registered_user["email"]
    assert "id" in data
    assert "created_at" in data


async def test_me_rejects_missing_token(
    auth_client: AsyncClient, registered_user: dict[str, str]
) -> None:
    resp = await auth_client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_me_rejects_invalid_token(
    auth_client: AsyncClient, registered_user: dict[str, str]
) -> None:
    resp = await auth_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalidtoken"},
    )
    assert resp.status_code == 401


# --- refresh ---

async def test_refresh_issues_new_access_token(
    auth_client: AsyncClient, registered_user: dict[str, str]
) -> None:
    login_resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    tokens = login_resp.json()

    resp = await auth_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert resp.status_code == 200
    new_tokens = resp.json()
    assert "access_token" in new_tokens
    assert "refresh_token" in new_tokens
    assert new_tokens["access_token"] != tokens["access_token"]


async def test_refresh_rotates_token(
    auth_client: AsyncClient, registered_user: dict[str, str]
) -> None:
    login_resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    tokens = login_resp.json()

    await auth_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    # Old refresh token should now be invalid (session rotated)
    resp = await auth_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert resp.status_code == 401


async def test_refresh_rejects_invalid_token(auth_client: AsyncClient) -> None:
    resp = await auth_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "notavalidtoken"},
    )
    assert resp.status_code == 401


# --- logout ---

async def test_logout_succeeds(auth_client: AsyncClient, registered_user: dict[str, str]) -> None:
    login_resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    tokens = login_resp.json()

    resp = await auth_client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": tokens["refresh_token"]},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert resp.status_code == 204


async def test_logout_invalidates_refresh_token(
    auth_client: AsyncClient, registered_user: dict[str, str]
) -> None:
    login_resp = await auth_client.post(
        "/api/v1/auth/login",
        json={"email": registered_user["email"], "password": registered_user["password"]},
    )
    tokens = login_resp.json()

    await auth_client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": tokens["refresh_token"]},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )

    # Refresh should now fail
    resp = await auth_client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert resp.status_code == 401


async def test_logout_requires_auth(auth_client: AsyncClient) -> None:
    resp = await auth_client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": "anything"},
    )
    assert resp.status_code == 401
