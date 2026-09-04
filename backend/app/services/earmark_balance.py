"""Earmark balances and summaries, computed from ledger and earmarks on read."""
import uuid
from decimal import Decimal

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.earmark import Earmark


async def sum_all(session: AsyncSession, user_id: uuid.UUID) -> Decimal:
    """Sum of all active, non-deleted earmarks for the user."""
    result = await session.execute(
        sa.select(sa.func.coalesce(sa.func.sum(Earmark.amount), Decimal("0"))).where(
            Earmark.user_id == user_id,
            Earmark.deleted_at.is_(None),
            Earmark.is_active.is_(True),
        )
    )
    return result.scalar_one() or Decimal("0")


async def sum_by_piggy_bank(
    session: AsyncSession, piggy_bank_ids: list[uuid.UUID]
) -> dict[uuid.UUID, Decimal]:
    """Sum of active, non-deleted earmarks linked to each piggy bank."""
    if not piggy_bank_ids:
        return {}

    rows = (
        await session.execute(
            sa.select(
                Earmark.piggy_bank_id,
                sa.func.sum(Earmark.amount).label("total"),
            )
            .where(
                Earmark.piggy_bank_id.in_(piggy_bank_ids),
                Earmark.deleted_at.is_(None),
                Earmark.is_active.is_(True),
            )
            .group_by(Earmark.piggy_bank_id)
        )
    ).all()

    totals = {r.piggy_bank_id: r.total or Decimal("0.00") for r in rows}
    return {pid: totals.get(pid, Decimal("0.00")) for pid in piggy_bank_ids}


async def earmark_names_by_account(
    session: AsyncSession, account_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[str]]:
    """For each account, return the names of earmarks tagged to it.
    Purely informational — no sums or overcommit logic.
    """
    if not account_ids:
        return {}

    rows = (
        await session.execute(
            sa.select(Earmark.account_id, Earmark.name)
            .where(
                Earmark.account_id.in_(account_ids),
                Earmark.deleted_at.is_(None),
                Earmark.is_active.is_(True),
            )
            .order_by(Earmark.name)
        )
    ).all()

    result: dict[uuid.UUID, list[str]] = {aid: [] for aid in account_ids}
    for acc_id, name in rows:
        if acc_id is not None and acc_id in result:
            result[acc_id].append(name)
    return result
