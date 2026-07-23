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


async def compute_amounts(
    session: AsyncSession,
    piggy_bank_ids: list[uuid.UUID],
) -> dict[uuid.UUID, Decimal]:
    """Sum contributions for each piggy_bank_id, batched to avoid N+1 queries."""
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

    totals = {r.piggy_bank_id: r.total or Decimal("0.00") for r in rows}
    return {pid: totals.get(pid, Decimal("0.00")) for pid in piggy_bank_ids}


async def compute_amount(session: AsyncSession, piggy_bank_id: uuid.UUID) -> Decimal:
    result = await compute_amounts(session, [piggy_bank_id])
    return result.get(piggy_bank_id, Decimal("0.00"))
