"""Integration tests for the invite token flow."""

import pytest
from httpx import AsyncClient


@pytest.fixture
async def invite_client(client: AsyncClient, db_tables: None) -> AsyncClient:
    return client


@pytest.fixture
async def admin_tokens(invite_client: AsyncClient) -> dict[str, str]:
    resp = await invite_client.post(
        "/api/v1/auth/setup",
        json={"email": "admin@example.com", "password": "adminpassword"},
    )
    assert resp.status_code == 201
    return resp.json()  # type: ignore[no-any-return]


def _auth(tokens: dict[str, str]) -> dict[str, str]:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


# --- create invite ---

async def test_create_invite_requires_auth(invite_client: AsyncClient) -> None:
    resp = await invite_client.post("/api/v1/auth/invites", json={})
    assert resp.status_code == 403


async def test_create_invite_returns_token(
    invite_client: AsyncClient, admin_tokens: dict[str, str]
) -> None:
    resp = await invite_client.post(
        "/api/v1/auth/invites", json={}, headers=_auth(admin_tokens)
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "token" in data
    assert "expires_at" in data


async def test_create_invite_with_email(
    invite_client: AsyncClient, admin_tokens: dict[str, str]
) -> None:
    resp = await invite_client.post(
        "/api/v1/auth/invites",
        json={"email": "guest@example.com"},
        headers=_auth(admin_tokens),
    )
    assert resp.status_code == 201


# --- invite info ---

async def test_invite_info_valid_token(
    invite_client: AsyncClient, admin_tokens: dict[str, str]
) -> None:
    create_resp = await invite_client.post(
        "/api/v1/auth/invites", json={}, headers=_auth(admin_tokens)
    )
    token = create_resp.json()["token"]

    resp = await invite_client.get(f"/api/v1/auth/invites/{token}/info")
    assert resp.status_code == 200
    data = resp.json()
    assert "expires_at" in data
    assert data["email"] is None


async def test_invite_info_with_email(
    invite_client: AsyncClient, admin_tokens: dict[str, str]
) -> None:
    create_resp = await invite_client.post(
        "/api/v1/auth/invites",
        json={"email": "guest@example.com"},
        headers=_auth(admin_tokens),
    )
    token = create_resp.json()["token"]

    resp = await invite_client.get(f"/api/v1/auth/invites/{token}/info")
    assert resp.status_code == 200
    assert resp.json()["email"] == "guest@example.com"


async def test_invite_info_unknown_token(invite_client: AsyncClient) -> None:
    resp = await invite_client.get("/api/v1/auth/invites/doesnotexist/info")
    assert resp.status_code == 404


async def test_invite_info_used_token_returns_410(
    invite_client: AsyncClient, admin_tokens: dict[str, str]
) -> None:
    create_resp = await invite_client.post(
        "/api/v1/auth/invites", json={}, headers=_auth(admin_tokens)
    )
    token = create_resp.json()["token"]

    await invite_client.post(
        "/api/v1/auth/accept-invite",
        json={"token": token, "email": "newuser@example.com", "password": "pass1234"},
    )

    resp = await invite_client.get(f"/api/v1/auth/invites/{token}/info")
    assert resp.status_code == 410


# --- accept invite ---

async def test_accept_invite_creates_user(
    invite_client: AsyncClient, admin_tokens: dict[str, str]
) -> None:
    create_resp = await invite_client.post(
        "/api/v1/auth/invites", json={}, headers=_auth(admin_tokens)
    )
    token = create_resp.json()["token"]

    resp = await invite_client.post(
        "/api/v1/auth/accept-invite",
        json={"token": token, "email": "newuser@example.com", "password": "pass1234"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


async def test_accept_invite_single_use(
    invite_client: AsyncClient, admin_tokens: dict[str, str]
) -> None:
    create_resp = await invite_client.post(
        "/api/v1/auth/invites", json={}, headers=_auth(admin_tokens)
    )
    token = create_resp.json()["token"]

    await invite_client.post(
        "/api/v1/auth/accept-invite",
        json={"token": token, "email": "newuser@example.com", "password": "pass1234"},
    )
    resp = await invite_client.post(
        "/api/v1/auth/accept-invite",
        json={"token": token, "email": "other@example.com", "password": "pass1234"},
    )
    assert resp.status_code == 410


async def test_accept_invite_wrong_email_rejected(
    invite_client: AsyncClient, admin_tokens: dict[str, str]
) -> None:
    create_resp = await invite_client.post(
        "/api/v1/auth/invites",
        json={"email": "specific@example.com"},
        headers=_auth(admin_tokens),
    )
    token = create_resp.json()["token"]

    resp = await invite_client.post(
        "/api/v1/auth/accept-invite",
        json={"token": token, "email": "wrong@example.com", "password": "pass1234"},
    )
    assert resp.status_code == 400


async def test_accept_invite_correct_email_passes(
    invite_client: AsyncClient, admin_tokens: dict[str, str]
) -> None:
    create_resp = await invite_client.post(
        "/api/v1/auth/invites",
        json={"email": "specific@example.com"},
        headers=_auth(admin_tokens),
    )
    token = create_resp.json()["token"]

    resp = await invite_client.post(
        "/api/v1/auth/accept-invite",
        json={"token": token, "email": "specific@example.com", "password": "pass1234"},
    )
    assert resp.status_code == 201


async def test_accept_invite_duplicate_email_rejected(
    invite_client: AsyncClient, admin_tokens: dict[str, str]
) -> None:
    t1_resp = await invite_client.post(
        "/api/v1/auth/invites", json={}, headers=_auth(admin_tokens)
    )
    t2_resp = await invite_client.post(
        "/api/v1/auth/invites", json={}, headers=_auth(admin_tokens)
    )
    token1, token2 = t1_resp.json()["token"], t2_resp.json()["token"]

    await invite_client.post(
        "/api/v1/auth/accept-invite",
        json={"token": token1, "email": "dup@example.com", "password": "pass1234"},
    )
    resp = await invite_client.post(
        "/api/v1/auth/accept-invite",
        json={"token": token2, "email": "dup@example.com", "password": "pass1234"},
    )
    assert resp.status_code == 409


async def test_accept_invite_unknown_token(invite_client: AsyncClient) -> None:
    resp = await invite_client.post(
        "/api/v1/auth/accept-invite",
        json={"token": "fakefakefake", "email": "x@example.com", "password": "pass1234"},
    )
    assert resp.status_code == 404
