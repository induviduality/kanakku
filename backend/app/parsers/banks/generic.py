"""Generic bank statement PDF parser.

Handles tabular bank statements using flexible column-header matching and
data-driven structure inference. Three layouts are supported:

  Dual-column (savings/current account):
    Date | Narration/Particulars | Ref | Withdrawal/Debit | Deposit/Credit | Balance
    Tested: Axis Bank savings, Indian Bank savings

  Single-column with Dr/Cr suffix (credit card):
    Date | Transaction Details | Category | Amount (Rs.) | ...
    where each Amount cell ends with "Dr" (expense) or "Cr" (income).
    Tested: Axis Bank credit card

  Headerless (no column name row):
    Date | Value Date | Description | Ref | Debit | Credit | Balance
    Structure is inferred from the data rows themselves.
    Tested: ICICI Bank savings (balance-only header row)

Opening/closing balance extraction tries, in order:
  1. Text labels: "Opening Balance", "Closing Balance"
  2. Text labels: "Brought Forward", "Carried Forward"
  3. Fallback: inferred from the running Balance column in the transaction table

Registered last in the registry — catches any bank not handled by a specific parser.
New banks that don't fit these three layouts should get their own parser in banks/.
"""

import io
import re
from decimal import Decimal, InvalidOperation
from typing import Any

import pdfplumber

from app.parsers.base import BaseParser, ParsedRecord, StatementHeader

_DATE_PATTERN = re.compile(r"^\d{2}[/\-]\d{2}[/\-]\d{2,4}$")

_DATE_KEYWORDS = {"date"}
_DESC_KEYWORDS = {"narration", "description", "particulars", "details", "remarks", "transaction"}
_DEBIT_KEYWORDS = {"debit", "withdrawal", "dr"}
_CREDIT_KEYWORDS = {"credit", "deposit", "cr"}
_AMOUNT_KEYWORDS = {"amount"}
_BALANCE_KEYWORDS = {"balance"}
_REF_KEYWORDS = {"ref", "chq", "utr", "reference", "cheque"}

_OPENING_BAL = re.compile(r"opening\s+balance[^\d]*([\d,]+\.\d{2})", re.IGNORECASE)
_CLOSING_BAL = re.compile(r"closing\s+balance[^\d]*([\d,]+\.\d{2})", re.IGNORECASE)
_BROUGHT_FWD = re.compile(r"brought\s+forward[^\d]*([\d,]+\.\d{2})", re.IGNORECASE)
_CARRIED_FWD = re.compile(r"carried\s+forward[^\d]*([\d,]+\.\d{2})", re.IGNORECASE)


def _parse_amount(raw: str) -> Decimal | None:
    """Parse a comma-separated Indian amount string to Decimal.

    Handles trailing Cr/Dr indicators (e.g. '1,721.10 Cr').
    """
    cleaned = re.sub(r"\s*(Cr|Dr)\s*$", "", raw, flags=re.IGNORECASE)
    cleaned = cleaned.replace(",", "").strip()
    if not cleaned:
        return None
    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def _parse_amount_typed(raw: str) -> tuple[Decimal, str] | None:
    """Parse a Dr/Cr-suffixed amount cell. Returns (amount, 'expense'|'income') or None.

    Used for single-column credit card statements where direction is in the suffix.
    Defaults to 'expense' when no suffix is present.
    """
    is_credit = bool(re.search(r"Cr\s*$", raw, re.IGNORECASE))
    amount = _parse_amount(raw)
    if amount is None:
        return None
    return amount, "income" if is_credit else "expense"


def _parse_date_to_iso(date_str: str) -> str:
    """Convert DD/MM/YY, DD/MM/YYYY, DD-MM-YY, or DD-MM-YYYY to YYYY-MM-DD."""
    if not _DATE_PATTERN.match(date_str):
        return date_str
    sep = "/" if "/" in date_str else "-"
    day, month, year = date_str.split(sep)
    if len(year) == 2:
        year = "20" + year
    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"


def _col_matches(cell_text: str, keywords: set[str]) -> bool:
    t = cell_text.lower()
    return any(kw in t for kw in keywords)


class GenericTableParser(BaseParser):
    """Catch-all parser for any tabular bank statement."""

    @classmethod
    def can_parse(cls, pdf: io.BytesIO) -> bool:
        """Always returns True — this is the catch-all fallback."""
        return True

    def parse(self, pdf: io.BytesIO) -> list[ParsedRecord]:
        pdf.seek(0)
        records: list[ParsedRecord] = []
        with pdfplumber.open(pdf) as doc:
            for page in doc.pages:
                records.extend(self._parse_page(page))
        return records

    def extract_statement_header(self, pdf: io.BytesIO) -> StatementHeader:
        pdf.seek(0)
        header = StatementHeader()

        with pdfplumber.open(pdf) as doc:
            # Strategy 1: summary table with column headers and values in the next row.
            # Handles formats like: | Brought Forward (₹) | ... | Closing Balance (₹) |
            #                        | 1,234.56            | ... | 5,678.90            |
            # This runs FIRST because text-regex (Strategy 2) misreads this layout —
            # when "Closing Balance" is a column header, [^\d]* skips (₹) and grabs the
            # first number in text-flow order, which is the opening balance value.
            for page in doc.pages:
                for table in page.extract_tables() or []:
                    if not table or len(table) < 2:
                        continue
                    for row_idx, row in enumerate(table[:-1]):
                        cells = [str(c or "").lower() for c in row]
                        open_col = next(
                            (i for i, c in enumerate(cells)
                             if "brought forward" in c or "opening balance" in c),
                            None,
                        )
                        close_col = next(
                            (i for i, c in enumerate(cells)
                             if "closing balance" in c or "carried forward" in c),
                            None,
                        )
                        if open_col is None and close_col is None:
                            continue
                        value_row = table[row_idx + 1]
                        if open_col is not None and open_col < len(value_row):
                            v = _parse_amount(str(value_row[open_col] or ""))
                            if v is not None and header.opening_balance is None:
                                header.opening_balance = v
                        if close_col is not None and close_col < len(value_row):
                            v = _parse_amount(str(value_row[close_col] or ""))
                            if v is not None and header.closing_balance is None:
                                header.closing_balance = v

            # Strategy 2: scan full text for inline balance labels ("Opening Balance: 1,234.56")
            if header.opening_balance is None or header.closing_balance is None:
                full_text = "\n".join(page.extract_text() or "" for page in doc.pages)
                for open_pat, close_pat in [
                    (_OPENING_BAL, _CLOSING_BAL),
                    (_BROUGHT_FWD, _CARRIED_FWD),
                ]:
                    if header.opening_balance is None:
                        m = open_pat.search(full_text)
                        if m:
                            header.opening_balance = _parse_amount(m.group(1))
                    if header.closing_balance is None:
                        m = close_pat.search(full_text)
                        if m:
                            header.closing_balance = _parse_amount(m.group(1))
                    if header.opening_balance and header.closing_balance:
                        break

            # Strategy 3: infer from the running balance column in transaction tables.
            # Last resort — used when no explicit balance labels exist anywhere in the PDF.
            if header.opening_balance is None or header.closing_balance is None:
                all_records: list[ParsedRecord] = []
                for page in doc.pages:
                    for table in page.extract_tables() or []:
                        if table:
                            all_records.extend(self._parse_table(table))

                with_balance = [r for r in all_records if r.balance is not None]
                if with_balance:
                    first, last = with_balance[0], with_balance[-1]
                    if header.closing_balance is None:
                        header.closing_balance = last.balance
                    if header.opening_balance is None and first.balance is not None:
                        # Reverse the first transaction to recover the pre-period balance
                        if first.type == "expense":
                            header.opening_balance = first.balance + first.amount
                        else:
                            header.opening_balance = first.balance - first.amount

        return header

    def _parse_page(self, page: Any) -> list[ParsedRecord]:
        records: list[ParsedRecord] = []
        for table in page.extract_tables():
            if table:
                records.extend(self._parse_table(table))
        return records

    def _parse_table(self, table: list[list[str | None]]) -> list[ParsedRecord]:
        if not table or len(table) < 2:
            return []

        # Find the header row: date keyword and amount keyword must appear in separate cells.
        # This avoids false-matching summary blobs where one merged cell contains all keywords.
        header_row = None
        header_idx = 0
        for i, row in enumerate(table):
            cells = [str(c or "") for c in row]
            date_col_candidate = next(
                (idx for idx, c in enumerate(cells) if _col_matches(c, _DATE_KEYWORDS)), None
            )
            amount_col_candidate = next(
                (
                    idx for idx, c in enumerate(cells)
                    if idx != date_col_candidate
                    and _col_matches(c, _DEBIT_KEYWORDS | _CREDIT_KEYWORDS | _AMOUNT_KEYWORDS)
                ),
                None,
            )
            if date_col_candidate is not None and amount_col_candidate is not None:
                header_row = row
                header_idx = i
                break

        if header_row is None:
            return self._parse_headerless_table(table)

        # Map column indices from header
        col_date = col_desc = col_debit = col_credit = col_amount = col_balance = col_ref = None
        for idx, cell in enumerate(header_row):
            t = str(cell or "")
            if col_date is None and _col_matches(t, _DATE_KEYWORDS):
                col_date = idx
            elif col_desc is None and _col_matches(t, _DESC_KEYWORDS):
                col_desc = idx
            elif col_debit is None and _col_matches(t, _DEBIT_KEYWORDS):
                col_debit = idx
            elif col_credit is None and _col_matches(t, _CREDIT_KEYWORDS):
                col_credit = idx
            elif col_balance is None and _col_matches(t, _BALANCE_KEYWORDS):
                col_balance = idx
            elif col_ref is None and _col_matches(t, _REF_KEYWORDS):
                col_ref = idx
            elif col_amount is None and _col_matches(t, _AMOUNT_KEYWORDS):
                col_amount = idx

        if col_date is None or col_desc is None:
            return []

        # Dual-column mode: separate withdrawal/deposit columns (savings/current account)
        # Single-column mode: one amount column with Dr/Cr suffix (credit card)
        dual_col = col_debit is not None or col_credit is not None

        def _cell(row: list[str | None], idx: int | None) -> str:
            if idx is None or idx >= len(row):
                return ""
            return str(row[idx] or "").strip()

        records: list[ParsedRecord] = []
        for row in table[header_idx + 1:]:
            if not row:
                continue

            date_str = _cell(row, col_date)
            if not _DATE_PATTERN.match(date_str):
                continue

            desc = _cell(row, col_desc)
            if not desc:
                continue

            balance = _parse_amount(_cell(row, col_balance))
            reference = _cell(row, col_ref) or None

            if dual_col:
                debit = _parse_amount(_cell(row, col_debit))
                credit = _parse_amount(_cell(row, col_credit))
                if debit is None and credit is None:
                    continue
                amount: Decimal = debit if debit else credit  # type: ignore[assignment]
                txn_type = "expense" if debit else "income"
            else:
                parsed = _parse_amount_typed(_cell(row, col_amount))
                if parsed is None:
                    continue
                amount, txn_type = parsed

            records.append(ParsedRecord(
                date=_parse_date_to_iso(date_str),
                description=desc,
                amount=amount,
                type=txn_type,
                balance=balance,
                reference=reference,
                raw_text="|".join(str(c or "") for c in row),
            ))

        return records

    def _parse_headerless_table(self, table: list[list[str | None]]) -> list[ParsedRecord]:
        """Fallback for tables with no recognisable column headers.

        Infers structure from the data rows themselves:
        - Date:    column 0 (assumed — tables without headers consistently put it first)
        - Desc:    column with the highest average text length
        - Amounts: all other numeric columns except the last
        - Balance: last numeric column
        - Type:    first amount col = debit (expense), second = credit (income)
                   This matches the standard Indian bank layout (Debit | Credit | Balance).
        """
        date_rows = [
            r for r in table
            if r and _DATE_PATTERN.match(str(r[0] or "").strip())
        ]
        if not date_rows:
            return []

        ncols = max(len(r) for r in date_rows)
        if ncols < 3:
            return []

        col_date = 0

        def avg_len(col_idx: int) -> float:
            return sum(len(str(r[col_idx] if col_idx < len(r) else "")) for r in date_rows) / len(date_rows)

        col_desc = max(range(1, ncols), key=avg_len)

        # Numeric columns: appear in at least one date row, excluding date and desc cols
        numeric_cols = sorted({
            i
            for r in date_rows
            for i in range(ncols)
            if i not in (col_date, col_desc)
            and _parse_amount(str(r[i] if i < len(r) else "")) is not None
        })

        if not numeric_cols:
            return []

        col_balance = numeric_cols[-1]
        amount_cols = numeric_cols[:-1]

        if not amount_cols:
            return []

        # Standard layout: first amount col = debit (expense), second = credit (income)
        col_debit = amount_cols[0]
        col_credit = amount_cols[1] if len(amount_cols) >= 2 else None

        records: list[ParsedRecord] = []
        for row in date_rows:
            def cell(idx: int) -> str:
                if idx >= len(row):
                    return ""
                return str(row[idx] or "").strip()

            date_str = cell(col_date)
            if not _DATE_PATTERN.match(date_str):
                continue

            desc = cell(col_desc)
            if not desc:
                continue

            balance = _parse_amount(cell(col_balance))
            debit_val = _parse_amount(cell(col_debit))
            credit_val = _parse_amount(cell(col_credit)) if col_credit is not None else None

            if debit_val is not None:
                amount: Decimal = debit_val
                txn_type = "expense"
            elif credit_val is not None:
                amount = credit_val
                txn_type = "income"
            else:
                continue

            records.append(ParsedRecord(
                date=_parse_date_to_iso(date_str),
                description=desc,
                amount=amount,
                type=txn_type,
                balance=balance,
                raw_text="|".join(str(c or "") for c in row),
            ))

        return records
