"""Transaction deduplication using fuzzy description matching (rapidfuzz)."""

import datetime as dt
from decimal import Decimal

from rapidfuzz import fuzz

# Match window: ±3 days around the parsed transaction date
DATE_WINDOW_DAYS = 3
# Description similarity threshold (0-100) for fuzzy match
DESCRIPTION_SIMILARITY_THRESHOLD = 85


def find_duplicates(
    candidate: dict[str, object],
    existing: list[dict[str, object]],
) -> list[dict[str, object]]:
    """Return existing transactions that look like duplicates of the candidate.

    A duplicate is an existing transaction where:
    - The amount matches exactly, AND
    - The date is within DATE_WINDOW_DAYS, AND
    - The description similarity is >= DESCRIPTION_SIMILARITY_THRESHOLD
    """
    try:
        cand_date = _parse_date(str(candidate.get("date", "")))
    except ValueError:
        return []

    cand_amount = Decimal(str(candidate.get("amount", "0")))
    cand_desc = str(candidate.get("description", "")).lower().strip()

    matches: list[dict[str, object]] = []
    for txn in existing:
        txn_amount = Decimal(str(txn.get("amount", "0")))
        if txn_amount != cand_amount:
            continue

        txn_date_raw = txn.get("transacted_at")
        txn_date: dt.date
        if isinstance(txn_date_raw, str):
            try:
                txn_date = _parse_date(txn_date_raw)
            except ValueError:
                continue
        elif isinstance(txn_date_raw, dt.datetime):
            txn_date = txn_date_raw.date()
        elif isinstance(txn_date_raw, dt.date):
            txn_date = txn_date_raw
        else:
            continue

        if abs((cand_date - txn_date).days) > DATE_WINDOW_DAYS:
            continue

        txn_desc = str(txn.get("description", "")).lower().strip()
        score = fuzz.token_set_ratio(cand_desc, txn_desc)
        if score >= DESCRIPTION_SIMILARITY_THRESHOLD:
            matches.append(txn)

    return matches


def _parse_date(date_str: str) -> dt.date:
    """Parse a date string in common formats."""
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y"):
        try:
            return dt.datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: {date_str!r}")
