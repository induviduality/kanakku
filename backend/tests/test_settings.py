"""Integration tests for GET/PATCH /api/v1/settings."""

import pytest
from httpx import AsyncClient


async def _create_user_and_token(
    client: AsyncClient, email: str, password: str = "password123"
) -> str:
    """Helper: create user via setup or invite path; return access token."""
    resp = await client.post(
        "/api/v1/auth/setup",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


async def _create_invited_user_token(
    client: AsyncClient, inviter_token: str, email: str, password: str = "password123"
) -> str:
    """Helper: create an additional user via the invite flow; return access token."""
    invite_resp = await client.post(
        "/api/v1/auth/invites",
        json={"email": email},
        headers={"Authorization": f"Bearer {inviter_token}"},
    )
    assert invite_resp.status_code == 201
    token = invite_resp.json()["token"]

    accept_resp = await client.post(
        "/api/v1/auth/accept-invite",
        json={"token": token, "email": email, "password": password},
    )
    assert accept_resp.status_code == 201
    return accept_resp.json()["access_token"]


@pytest.fixture
async def setup_client(client: AsyncClient, db_tables: None) -> AsyncClient:
    return client


async def test_settings_created_with_defaults_on_setup(setup_client: AsyncClient) -> None:
    token = await _create_user_and_token(setup_client, "admin@example.com")

    resp = await setup_client.get(
        "/api/v1/settings",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["primary_currency"] == "INR"
    assert data["timezone"] == "Asia/Kolkata"
    assert data["date_format"] == "DD/MM/YYYY"
    assert data["number_format"] == "en-IN"
    assert "updated_at" in data
    assert "user_id" in data


async def test_settings_created_with_defaults_on_accept_invite(setup_client: AsyncClient) -> None:
    inviter_token = await _create_user_and_token(setup_client, "admin@example.com")
    new_token = await _create_invited_user_token(
        setup_client, inviter_token, "new@example.com"
    )

    resp = await setup_client.get(
        "/api/v1/settings",
        headers={"Authorization": f"Bearer {new_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["primary_currency"] == "INR"


async def test_patch_settings_partial_update(setup_client: AsyncClient) -> None:
    token = await _create_user_and_token(setup_client, "admin@example.com")

    resp = await setup_client.patch(
        "/api/v1/settings",
        json={"primary_currency": "USD", "timezone": "America/New_York"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["primary_currency"] == "USD"
    assert data["timezone"] == "America/New_York"
    # unchanged fields stay at defaults
    assert data["date_format"] == "DD/MM/YYYY"
    assert data["number_format"] == "en-IN"


async def test_patch_settings_empty_body_is_noop(setup_client: AsyncClient) -> None:
    token = await _create_user_and_token(setup_client, "admin@example.com")

    resp = await setup_client.patch(
        "/api/v1/settings",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["primary_currency"] == "INR"


async def test_get_settings_requires_auth(setup_client: AsyncClient) -> None:
    resp = await setup_client.get("/api/v1/settings")
    assert resp.status_code == 401


async def test_patch_settings_requires_auth(setup_client: AsyncClient) -> None:
    resp = await setup_client.patch("/api/v1/settings", json={"primary_currency": "USD"})
    assert resp.status_code == 401


async def test_settings_scoping_user_a_cannot_read_user_b(setup_client: AsyncClient) -> None:
    """User A can only see their own settings."""
    token_a = await _create_user_and_token(setup_client, "a@example.com")
    token_b = await _create_invited_user_token(setup_client, token_a, "b@example.com")

    # Patch A's settings
    await setup_client.patch(
        "/api/v1/settings",
        json={"primary_currency": "EUR"},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    # B should still see defaults
    resp_b = await setup_client.get(
        "/api/v1/settings",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp_b.status_code == 200
    assert resp_b.json()["primary_currency"] == "INR"

    # A should see EUR
    resp_a = await setup_client.get(
        "/api/v1/settings",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert resp_a.json()["primary_currency"] == "EUR"
