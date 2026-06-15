"""Transaction deduplication: exact date + exact amount match within the same account.

Account-level isolation is enforced upstream (the worker pre-filters `existing` to
the batch's account), so this function does not re-check account_id.
"""

import datetime as dt
from decimal import Decimal


def find_duplicates(
    candidate: dict[str, object],
    existing: list[dict[str, object]],
) -> list[dict[str, object]]:
    """Return existing transactions that are duplicates of the candidate.

    A duplicate is an existing transaction where:
    - The amount matches exactly, AND
    - The date matches exactly (same calendar day)

    No description similarity is required — same date + same amount in the same
    account is sufficient signal to flag for user review.
    """
    try:
        cand_date = _parse_date(str(candidate.get("date", "")))
    except ValueError:
        return []

    cand_amount = Decimal(str(candidate.get("amount", "0")))

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

        if cand_date != txn_date:
            continue

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
