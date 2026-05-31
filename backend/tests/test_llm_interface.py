"""Tests for LLMClient interface, NullClient, and factory dispatch."""

import pytest

from app.config import Settings
from app.llm.base import LLMClient
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
