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
    """Delete rows that have been soft-deleted for more than 30 days."""
    cutoff = datetime.now(UTC) - _WINDOW
    totals: dict[str, int] = {}

    async with async_session_factory() as session:
        for model in _PURGEABLE_MODELS:
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


class WorkerSettings:
    """ARQ worker settings — includes daily purge cron job."""

    functions = [purge_soft_deleted]
    cron_jobs = [
        cron(purge_soft_deleted, hour=3, minute=0),  # runs at 03:00 UTC daily
    ]
