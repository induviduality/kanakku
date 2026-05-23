"""HDFC Bank statement PDF parser.

Handles the standard HDFC savings account statement format:
- Table columns: Date | Narration | Ref.No. | Value Dt | Withdrawal | Deposit | Balance
- Header: Statement from <DD/MM/YY> To <DD/MM/YY>
- Opening and closing balances in the statement summary
"""

import io
import re
from decimal import Decimal, InvalidOperation
from typing import Any

import pdfplumber

from app.parsers.base import BaseParser, ParsedRecord, StatementHeader

# Regex patterns for HDFC statement detection
_HDFC_MARKER = re.compile(r"HDFC\s*BANK", re.IGNORECASE)

# Column header patterns
_WITHDRAWAL_HEADER = re.compile(r"withdrawal\s*amt", re.IGNORECASE)
_DEPOSIT_HEADER = re.compile(r"deposit\s*amt", re.IGNORECASE)

# Date pattern: DD/MM/YY or DD/MM/YYYY
_DATE_PATTERN = re.compile(r"(\d{2}/\d{2}/\d{2,4})")

# Balance line: "Opening Balance" followed by amount
_OPENING_BAL = re.compile(r"opening\s+balance[^\d]*([\d,]+\.\d{2})", re.IGNORECASE)
_CLOSING_BAL = re.compile(r"closing\s+balance[^\d]*([\d,]+\.\d{2})", re.IGNORECASE)


def _parse_amount(raw: str) -> Decimal | None:
    """Parse a comma-separated Indian amount string to Decimal."""
    cleaned = raw.replace(",", "").strip()
    if not cleaned:
        return None
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def _parse_date_to_iso(date_str: str) -> str:
    """Convert DD/MM/YY or DD/MM/YYYY to YYYY-MM-DD."""
    parts = date_str.split("/")
    if len(parts) != 3:
        return date_str
    day, month, year = parts
    if len(year) == 2:
        year = "20" + year
    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"


class HDFCParser(BaseParser):
    """Parser for HDFC Bank account statements."""

    @classmethod
    def can_parse(cls, pdf: io.BytesIO) -> bool:
        """Return True if the PDF contains HDFC Bank markers."""
        pdf.seek(0)
        try:
            with pdfplumber.open(pdf) as doc:
                for page in doc.pages[:2]:
                    text = page.extract_text() or ""
                    if _HDFC_MARKER.search(text):
                        return True
        except Exception:
            pass
        return False

    def parse(self, pdf: io.BytesIO) -> list[ParsedRecord]:
        """Extract transactions from an HDFC statement PDF."""
        pdf.seek(0)
        records: list[ParsedRecord] = []

        with pdfplumber.open(pdf) as doc:
            for page in doc.pages:
                page_records = self._parse_page(page)
                records.extend(page_records)

        return records

    def extract_statement_header(self, pdf: io.BytesIO) -> StatementHeader:
        """Extract opening and closing balances from the statement."""
        pdf.seek(0)
        header = StatementHeader()

        with pdfplumber.open(pdf) as doc:
            for page in doc.pages:
                text = page.extract_text() or ""
                if header.opening_balance is None:
                    m = _OPENING_BAL.search(text)
                    if m:
                        header.opening_balance = _parse_amount(m.group(1))
                if header.closing_balance is None:
                    m = _CLOSING_BAL.search(text)
                    if m:
                        header.closing_balance = _parse_amount(m.group(1))
                if header.opening_balance and header.closing_balance:
                    break

        return header

    def _parse_page(self, page: Any) -> list[ParsedRecord]:
        """Extract transaction rows from a single page."""
        records: list[ParsedRecord] = []

        # Try table extraction first
        tables = page.extract_tables()
        for table in tables:
            if not table:
                continue
            parsed = self._parse_table(table)
            records.extend(parsed)

        # If no table rows, fall back to text extraction
        if not records:
            text = page.extract_text() or ""
            records.extend(self._parse_text_lines(text))

        return records

    def _parse_table(self, table: list[list[str | None]]) -> list[ParsedRecord]:
        """Parse a pdfplumber table (list of rows, each a list of cells)."""
        if not table or len(table) < 2:
            return []

        # Find header row to identify column indices
        header_row = None
        header_idx = 0
        for i, row in enumerate(table):
            row_text = " ".join(str(c or "") for c in row).lower()
            if "withdrawal" in row_text and "deposit" in row_text:
                header_row = row
                header_idx = i
                break

        if header_row is None:
            return []

        # Map column positions
        col_date = col_narr = col_ref = col_with = col_dep = col_bal = None
        for idx, cell in enumerate(header_row):
            cell_text = str(cell or "").lower()
            if "date" in cell_text and col_date is None:
                col_date = idx
            elif "narration" in cell_text or "description" in cell_text:
                col_narr = idx
            elif "chq" in cell_text or "ref" in cell_text:
                col_ref = idx
            elif "withdrawal" in cell_text:
                col_with = idx
            elif "deposit" in cell_text:
                col_dep = idx
            elif "balance" in cell_text:
                col_bal = idx

        if col_date is None or col_narr is None:
            return []

        records: list[ParsedRecord] = []
        for row in table[header_idx + 1:]:
            if not row or len(row) <= max(filter(None, [col_date, col_narr])):
                continue

            date_str = str(row[col_date] or "").strip()
            if not _DATE_PATTERN.match(date_str):
                continue

            narration = str(row[col_narr] or "").strip()
            if not narration:
                continue

            if col_ref is not None and col_ref < len(row):
                reference = str(row[col_ref] or "").strip() or None
            else:
                reference = None

            withdrawal = None
            deposit = None
            balance = None

            if col_with is not None and col_with < len(row):
                withdrawal = _parse_amount(str(row[col_with] or ""))
            if col_dep is not None and col_dep < len(row):
                deposit = _parse_amount(str(row[col_dep] or ""))
            if col_bal is not None and col_bal < len(row):
                balance = _parse_amount(str(row[col_bal] or ""))

            if withdrawal is None and deposit is None:
                continue

            amount = withdrawal if withdrawal else deposit
            txn_type = "expense" if withdrawal else "income"

            records.append(ParsedRecord(
                date=_parse_date_to_iso(date_str),
                description=narration,
                amount=amount,  # type: ignore[arg-type]
                type=txn_type,
                balance=balance,
                reference=reference or None,
                raw_text="|".join(str(c or "") for c in row),
            ))

        return records

    def _parse_text_lines(self, text: str) -> list[ParsedRecord]:
        """Fallback: parse raw text lines for transaction data."""
        records: list[ParsedRecord] = []
        lines = text.split("\n")

        # Simple pattern: date at start of line, followed by description and amounts
        txn_pattern = re.compile(
            r"^(\d{2}/\d{2}/\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})?\s+([\d,]+\.\d{2})?$"
        )

        for line in lines:
            m = txn_pattern.match(line.strip())
            if not m:
                continue
            date_str, narration, col1, col2, col3 = m.groups()
            narration = narration.strip()
            if not narration:
                continue

            # Heuristic: if two amounts present, first=withdrawal or deposit, second=balance
            withdrawal = _parse_amount(col1) if col1 else None
            deposit = _parse_amount(col2) if col2 else None
            balance = _parse_amount(col3) if col3 else None

            if withdrawal is None and deposit is None:
                continue

            amount = withdrawal if withdrawal else deposit
            txn_type = "expense" if withdrawal else "income"

            records.append(ParsedRecord(
                date=_parse_date_to_iso(date_str),
                description=narration,
                amount=amount,  # type: ignore[arg-type]
                type=txn_type,
                balance=balance,
                raw_text=line.strip(),
            ))

        return records
