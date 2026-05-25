"""Unit tests for the generic bank statement parser.

Parser logic is tested directly (no PDF needed) using synthetic table data.
Covers the three table layouts validated against real statements so far:
  - Dual-column (separate withdrawal/deposit columns)
  - Single-column with Dr/Cr suffix (credit card style)
  - Headerless (no column name row; structure inferred from data)
"""

import io
from decimal import Decimal

from app.parsers.banks.generic import GenericTableParser, _parse_amount, _parse_amount_typed, _parse_date_to_iso
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


def test_parse_date_to_iso_dash_separator() -> None:
    assert _parse_date_to_iso("02-04-2026") == "2026-04-02"


def test_parse_date_to_iso_invalid() -> None:
    # Should return the input unchanged if format not recognised
    assert _parse_date_to_iso("not-a-date") == "not-a-date"


def test_parse_amount_cr_suffix() -> None:
    assert _parse_amount("1,721.10 Cr") == Decimal("1721.10")


def test_parse_amount_dr_suffix() -> None:
    assert _parse_amount("500.00 Dr") == Decimal("500.00")


def test_parse_amount_typed_dr() -> None:
    assert _parse_amount_typed("1,000.00 Dr") == (Decimal("1000.00"), "expense")


def test_parse_amount_typed_cr() -> None:
    assert _parse_amount_typed("1,503.00 Cr") == (Decimal("1503.00"), "income")


def test_parse_amount_typed_no_suffix_defaults_expense() -> None:
    assert _parse_amount_typed("500.00") == (Decimal("500.00"), "expense")


def test_parse_amount_typed_empty() -> None:
    assert _parse_amount_typed("") is None


# ── Table-parsing logic ───────────────────────────────────────────────────────

def _make_table(rows: list[list[str | None]]) -> list[list[str | None]]:
    """Return a well-formed table with a standard header row prepended."""
    header: list[str | None] = [
        "Date", "Narration", "Chq./Ref.No.", "Value Dt",
        "Withdrawal Amt.", "Deposit Amt.", "Closing Balance",
    ]
    return [header, *rows]


def test_parse_table_expense_row() -> None:
    parser = GenericTableParser()
    table = _make_table([
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
    parser = GenericTableParser()
    table = _make_table([
        ["10/01/25", "SALARY CREDIT", "SAL001", "10/01/25", "", "50,000.00", "60,000.00"],
    ])
    records = parser._parse_table(table)
    assert len(records) == 1
    r = records[0]
    assert r.type == "income"
    assert r.amount == Decimal("50000.00")


def test_parse_table_skips_non_date_rows() -> None:
    parser = GenericTableParser()
    table = _make_table([
        ["Opening Balance", "", "", "", "", "", "10,000.00"],
        ["15/01/25", "SWIGGY", "", "", "100.00", "", "9,900.00"],
    ])
    records = parser._parse_table(table)
    assert len(records) == 1


def test_parse_table_no_header_returns_empty() -> None:
    parser = GenericTableParser()
    table: list[list[str | None]] = [
        ["some row", "data"],
        ["other row", "data"],
    ]
    records = parser._parse_table(table)
    assert records == []


def test_parse_table_mixed_rows() -> None:
    parser = GenericTableParser()
    table = _make_table([
        ["01/01/25", "NETFLIX SUBSCRIPTION", "NF001", "01/01/25", "649.00", "", "9,351.00"],
        ["05/01/25", "UPI CASHBACK", "CB001", "05/01/25", "", "50.00", "9,401.00"],
        ["10/01/25", "AMAZON SHOPPING", "AM001", "10/01/25", "1,200.00", "", "8,201.00"],
    ])
    records = parser._parse_table(table)
    assert len(records) == 3
    assert records[0].type == "expense"
    assert records[1].type == "income"
    assert records[2].amount == Decimal("1200.00")


def test_parse_table_dash_date_and_cr_balance() -> None:
    """Verify parsing of statements that use DD-MM-YYYY dates and '1,234.56 Cr' balances."""
    parser = GenericTableParser()
    table: list[list[str | None]] = [
        ["SI", "Date", "Particulars", "Chq Num", "Withdrawal", "Deposit", "Balance"],
        ["1", "02-04-2026", "UPI/123/SWIGGY", "", "", "29.84", "1,721.10 Cr"],
        ["2", "03-04-2026", "UPI/456/ZOMATO", "", "150.00", "", "1,571.10 Cr"],
    ]
    records = parser._parse_table(table)
    assert len(records) == 2
    assert records[0].date == "2026-04-02"
    assert records[0].type == "income"
    assert records[0].balance == Decimal("1721.10")
    assert records[1].type == "expense"
    assert records[1].balance == Decimal("1571.10")


def test_parse_table_credit_card_single_amount_column() -> None:
    """Credit card style: single AMOUNT (Rs.) column with Dr/Cr suffix."""
    parser = GenericTableParser()
    table: list[list[str | None]] = [
        ["DATE", "TRANSACTION DETAILS", None, None, "MERCHANT CATEGORY", None, None, "AMOUNT (Rs.)", "CASHBACK EARNED"],
        ["22/03/2026", "HAIR SALON", None, None, "MISC STORE", None, None, "1,000.00 Dr", "19.00 Cr"],
        ["13/04/2026", "AMAZON PAY INDIA", None, None, "MISC STORE", None, None, "1,503.00 Cr", "8.00 Dr"],
        ["14/04/2026", "MAX RETAIL", None, None, "CLOTH STORES", None, None, "1,699.00 Dr", "10.00 Cr"],
    ]
    records = parser._parse_table(table)
    assert len(records) == 3
    assert records[0].type == "expense"
    assert records[0].amount == Decimal("1000.00")
    assert records[1].type == "income"
    assert records[1].amount == Decimal("1503.00")
    assert records[2].type == "expense"
    assert records[2].date == "2026-04-14"


def test_parse_table_debit_credit_column_names() -> None:
    """Verify the parser handles Debit/Credit column naming (e.g. ICICI style)."""
    parser = GenericTableParser()
    table: list[list[str | None]] = [
        ["Date", "Particulars", "Ref No", "Debit", "Credit", "Balance"],
        ["20/03/25", "ZOMATO UPI", "TXN001", "450.00", "", "5,550.00"],
        ["21/03/25", "INTEREST CREDIT", "INT001", "", "120.00", "5,670.00"],
    ]
    records = parser._parse_table(table)
    assert len(records) == 2
    assert records[0].type == "expense"
    assert records[1].type == "income"


# ── to_dict ───────────────────────────────────────────────────────────────────

def test_parse_table_headerless_debit_credit_columns() -> None:
    """Tables with no column name headers — structure inferred from data rows.

    Format: value_date | post_date | description | ref | debit | credit | balance
    Only 'Balance' (or nothing) in the header row.
    """
    parser = GenericTableParser()
    table: list[list[str | None]] = [
        ["", "", "", "", "", "", "Balance"],
        ["21/02/2026", "21/02/2026", "WDL TFR\nIMPS/123/BANKCODE", "REF001", "11,984.59", "-", "80,114.96"],
        ["25/02/2026", "25/02/2026", "CR NEFT\nSALARY CREDIT", "REF002", "-", "50,000.00", "1,30,114.96"],
        ["01/03/2026", "01/03/2026", "UPI/456/SWIGGY", "REF003", "350.00", "-", "1,29,764.96"],
    ]
    records = parser._parse_table(table)
    assert len(records) == 3
    assert records[0].type == "expense"
    assert records[0].amount == Decimal("11984.59")
    assert records[0].balance == Decimal("80114.96")
    assert records[1].type == "income"
    assert records[1].amount == Decimal("50000.00")
    assert records[2].type == "expense"
    assert records[2].date == "2026-03-01"


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

def test_detect_parser_returns_generic_for_any_pdf() -> None:
    # GenericTableParser is the catch-all — it always claims it can parse
    fake_pdf = io.BytesIO(b"%PDF-1.4 fake content")
    parser = detect_parser(fake_pdf)
    assert isinstance(parser, GenericTableParser)
