"""GPay Takeout enrichment: parse takeout JSON, match to bank transactions."""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gpay_match import GPayMatch, GPayMatchStatus
from app.models.transaction import Transaction, TransactionType


@dataclass
class GPayRecord:
    """A single record from Google Takeout GPay transaction history."""
    date: date
    amount: Decimal
    merchant: str
    currency: str = "INR"
    raw: dict[str, object] = field(default_factory=dict)


@dataclass
class MatchResult:
    gpay_record: GPayRecord
    status: GPayMatchStatus
    matched_transaction_id: uuid.UUID | None = None
    candidate_transaction_ids: list[uuid.UUID] = field(default_factory=list)
    llm_suggestion_id: uuid.UUID | None = None


# ── Parsing ───────────────────────────────────────────────────────────────────

def parse_takeout(data: str | bytes | dict[str, object] | list[object]) -> list[GPayRecord]:
    """Parse Google Takeout GPay export.

    Accepts JSON string/bytes, a pre-parsed dict, or a list of records.
    Returns a list of GPayRecord objects.
    """
    if isinstance(data, (str, bytes)):
        raw = json.loads(data)
    else:
        raw = data

    records: list[GPayRecord] = []
    # Handle both {"transactions": [...]} wrapper and bare list
    items: list[dict[str, object]]
    if isinstance(raw, dict):
        items = raw.get("transactions") or raw.get("Transaction") or [raw]
    else:
        items = list(raw)

    for item in items:
        rec = _parse_record(item)
        if rec is not None:
            records.append(rec)
    return records


def _parse_record(item: dict[str, object]) -> GPayRecord | None:
    try:
        # Various Takeout field names seen in the wild
        date_str = (
            item.get("Date") or item.get("date") or item.get("transactionDate", "")
        )
        amount_raw = (
            item.get("Amount") or item.get("amount") or item.get("transactionAmount", "0")
        )
        merchant = (
            item.get("Description") or item.get("description")
            or item.get("merchant") or item.get("Merchant", "")
        )
        currency = item.get("Currency") or item.get("currency") or "INR"

        # Strip currency symbols and commas, preserve sign
        amount_str = str(amount_raw).replace(",", "").strip()
        # Remove leading currency symbols (but not sign characters)
        amount_str = amount_str.lstrip("₹$€£ ")

        txn_date = _parse_date(str(date_str))
        if txn_date is None:
            return None
        amount = Decimal(amount_str)
        if amount <= 0:
            return None

        return GPayRecord(
            date=txn_date,
            amount=amount,
            merchant=str(merchant),
            currency=str(currency),
            raw=item,
        )
    except Exception:
        return None


def _parse_date(value: str) -> date | None:
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%b %d, %Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


# ── Matching ──────────────────────────────────────────────────────────────────

_DATE_WINDOW = timedelta(days=1)
_AMOUNT_TOLERANCE = Decimal("0.01")


async def match_records(
    session: AsyncSession,
    gpay_records: list[GPayRecord],
    user_id: uuid.UUID,
) -> list[MatchResult]:
    """Match each GPay record to existing bank transactions.

    Returns a MatchResult per GPay record:
    - exact match (1 candidate) → auto_linked, candidate ID stored
    - ambiguous (2+ candidates) → pending, all candidates stored
    - no match → orphan
    """
    results: list[MatchResult] = []
    for rec in gpay_records:
        candidates = await _find_candidates(session, rec, user_id)
        if len(candidates) == 1:
            status = GPayMatchStatus.auto_linked
            matched_id = candidates[0]
            cand_ids = candidates
        elif len(candidates) > 1:
            status = GPayMatchStatus.pending
            matched_id = None
            cand_ids = candidates
        else:
            status = GPayMatchStatus.orphan
            matched_id = None
            cand_ids = []

        results.append(
            MatchResult(
                gpay_record=rec,
                status=status,
                matched_transaction_id=matched_id,
                candidate_transaction_ids=cand_ids,
            )
        )
    return results


async def _find_candidates(
    session: AsyncSession,
    rec: GPayRecord,
    user_id: uuid.UUID,
) -> list[uuid.UUID]:
    window_start = datetime(rec.date.year, rec.date.month, rec.date.day, tzinfo=UTC) - _DATE_WINDOW
    window_end = datetime(rec.date.year, rec.date.month, rec.date.day, tzinfo=UTC) + _DATE_WINDOW + timedelta(days=1)

    result = await session.execute(
        select(Transaction.id, Transaction.amount).where(
            and_(
                Transaction.user_id == user_id,
                Transaction.deleted_at.is_(None),
                Transaction.type.in_([TransactionType.expense, TransactionType.income]),
                Transaction.transacted_at >= window_start,
                Transaction.transacted_at < window_end,
            )
        )
    )
    return [
        row.id
        for row in result.all()
        if abs(row.amount - rec.amount) <= _AMOUNT_TOLERANCE
    ]


# ── Persistence ───────────────────────────────────────────────────────────────

async def persist_results(
    session: AsyncSession,
    results: list[MatchResult],
    user_id: uuid.UUID,
) -> list[GPayMatch]:
    """Save MatchResults as GPayMatch rows and enrich auto-linked transactions."""
    matches: list[GPayMatch] = []
    for r in results:
        gm = GPayMatch(
            user_id=user_id,
            gpay_data=r.gpay_record.raw if r.gpay_record.raw else {
                "date": str(r.gpay_record.date),
                "amount": str(r.gpay_record.amount),
                "merchant": r.gpay_record.merchant,
            },
            candidate_transaction_ids=r.candidate_transaction_ids,
            chosen_transaction_id=r.matched_transaction_id,
            llm_suggestion_id=r.llm_suggestion_id,
            status=r.status,
        )
        session.add(gm)
        matches.append(gm)

        # Enrich auto-linked transaction with merchant name
        if r.status == GPayMatchStatus.auto_linked and r.matched_transaction_id:
            txn_result = await session.execute(
                select(Transaction).where(Transaction.id == r.matched_transaction_id)
            )
            txn = txn_result.scalar_one_or_none()
            if txn is not None and not txn.notes:
                txn.notes = f"GPay merchant: {r.gpay_record.merchant}"

    await session.commit()
    return matches
