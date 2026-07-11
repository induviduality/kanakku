"""Account balance, computed from the transaction ledger — not cached.

Account.current_balance (the stored column) is frozen/deprecated as of this
module's introduction: it is no longer written to by transaction create/
edit/delete/restore or import confirmation, so it reflects a snapshot from
whenever it was last touched rather than live state. It is kept in the
database only so a stored (legacy) value can be compared against
compute_balance()'s output during the transition; nothing should read it for
a live balance display. A follow-up migration will drop the column once that
comparison is done.

Computing on read instead of maintaining an imperative running total removes
an entire class of bug: there is no separate value that any code path can
forget to update (this file replaces a real bug of exactly that shape, found
2026-07-11, where the import-confirmation flow inserted Transaction rows
without ever touching the old cached column). At this app's transaction
volume (a personal, single-user tracker — even a heavy month is a few
hundred rows), a SUM over an indexed (account_id, deleted_at) column costs
low single-digit milliseconds; there is no real performance tradeoff here.
"""
import uuid
from decimal import Decimal

import sqlalchemy as sa
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.transaction import Transaction, TransactionType


async def get_account_or_404(
    account_id: uuid.UUID, user_id: uuid.UUID, session: AsyncSession
) -> Account:
    result = await session.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == user_id,
            Account.deleted_at.is_(None),
        )
    )
    acc = result.scalar_one_or_none()
    if acc is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return acc


async def compute_balances(
    session: AsyncSession,
    account_ids: list[uuid.UUID],
    user_id: uuid.UUID,
    as_of: object | None = None,
) -> dict[uuid.UUID, Decimal]:
    """Sum the ledger for each account_id, batched to avoid N+1 queries.

    as_of, if given, bounds the sum to transactions dated strictly before it
    (a datetime) — used to reconstruct a historical/period-end balance
    without needing to roll back from a live cached value.

    opening_balance-type transactions ARE included (they're a permanent,
    one-time seed of the ledger, unlike a date-scoped income/expense) —
    unlike dashboard.py's report-facing aggregates, which exclude
    opening_balance from period *flow* totals; this is a point-in-time
    balance, not a flow, so it belongs here.
    """
    if not account_ids:
        return {}

    def _bound(stmt):
        return stmt.where(Transaction.transacted_at < as_of) if as_of is not None else stmt

    ie_rows = (
        await session.execute(
            _bound(
                sa.select(
                    Transaction.account_id,
                    sa.func.sum(sa.case(
                        (Transaction.type.in_([TransactionType.income, TransactionType.opening_balance]), Transaction.amount),
                        else_=-Transaction.amount,
                    )).label("net"),
                )
                .where(
                    Transaction.user_id == user_id,
                    Transaction.deleted_at.is_(None),
                    Transaction.type.in_([TransactionType.income, TransactionType.expense, TransactionType.opening_balance]),
                    Transaction.account_id.in_(account_ids),
                )
            )
            .group_by(Transaction.account_id)
        )
    ).all()

    xfer_out_rows = (
        await session.execute(
            _bound(
                sa.select(
                    Transaction.account_id,
                    sa.func.sum(Transaction.amount).label("out"),
                )
                .where(
                    Transaction.user_id == user_id,
                    Transaction.deleted_at.is_(None),
                    Transaction.type == TransactionType.transfer,
                    Transaction.account_id.in_(account_ids),
                )
            )
            .group_by(Transaction.account_id)
        )
    ).all()

    xfer_in_rows = (
        await session.execute(
            _bound(
                sa.select(
                    Transaction.to_account_id,
                    # to_amount is only set for cross-currency transfers; a
                    # same-currency transfer (the common case) leaves it NULL
                    # and credits `amount` instead.
                    sa.func.sum(sa.func.coalesce(Transaction.to_amount, Transaction.amount)).label("into"),
                )
                .where(
                    Transaction.user_id == user_id,
                    Transaction.deleted_at.is_(None),
                    Transaction.type == TransactionType.transfer,
                    Transaction.to_account_id.in_(account_ids),
                )
            )
            .group_by(Transaction.to_account_id)
        )
    ).all()

    ie_map  = {r.account_id: r.net or Decimal("0.00") for r in ie_rows}
    out_map = {r.account_id: r.out or Decimal("0.00") for r in xfer_out_rows}
    in_map  = {r.to_account_id: r.into or Decimal("0.00") for r in xfer_in_rows}

    return {
        acc_id: ie_map.get(acc_id, Decimal("0.00")) - out_map.get(acc_id, Decimal("0.00")) + in_map.get(acc_id, Decimal("0.00"))
        for acc_id in account_ids
    }


async def compute_balance(
    session: AsyncSession,
    account_id: uuid.UUID,
    user_id: uuid.UUID,
    as_of: object | None = None,
) -> Decimal:
    result = await compute_balances(session, [account_id], user_id, as_of)
    return result.get(account_id, Decimal("0.00"))
