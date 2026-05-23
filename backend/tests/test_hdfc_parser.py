"""Unit tests for HDFC statement parser.

Uses pdfplumber-backed parsing with a minimal synthetic PDF built with reportlab.
If reportlab is not available, parser logic tests use direct method calls instead.
"""

import io
from decimal import Decimal

from app.parsers.banks.hdfc import HDFCParser, _parse_amount, _parse_date_to_iso
from app.parsers.base import ParsedRecord
from app.parsers.registry import detect_parser

# ── Utility function tests (no PDF needed) ────────────────────────────────────

def test_parse_amount_basic() -> None:
    assert _parse_amount("1,23,456.78") == Decimal("123456.78")


def test_parse_amount_plain() -> None:
    assert _parse_amount("500.00") == Decimal("500.00")


def test_parse_amount_empty() -> None:
    assert _parse_amount("") is None


def test_parse_amount_non_numeric() -> None:
    assert _parse_amount("N/A") is None


def test_parse_date_to_iso_two_digit_year() -> None:
    assert _parse_date_to_iso("15/01/25") == "2025-01-15"


def test_parse_date_to_iso_four_digit_year() -> None:
    assert _parse_date_to_iso("15/01/2025") == "2025-01-15"


def test_parse_date_to_iso_invalid() -> None:
    # Should return the input unchanged if format not recognised
    assert _parse_date_to_iso("not-a-date") == "not-a-date"


# ── Table-parsing logic ───────────────────────────────────────────────────────

def _make_hdfc_table(rows: list[list[str | None]]) -> list[list[str | None]]:
    """Return a well-formed HDFC table with header row prepended."""
    header: list[str | None] = [
        "Date", "Narration", "Chq./Ref.No.", "Value Dt",
        "Withdrawal Amt.", "Deposit Amt.", "Closing Balance",
    ]
    return [header, *rows]


def test_parse_table_expense_row() -> None:
    parser = HDFCParser()
    table = _make_hdfc_table([
        ["15/01/25", "SWIGGY UPI 123", "REF001", "15/01/25", "350.00", "", "9,650.00"],
    ])
    records = parser._parse_table(table)
    assert len(records) == 1
    r = records[0]
    assert r.date == "2025-01-15"
    assert r.description == "SWIGGY UPI 123"
    assert r.amount == Decimal("350.00")
    assert r.type == "expense"
    assert r.balance == Decimal("9650.00")


def test_parse_table_income_row() -> None:
    parser = HDFCParser()
    table = _make_hdfc_table([
        ["10/01/25", "SALARY CREDIT", "SAL001", "10/01/25", "", "50,000.00", "60,000.00"],
    ])
    records = parser._parse_table(table)
    assert len(records) == 1
    r = records[0]
    assert r.type == "income"
    assert r.amount == Decimal("50000.00")


def test_parse_table_skips_non_date_rows() -> None:
    parser = HDFCParser()
    table = _make_hdfc_table([
        ["Opening Balance", "", "", "", "", "", "10,000.00"],
        ["15/01/25", "SWIGGY", "", "", "100.00", "", "9,900.00"],
    ])
    records = parser._parse_table(table)
    assert len(records) == 1


def test_parse_table_no_header_returns_empty() -> None:
    parser = HDFCParser()
    table: list[list[str | None]] = [
        ["some row", "data"],
        ["other row", "data"],
    ]
    records = parser._parse_table(table)
    assert records == []


def test_parse_table_mixed_rows() -> None:
    parser = HDFCParser()
    table = _make_hdfc_table([
        ["01/01/25", "NETFLIX SUBSCRIPTION", "NF001", "01/01/25", "649.00", "", "9,351.00"],
        ["05/01/25", "UPI CASHBACK", "CB001", "05/01/25", "", "50.00", "9,401.00"],
        ["10/01/25", "AMAZON SHOPPING", "AM001", "10/01/25", "1,200.00", "", "8,201.00"],
    ])
    records = parser._parse_table(table)
    assert len(records) == 3
    assert records[0].type == "expense"
    assert records[1].type == "income"
    assert records[2].amount == Decimal("1200.00")


# ── to_dict ───────────────────────────────────────────────────────────────────

def test_parsed_record_to_dict() -> None:
    r = ParsedRecord(
        date="2025-01-15",
        description="SWIGGY",
        amount=Decimal("350.00"),
        type="expense",
        balance=Decimal("9650.00"),
        reference="REF001",
        raw_text="15/01/25 SWIGGY 350.00",
    )
    d = r.to_dict()
    assert d["date"] == "2025-01-15"
    assert d["amount"] == "350.00"
    assert d["type"] == "expense"
    assert d["balance"] == "9650.00"
    assert d["reference"] == "REF001"


# ── Registry detection ────────────────────────────────────────────────────────

def test_detect_parser_returns_none_for_non_hdfc_pdf() -> None:
    # A minimal valid but non-HDFC PDF (just bytes)
    fake_pdf = io.BytesIO(b"%PDF-1.4 fake content without HDFC marker")
    parser = detect_parser(fake_pdf)
    assert parser is None
