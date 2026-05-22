"""Integration tests for POST /api/v1/auth/setup."""

import pytest
from httpx import AsyncClient

from app.security.tokens import decode_token


@pytest.fixture
async def setup_client(client: AsyncClient, db_tables: None) -> AsyncClient:
    """Client with DB tables initialised and torn down around each test."""
    return client


async def test_first_setup_succeeds(setup_client: AsyncClient) -> None:
    resp = await setup_client.post(
        "/api/v1/auth/setup",
        json={"email": "admin@example.com", "password": "strongpassword"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def test_setup_tokens_are_valid_jwts(setup_client: AsyncClient) -> None:
    resp = await setup_client.post(
        "/api/v1/auth/setup",
        json={"email": "admin@example.com", "password": "strongpassword"},
    )
    data = resp.json()
    access_payload = decode_token(data["access_token"])
    refresh_payload = decode_token(data["refresh_token"])
    assert access_payload["type"] == "access"
    assert refresh_payload["type"] == "refresh"
    assert access_payload["sub"] == refresh_payload["sub"]


async def test_second_setup_returns_404(setup_client: AsyncClient) -> None:
    await setup_client.post(
        "/api/v1/auth/setup",
        json={"email": "admin@example.com", "password": "strongpassword"},
    )
    resp = await setup_client.post(
        "/api/v1/auth/setup",
        json={"email": "other@example.com", "password": "strongpassword"},
    )
    assert resp.status_code == 404


async def test_setup_rejects_invalid_email(setup_client: AsyncClient) -> None:
    resp = await setup_client.post(
        "/api/v1/auth/setup",
        json={"email": "not-an-email", "password": "strongpassword"},
    )
    assert resp.status_code == 422


async def test_setup_rejects_missing_password(setup_client: AsyncClient) -> None:
    resp = await setup_client.post(
        "/api/v1/auth/setup",
        json={"email": "admin@example.com"},
    )
    assert resp.status_code == 422


async def test_setup_rejects_missing_email(setup_client: AsyncClient) -> None:
    resp = await setup_client.post(
        "/api/v1/auth/setup",
        json={"password": "strongpassword"},
    )
    assert resp.status_code == 422
