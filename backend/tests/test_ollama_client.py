"""Tests for OllamaClient — Ollama is mocked at the AsyncClient level."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.llm.ollama_client import OllamaClient

CATEGORIES = ["Food", "Transport", "Shopping", "Utilities"]


def _make_client() -> OllamaClient:
    return OllamaClient(host="http://localhost:11434", model="qwen2.5:1.5b")


def _mock_generate(response: str) -> AsyncMock:
    """Return an AsyncMock that mimics ollama.AsyncClient.generate."""
    resp = MagicMock()
    resp.response = response
    gen = AsyncMock(return_value=resp)
    return gen


@pytest.mark.asyncio
async def test_suggest_category_clean_match():
    client = _make_client()
    with patch.object(client, "_ask", new=AsyncMock(return_value="Transport")):
        result = await client.suggest_category("Ola", "Cab ride", CATEGORIES)
    assert result == "Transport"


@pytest.mark.asyncio
async def test_suggest_category_strips_fences():
    client = _make_client()
    responses = iter(["```\nFood\n```", "Food"])
    with patch.object(client, "_ask", new=AsyncMock(side_effect=lambda _: next(responses))):
        result = await client.suggest_category("Zomato", "Food order", CATEGORIES)
    assert result == "Food"


@pytest.mark.asyncio
async def test_suggest_category_retries_on_bad_output():
    client = _make_client()
    # First call returns garbage, second returns valid category
    responses = iter(["Groceries", "Shopping"])
    with patch.object(client, "_ask", new=AsyncMock(side_effect=lambda _: next(responses))):
        result = await client.suggest_category("Amazon", "Online order", CATEGORIES)
    assert result == "Shopping"


@pytest.mark.asyncio
async def test_suggest_category_returns_none_after_two_bad_attempts():
    client = _make_client()
    with patch.object(client, "_ask", new=AsyncMock(return_value="Unknown category")):
        result = await client.suggest_category("X", "Y", CATEGORIES)
    assert result is None


@pytest.mark.asyncio
async def test_suggest_category_empty_categories_returns_none():
    client = _make_client()
    result = await client.suggest_category("Zomato", "Food", [])
    assert result is None
