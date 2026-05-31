"""Integration tests for LLM activity log — model and GET /settings/llm-activity."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.llm.base import GPayRecord
from app.llm.logging import LoggingLLMClient
from app.llm.null_client import NullClient


async def _setup_user(client: AsyncClient) -> str:
    resp = await client.post(
        "/api/v1/auth/setup",
        json={"email": "llm@example.com", "password": "password123"},
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


@pytest.fixture
async def setup_client(client: AsyncClient, db_tables: None) -> AsyncClient:
    return client


# ── LoggingLLMClient writes rows ──────────────────────────────────────────────

async def test_suggest_category_logged(setup_client: AsyncClient, db_session: AsyncSession) -> None:
    token = await _setup_user(setup_client)

    # Resolve user id
    me = await setup_client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    user_id = uuid.UUID(me.json()["id"])

    inner = NullClient()
    logging_client = LoggingLLMClient(
        inner=inner,
        session=db_session,
        user_id=user_id,
        backend="none",
        model="null",
    )
    await logging_client.suggest_category("Amazon", "Online order", ["Shopping", "Food"])

    # Fetch the log via API
    resp = await setup_client.get(
        "/api/v1/settings/llm-activity",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) == 1
    log = logs[0]
    assert log["operation"] == "suggest_category"
    assert log["backend"] == "none"
    assert log["model"] == "null"
    assert log["succeeded"] is True
    assert log["payload_summary"]["payee"] == "Amazon"
    assert log["payload_summary"]["category_count"] == 2


async def test_match_gpay_logged(setup_client: AsyncClient, db_session: AsyncSession) -> None:
    token = await _setup_user(setup_client)
    me = await setup_client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    user_id = uuid.UUID(me.json()["id"])

    inner = NullClient()
    logging_client = LoggingLLMClient(
        inner=inner,
        session=db_session,
        user_id=user_id,
        backend="none",
        model="null",
    )
    gpay = [GPayRecord(date="2024-01-01", amount=100.0, merchant="Zomato")]
    await logging_client.match_gpay_to_bank(gpay, [[]])

    resp = await setup_client.get(
        "/api/v1/settings/llm-activity",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) == 1
    log = logs[0]
    assert log["operation"] == "match_gpay_to_bank"
    assert log["payload_summary"]["gpay_count"] == 1


async def test_failed_call_logged_with_succeeded_false(
    setup_client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await _setup_user(setup_client)
    me = await setup_client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    user_id = uuid.UUID(me.json()["id"])

    class ErrorClient:
        async def suggest_category(self, *a, **k):
            raise RuntimeError("Ollama down")

    logging_client = LoggingLLMClient(
        inner=ErrorClient(),
        session=db_session,
        user_id=user_id,
        backend="ollama",
        model="qwen2.5:1.5b",
    )
    with pytest.raises(RuntimeError):
        await logging_client.suggest_category("X", "Y", ["Shopping"])

    resp = await setup_client.get(
        "/api/v1/settings/llm-activity",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    logs = resp.json()
    assert len(logs) == 1
    assert logs[0]["succeeded"] is False


# ── GET /settings/llm-activity ────────────────────────────────────────────────

async def test_llm_activity_empty_list(setup_client: AsyncClient) -> None:
    token = await _setup_user(setup_client)
    resp = await setup_client.get(
        "/api/v1/settings/llm-activity",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_llm_activity_requires_auth(setup_client: AsyncClient) -> None:
    resp = await setup_client.get("/api/v1/settings/llm-activity")
    assert resp.status_code == 401


async def test_llm_activity_filter_by_operation(
    setup_client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await _setup_user(setup_client)
    me = await setup_client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    user_id = uuid.UUID(me.json()["id"])

    inner = NullClient()
    lc = LoggingLLMClient(inner=inner, session=db_session, user_id=user_id, backend="none", model="null")
    await lc.suggest_category("X", "Y", ["Food"])
    await lc.match_gpay_to_bank([], [])

    resp = await setup_client.get(
        "/api/v1/settings/llm-activity?operation=suggest_category",
        headers={"Authorization": f"Bearer {token}"},
    )
    logs = resp.json()
    assert len(logs) == 1
    assert logs[0]["operation"] == "suggest_category"


async def test_llm_activity_filter_by_backend(
    setup_client: AsyncClient, db_session: AsyncSession
) -> None:
    token = await _setup_user(setup_client)
    me = await setup_client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}
    )
    user_id = uuid.UUID(me.json()["id"])

    inner = NullClient()
    lc = LoggingLLMClient(inner=inner, session=db_session, user_id=user_id, backend="none", model="null")
    await lc.suggest_category("X", "Y", ["Food"])

    resp = await setup_client.get(
        "/api/v1/settings/llm-activity?backend=none",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert len(resp.json()) == 1

    resp2 = await setup_client.get(
        "/api/v1/settings/llm-activity?backend=ollama",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp2.json() == []
