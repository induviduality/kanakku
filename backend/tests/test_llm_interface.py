"""Tests for LLMClient interface, NullClient, and factory dispatch."""

import pytest

from app.config import Settings
from app.llm.base import BankCandidate, GPayRecord, LLMClient
from app.llm.factory import make_llm_client
from app.llm.null_client import NullClient


def _settings_with(backend: str) -> Settings:
    return Settings(
        database_url="postgresql+asyncpg://x:x@localhost/x",
        jwt_secret="test",
        llm_backend=backend,
    )


# ── Factory dispatch ──────────────────────────────────────────────────────────

def test_factory_returns_null_client_for_none():
    client = make_llm_client(_settings_with("none"))
    assert isinstance(client, NullClient)


def test_factory_returns_null_client_for_unknown():
    client = make_llm_client(_settings_with("anthropic"))
    assert isinstance(client, NullClient)


def test_factory_returns_ollama_client_for_ollama():
    from app.llm.ollama_client import OllamaClient
    client = make_llm_client(_settings_with("ollama"))
    assert isinstance(client, OllamaClient)


def test_null_client_is_llm_client():
    assert isinstance(NullClient(), LLMClient)


# ── NullClient safety ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_null_suggest_category_returns_none():
    client = NullClient()
    result = await client.suggest_category(
        payee_name="Amazon",
        description="Online purchase",
        available_categories=["Shopping", "Food", "Transport"],
    )
    assert result is None


@pytest.mark.asyncio
async def test_null_suggest_category_empty_categories():
    client = NullClient()
    result = await client.suggest_category("X", "Y", [])
    assert result is None


@pytest.mark.asyncio
async def test_null_match_gpay_returns_no_match_per_record():
    client = NullClient()
    gpay = [
        GPayRecord(date="2024-01-01", amount=100.0, merchant="Zomato"),
        GPayRecord(date="2024-01-02", amount=50.0, merchant="Swiggy"),
    ]
    candidates = [
        [BankCandidate(transaction_id="t1", date="2024-01-01", amount=100.0, description="UPI/Zomato")],
        [],
    ]
    matches = await client.match_gpay_to_bank(gpay, candidates)
    assert len(matches) == 2
    assert matches[0].gpay_index == 0
    assert matches[0].bank_index == -1
    assert matches[1].gpay_index == 1
    assert matches[1].bank_index == -1


@pytest.mark.asyncio
async def test_null_match_gpay_empty_input():
    client = NullClient()
    matches = await client.match_gpay_to_bank([], [])
    assert matches == []
