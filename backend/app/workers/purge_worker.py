"""ARQ worker: daily soft-delete purge — permanently deletes rows where deleted_at < now() - 30 days."""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

import sqlalchemy as sa
from arq import cron

from app.db.session import async_session_factory
from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.payee import Payee
from app.models.piggy_bank import PiggyBank
from app.models.subscription import Subscription
from app.models.tag import Tag
from app.models.transaction import Transaction

logger = logging.getLogger(__name__)

_WINDOW = timedelta(days=30)

_PURGEABLE_MODELS = [
    Transaction,
    Budget,
    Subscription,
    PiggyBank,
    Account,
    Category,
    Tag,
    Payee,
]


async def purge_soft_deleted(ctx: dict) -> dict[str, int]:
    """Delete rows that have been soft-deleted for more than 30 days.

    Transactions are purged first so the Account / Category cascades have no
    live children. Accounts that are still referenced by a non-deleted
    transaction are skipped (the ondelete=RESTRICT FK would otherwise crash
    the whole purge transaction).
    """
    cutoff = datetime.now(UTC) - _WINDOW
    totals: dict[str, int] = {}

    async with async_session_factory() as session:
        for model in _PURGEABLE_MODELS:
            if model is Account:
                count = await _purge_accounts_safely(session, cutoff)
            else:
                result = await session.execute(
                    sa.delete(model).where(
                        model.deleted_at.isnot(None),  # type: ignore[attr-defined]
                        model.deleted_at < cutoff,  # type: ignore[attr-defined]
                    )
                )
                count = result.rowcount
            totals[model.__tablename__] = count  # type: ignore[attr-defined]
            if count:
                logger.info("Purged %d row(s) from %s", count, model.__tablename__)  # type: ignore[attr-defined]

        await session.commit()

    return totals


async def _purge_accounts_safely(session, cutoff: datetime) -> int:
    """Delete soft-deleted accounts only if they have no remaining transactions.

    Transactions referencing the account with ondelete=RESTRICT would otherwise
    raise IntegrityError on the bulk DELETE. After this purge worker has already
    deleted soft-deleted transactions earlier in the loop, any account that
    still has rows referencing it must have live (non-deleted) transactions —
    don't purge those accounts; log and continue.
    """
    candidates = (
        await session.execute(
            sa.select(Account.id).where(
                Account.deleted_at.isnot(None),
                Account.deleted_at < cutoff,
            )
        )
    ).scalars().all()

    if not candidates:
        return 0

    deleted = 0
    for acc_id in candidates:
        from app.models.transaction import Transaction

        still_referenced = (
            await session.execute(
                sa.select(sa.func.count(Transaction.id)).where(
                    sa.or_(
                        Transaction.account_id == acc_id,
                        Transaction.to_account_id == acc_id,
                    )
                )
            )
        ).scalar_one()
        if still_referenced:
            logger.warning(
                "Skipping purge of account %s — still referenced by %d transaction(s).",
                acc_id, still_referenced,
            )
            continue
        await session.execute(sa.delete(Account).where(Account.id == acc_id))
        deleted += 1
    return deleted


class WorkerSettings:
    """ARQ worker settings — includes daily purge cron job."""

    functions = [purge_soft_deleted]
    cron_jobs = [
        cron(purge_soft_deleted, hour=3, minute=0),  # runs at 03:00 UTC daily
    ]
