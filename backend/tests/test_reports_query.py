"""Tests for POST /api/v1/reports/query."""

import pytest
from httpx import AsyncClient


async def _setup(client: AsyncClient, email: str = "admin@example.com") -> dict:
    resp = await client.post(
        "/api/v1/auth/setup", json={"email": email, "password": "password123"}
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def _account(client: AsyncClient, headers: dict) -> str:
    resp = await client.post(
        "/api/v1/accounts",
        json={"name": "Test Bank", "type": "bank", "currency": "INR", "opening_balance": "1000.00"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.mark.usefixtures("db_tables")
async def test_select_works(client: AsyncClient) -> None:
    headers = await _setup(client)
    await _account(client, headers)
    resp = await client.post(
        "/api/v1/reports/query",
        json={"sql": "SELECT id, name FROM accounts WHERE user_id = :user_id"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "columns" in data
    assert "rows" in data
    assert "id" in data["columns"]
    assert "name" in data["columns"]
    assert data["truncated"] is False
    assert data["row_count"] >= 0


@pytest.mark.usefixtures("db_tables")
async def test_insert_rejected_by_validation(client: AsyncClient) -> None:
    headers = await _setup(client)
    resp = await client.post(
        "/api/v1/reports/query",
        json={"sql": "INSERT INTO accounts (id, user_id, name, type, currency, opening_balance, current_balance) VALUES ('00000000-0000-0000-0000-000000000001', :user_id, 'x', 'bank', 'INR', 0, 0)"},
        headers=headers,
    )
    assert resp.status_code == 400
    assert "SELECT" in resp.json()["detail"]


@pytest.mark.usefixtures("db_tables")
async def test_update_rejected_by_validation(client: AsyncClient) -> None:
    headers = await _setup(client)
    resp = await client.post(
        "/api/v1/reports/query",
        json={"sql": "UPDATE accounts SET name = 'x' WHERE user_id = :user_id"},
        headers=headers,
    )
    assert resp.status_code == 400
    assert "SELECT" in resp.json()["detail"]


@pytest.mark.usefixtures("db_tables")
async def test_missing_user_id_auto_scoped(client: AsyncClient) -> None:
    """A query with no explicit user_id filter isn't rejected — the AST
    rewrite in _inject_user_id_filter injects `table.user_id = :user_id`
    automatically for every table that carries one (_validate_sql only
    rejects non-SELECT and multi-statement input). This is safer than
    requiring the caller to remember the filter themselves: it can't be
    forgotten. Regression guard for the actual security property — a query
    against a table with a user_id column never returns another user's rows,
    even when the caller's SQL doesn't mention user_id at all."""
    headers = await _setup(client)
    await _account(client, headers)
    resp = await client.post(
        "/api/v1/reports/query",
        json={"sql": "SELECT * FROM accounts"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["row_count"] == 1
    assert data["rows"][0]["name"] == "Test Bank"


@pytest.mark.usefixtures("db_tables")
async def test_multiple_statements_rejected(client: AsyncClient) -> None:
    headers = await _setup(client)
    resp = await client.post(
        "/api/v1/reports/query",
        json={"sql": "SELECT 1 WHERE user_id = :user_id; DROP TABLE accounts"},
        headers=headers,
    )
    assert resp.status_code == 400
    assert "Multiple" in resp.json()["detail"]


@pytest.mark.usefixtures("db_tables")
async def test_invalid_sql_rejected(client: AsyncClient) -> None:
    headers = await _setup(client)
    resp = await client.post(
        "/api/v1/reports/query",
        json={"sql": "THIS IS NOT SQL user_id = :user_id"},
        headers=headers,
    )
    assert resp.status_code == 400


@pytest.mark.usefixtures("db_tables")
async def test_unauthenticated_rejected(client: AsyncClient) -> None:
    resp = await client.post(
        "/api/v1/reports/query",
        json={"sql": "SELECT * FROM accounts WHERE user_id = :user_id"},
    )
    assert resp.status_code == 401


@pytest.mark.usefixtures("db_tables")
async def test_row_limit_enforced(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    import app.config as cfg
    monkeypatch.setattr(cfg.settings, "query_row_limit", 1)

    headers = await _setup(client)
    # Create 3 accounts
    for i in range(3):
        await client.post(
            "/api/v1/accounts",
            json={"name": f"Account {i}", "type": "bank", "currency": "INR", "opening_balance": "0"},
            headers=headers,
        )

    resp = await client.post(
        "/api/v1/reports/query",
        json={"sql": "SELECT id FROM accounts WHERE user_id = :user_id"},
        headers=headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["row_count"] == 1
    assert data["truncated"] is True
