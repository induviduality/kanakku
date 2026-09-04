"""Piggy bank progress, computed from contributions — not cached.

PiggyBank.current_amount (the stored column) is frozen/deprecated as of this
module's introduction: no code path writes to it anymore, so it no longer
reflects live state. It is kept in the database only until a follow-up
migration drops it.

Computing on read instead of maintaining an imperative running total removes
the bug class described in account_balance.py: _sync_piggy_bank (run on
every transaction create/edit that carries a piggy_bank_id) deletes and
re-inserts PiggyBankContribution rows without ever touching current_amount,
so linking a savings goal from the transaction form never moved the stored
total. Soft-deleting or editing the amount of a linked transaction had the
same problem. Summing live from PiggyBankContribution joined to
non-deleted Transaction rows removes all of these drift paths at once.
"""
import uuid
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.piggy_bank import PiggyBankContribution
from app.models.transaction import Transaction
from app.services.earmark_balance import sum_by_piggy_bank


async def compute_breakdowns(
    session: AsyncSession,
    piggy_bank_ids: list[uuid.UUID],
) -> dict[uuid.UUID, dict[str, Decimal]]:
    """Compute contributions and earmarks for each piggy_bank_id."""
    if not piggy_bank_ids:
        return {}

    rows = (
        await session.execute(
            sa.select(
                PiggyBankContribution.piggy_bank_id,
                sa.func.sum(PiggyBankContribution.amount).label("total"),
            )
            .join(Transaction, Transaction.id == PiggyBankContribution.transaction_id)
            .where(
                PiggyBankContribution.piggy_bank_id.in_(piggy_bank_ids),
                Transaction.deleted_at.is_(None),
            )
            .group_by(PiggyBankContribution.piggy_bank_id)
        )
    ).all()

    txn_totals = {r.piggy_bank_id: r.total or Decimal("0.00") for r in rows}
    earmark_totals = await sum_by_piggy_bank(session, piggy_bank_ids)

    return {
        pid: {
            "from_transactions": txn_totals.get(pid, Decimal("0.00")),
            "from_earmarks": earmark_totals.get(pid, Decimal("0.00")),
            "total": txn_totals.get(pid, Decimal("0.00")) + earmark_totals.get(pid, Decimal("0.00")),
        }
        for pid in piggy_bank_ids
    }


async def compute_amounts(
    session: AsyncSession,
    piggy_bank_ids: list[uuid.UUID],
) -> dict[uuid.UUID, Decimal]:
    """Sum contributions and earmarks for each piggy_bank_id, batched to avoid N+1 queries."""
    breakdowns = await compute_breakdowns(session, piggy_bank_ids)
    return {pid: b["total"] for pid, b in breakdowns.items()}


async def compute_amount(session: AsyncSession, piggy_bank_id: uuid.UUID) -> Decimal:
    result = await compute_amounts(session, [piggy_bank_id])
    return result.get(piggy_bank_id, Decimal("0.00"))


async def compute_breakdown(session: AsyncSession, piggy_bank_id: uuid.UUID) -> dict[str, Decimal]:
    result = await compute_breakdowns(session, [piggy_bank_id])
    return result.get(
        piggy_bank_id,
        {
            "from_transactions": Decimal("0.00"),
            "from_earmarks": Decimal("0.00"),
            "total": Decimal("0.00"),
        },
    )
