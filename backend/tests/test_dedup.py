"""Unit tests for services/dedup.py."""

import datetime as dt
from decimal import Decimal

from app.services.dedup import find_duplicates


def _txn(amount: str, date: str, description: str, account: str = "acc1") -> dict[str, object]:
    return {
        "id": "txn-1",
        "transacted_at": dt.datetime.strptime(date, "%Y-%m-%d").replace(
            tzinfo=dt.UTC
        ),
        "amount": Decimal(amount),
        "description": description,
        "account_id": account,
    }


def _candidate(amount: str, date: str, description: str) -> dict[str, object]:
    return {"amount": amount, "date": date, "description": description}


# ── Exact duplicate ───────────────────────────────────────────────────────────

def test_exact_match_found() -> None:
    existing = [_txn("500.00", "2025-01-15", "SWIGGY UPI")]
    cand = _candidate("500.00", "2025-01-15", "SWIGGY UPI")
    assert find_duplicates(cand, existing) == existing


def test_exact_match_same_day_different_case() -> None:
    existing = [_txn("350.00", "2025-02-10", "Amazon Pay")]
    cand = _candidate("350.00", "2025-02-10", "AMAZON PAY")
    assert len(find_duplicates(cand, existing)) == 1


# ── Fuzzy match ───────────────────────────────────────────────────────────────

def test_fuzzy_description_match() -> None:
    existing = [_txn("120.00", "2025-01-01", "UPI/ZEPTO GROCERY")]
    cand = _candidate("120.00", "2025-01-02", "UPI ZEPTO GROCERY 01")
    assert len(find_duplicates(cand, existing)) == 1


def test_within_date_window() -> None:
    existing = [_txn("200.00", "2025-01-01", "Netflix")]
    cand = _candidate("200.00", "2025-01-04", "Netflix")  # 3 days later — still in window
    assert len(find_duplicates(cand, existing)) == 1


def test_outside_date_window() -> None:
    existing = [_txn("200.00", "2025-01-01", "Netflix")]
    cand = _candidate("200.00", "2025-01-05", "Netflix")  # 4 days — outside window
    assert find_duplicates(cand, existing) == []


# ── Amount mismatch ───────────────────────────────────────────────────────────

def test_amount_mismatch_no_match() -> None:
    existing = [_txn("500.00", "2025-01-15", "SWIGGY")]
    cand = _candidate("499.00", "2025-01-15", "SWIGGY")
    assert find_duplicates(cand, existing) == []


# ── Cross-account negative ────────────────────────────────────────────────────

def test_different_amounts_not_duplicate() -> None:
    existing = [_txn("100.00", "2025-01-10", "ATM"), _txn("500.00", "2025-01-10", "ATM")]
    cand = _candidate("100.00", "2025-01-10", "ATM")
    matches = find_duplicates(cand, existing)
    # Only the 100 one matches, not the 500
    assert len(matches) == 1
    assert matches[0]["amount"] == Decimal("100.00")


# ── Low description similarity ─────────────────────────────────────────────────

def test_totally_different_description_no_match() -> None:
    existing = [_txn("300.00", "2025-01-15", "ZomatoOrder")]
    cand = _candidate("300.00", "2025-01-15", "ELECTRICITY BILL PAYMENT")
    assert find_duplicates(cand, existing) == []


# ── Empty/invalid inputs ──────────────────────────────────────────────────────

def test_empty_existing_no_match() -> None:
    cand = _candidate("100.00", "2025-01-01", "test")
    assert find_duplicates(cand, []) == []


def test_invalid_candidate_date() -> None:
    existing = [_txn("100.00", "2025-01-01", "test")]
    cand: dict[str, object] = {"amount": "100.00", "date": "not-a-date", "description": "test"}
    assert find_duplicates(cand, existing) == []
