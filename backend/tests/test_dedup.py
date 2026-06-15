"""Unit tests for services/dedup.py."""

import datetime as dt
from decimal import Decimal

from app.services.dedup import find_duplicates


def _txn(amount: str, date: str, description: str, account: str = "acc1") -> dict[str, object]:
    return {
        "id": "txn-1",
        "transacted_at": dt.datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=dt.UTC),
        "amount": Decimal(amount),
        "description": description,
        "account_id": account,
    }


def _candidate(amount: str, date: str, description: str) -> dict[str, object]:
    return {"amount": amount, "date": date, "description": description}


# ── Exact match ───────────────────────────────────────────────────────────────

def test_exact_match_found() -> None:
    existing = [_txn("500.00", "2025-01-15", "SWIGGY UPI")]
    cand = _candidate("500.00", "2025-01-15", "SWIGGY UPI")
    assert find_duplicates(cand, existing) == existing


def test_exact_match_description_differs() -> None:
    # Same date + same amount is sufficient — description not required
    existing = [_txn("500.00", "2025-01-15", "SWIGGY")]
    cand = _candidate("500.00", "2025-01-15", "UPI/SWIGGY DELIVERY 1234")
    assert len(find_duplicates(cand, existing)) == 1


def test_exact_match_case_insensitive_amount() -> None:
    existing = [_txn("350.00", "2025-02-10", "Amazon Pay")]
    cand = _candidate("350.00", "2025-02-10", "AMAZON PAY")
    assert len(find_duplicates(cand, existing)) == 1


# ── Date mismatch ─────────────────────────────────────────────────────────────

def test_one_day_off_no_match() -> None:
    existing = [_txn("200.00", "2025-01-01", "Netflix")]
    cand = _candidate("200.00", "2025-01-02", "Netflix")
    assert find_duplicates(cand, existing) == []


def test_three_days_off_no_match() -> None:
    existing = [_txn("200.00", "2025-01-01", "Netflix")]
    cand = _candidate("200.00", "2025-01-04", "Netflix")
    assert find_duplicates(cand, existing) == []


# ── Amount mismatch ───────────────────────────────────────────────────────────

def test_amount_mismatch_no_match() -> None:
    existing = [_txn("500.00", "2025-01-15", "SWIGGY")]
    cand = _candidate("499.00", "2025-01-15", "SWIGGY")
    assert find_duplicates(cand, existing) == []


def test_multiple_same_day_same_amount_all_flagged() -> None:
    # Two legitimate identical transactions in one day — both should be flagged
    t1 = _txn("100.00", "2025-01-10", "ATM")
    t2 = {**t1, "id": "txn-2"}
    existing = [t1, t2]
    cand = _candidate("100.00", "2025-01-10", "ATM")
    assert len(find_duplicates(cand, existing)) == 2


def test_only_matching_amount_flagged() -> None:
    existing = [_txn("100.00", "2025-01-10", "ATM"), _txn("500.00", "2025-01-10", "ATM")]
    cand = _candidate("100.00", "2025-01-10", "ATM")
    matches = find_duplicates(cand, existing)
    assert len(matches) == 1
    assert matches[0]["amount"] == Decimal("100.00")


# ── Edge cases ────────────────────────────────────────────────────────────────

def test_empty_existing_no_match() -> None:
    cand = _candidate("100.00", "2025-01-01", "test")
    assert find_duplicates(cand, []) == []


def test_invalid_candidate_date() -> None:
    existing = [_txn("100.00", "2025-01-01", "test")]
    cand: dict[str, object] = {"amount": "100.00", "date": "not-a-date", "description": "test"}
    assert find_duplicates(cand, existing) == []
