"""Tests for OllamaClient — Ollama is mocked at the AsyncClient level."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.llm.base import BankCandidate, GPayRecord
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


@pytest.mark.asyncio
async def test_match_gpay_returns_index():
    client = _make_client()
    gpay = [GPayRecord(date="2024-01-01", amount=100.0, merchant="Zomato")]
    candidates = [[
        BankCandidate(transaction_id="t1", date="2024-01-01", amount=100.0, description="UPI/Zomato"),
        BankCandidate(transaction_id="t2", date="2024-01-01", amount=100.0, description="UPI/Food"),
    ]]
    with patch.object(client, "_ask", new=AsyncMock(return_value="0")):
        matches = await client.match_gpay_to_bank(gpay, candidates)
    assert len(matches) == 1
    assert matches[0].gpay_index == 0
    assert matches[0].bank_index == 0


@pytest.mark.asyncio
async def test_match_gpay_no_candidates_returns_minus_one():
    client = _make_client()
    gpay = [GPayRecord(date="2024-01-01", amount=100.0, merchant="Zomato")]
    matches = await client.match_gpay_to_bank(gpay, [[]])
    assert matches[0].bank_index == -1


@pytest.mark.asyncio
async def test_match_gpay_parses_index_from_prose():
    client = _make_client()
    gpay = [GPayRecord(date="2024-01-02", amount=50.0, merchant="Swiggy")]
    candidates = [[
        BankCandidate(transaction_id="t1", date="2024-01-02", amount=50.0, description="UPI/Swiggy"),
    ]]
    # LLM returns index embedded in prose
    with patch.object(client, "_ask", new=AsyncMock(return_value="The answer is 0.")):
        matches = await client.match_gpay_to_bank(gpay, candidates)
    assert matches[0].bank_index == 0


@pytest.mark.asyncio
async def test_match_gpay_out_of_range_returns_minus_one():
    client = _make_client()
    gpay = [GPayRecord(date="2024-01-01", amount=100.0, merchant="X")]
    candidates = [[
        BankCandidate(transaction_id="t1", date="2024-01-01", amount=100.0, description="X"),
    ]]
    with patch.object(client, "_ask", new=AsyncMock(return_value="5")):
        matches = await client.match_gpay_to_bank(gpay, candidates)
    assert matches[0].bank_index == -1
