"""Unit tests for services/balance_verifier.py."""

from decimal import Decimal

from app.models.import_batch import VerificationStatus
from app.parsers.base import ParsedRecord, StatementHeader
from app.services.balance_verifier import verify_balance


def _record(amount: str, type_: str) -> ParsedRecord:
    return ParsedRecord(
        date="2025-01-15", description="test", amount=Decimal(amount), type=type_
    )


def _header(opening: str, closing: str) -> StatementHeader:
    return StatementHeader(
        opening_balance=Decimal(opening), closing_balance=Decimal(closing)
    )


# ── VERIFIED ──────────────────────────────────────────────────────────────────

def test_verified_net_matches() -> None:
    records = [_record("500.00", "expense")]
    assert verify_balance(_header("10000.00", "9500.00"), records) == VerificationStatus.verified


def test_verified_with_income() -> None:
    records = [_record("2000.00", "income")]
    assert verify_balance(_header("5000.00", "7000.00"), records) == VerificationStatus.verified


def test_verified_mixed_transactions() -> None:
    records = [_record("1000.00", "expense"), _record("200.00", "income")]
    assert verify_balance(_header("10000.00", "9200.00"), records) == VerificationStatus.verified


def test_verified_within_rounding_tolerance() -> None:
    # Closing balance differs by ≤1 due to rounding
    records = [_record("500.00", "expense")]
    assert verify_balance(_header("10000.00", "9499.50"), records) == VerificationStatus.verified


# ── DISCREPANCY ───────────────────────────────────────────────────────────────

def test_discrepancy_when_sum_wrong() -> None:
    records = [_record("500.00", "expense")]
    assert verify_balance(_header("10000.00", "9000.00"), records) == VerificationStatus.discrepancy


def test_discrepancy_with_missing_records() -> None:
    # Statement shows large drop but no records parsed
    assert verify_balance(_header("10000.00", "5000.00"), []) == VerificationStatus.discrepancy


# ── INDETERMINATE ─────────────────────────────────────────────────────────────

def test_indeterminate_no_opening_balance() -> None:
    header = StatementHeader(closing_balance=Decimal("9500.00"))
    records = [_record("500.00", "expense")]
    assert verify_balance(header, records) == VerificationStatus.indeterminate


def test_indeterminate_no_closing_balance() -> None:
    header = StatementHeader(opening_balance=Decimal("10000.00"))
    records = [_record("500.00", "expense")]
    assert verify_balance(header, records) == VerificationStatus.indeterminate


def test_indeterminate_empty_header() -> None:
    assert verify_balance(StatementHeader(), []) == VerificationStatus.indeterminate
