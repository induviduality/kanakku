"""Tests for GET /api/v1/reports/schema."""

import pytest
from httpx import AsyncClient


async def _setup(client: AsyncClient) -> dict:
    resp = await client.post(
        "/api/v1/auth/setup", json={"email": "admin@example.com", "password": "password123"}
    )
    assert resp.status_code == 201
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.mark.usefixtures("db_tables")
async def test_schema_returns_curated_tables(client: AsyncClient) -> None:
    headers = await _setup(client)
    resp = await client.get("/api/v1/reports/schema", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "tables" in data
    table_names = {t["name"] for t in data["tables"]}
    expected = {
        "accounts", "transactions", "categories", "tags", "payees",
        "payment_methods", "splits", "split_shares", "budgets", "subscriptions",
        "piggy_banks", "import_batches",
    }
    assert expected.issubset(table_names)


@pytest.mark.usefixtures("db_tables")
async def test_schema_excludes_auth_tables(client: AsyncClient) -> None:
    headers = await _setup(client)
    resp = await client.get("/api/v1/reports/schema", headers=headers)
    assert resp.status_code == 200
    table_names = {t["name"] for t in resp.json()["tables"]}
    assert "users" not in table_names
    assert "sessions" not in table_names
    assert "invite_tokens" not in table_names


@pytest.mark.usefixtures("db_tables")
async def test_schema_includes_fk_metadata(client: AsyncClient) -> None:
    headers = await _setup(client)
    resp = await client.get("/api/v1/reports/schema", headers=headers)
    tables = {t["name"]: t for t in resp.json()["tables"]}
    txn_table = tables["transactions"]
    fk_cols = [c for c in txn_table["columns"] if c["foreign_key"]]
    assert len(fk_cols) > 0
    fk_targets = {c["foreign_key"] for c in fk_cols}
    assert "accounts.id" in fk_targets


@pytest.mark.usefixtures("db_tables")
async def test_schema_unauthenticated_rejected(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/reports/schema")
    assert resp.status_code == 401
