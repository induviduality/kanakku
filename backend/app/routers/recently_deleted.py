"""GET /recently-deleted — returns soft-deleted items within the 30-day recovery window."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.payee import Payee
from app.models.piggy_bank import PiggyBank
from app.models.subscription import Subscription
from app.models.tag import Tag
from app.models.transaction import Transaction
from app.models.user import User

router = APIRouter(prefix="/recently-deleted", tags=["recently-deleted"])

_WINDOW = timedelta(days=30)


class DeletedItem(BaseModel):
    id: uuid.UUID
    entity_type: str
    label: str
    deleted_at: datetime


class RecentlyDeletedResponse(BaseModel):
    items: list[DeletedItem]


async def _query_deleted(session: AsyncSession, model: type, user_id: uuid.UUID, label_fn: object) -> list[DeletedItem]:
    cutoff = datetime.now(UTC) - _WINDOW
    stmt = select(model).where(
        model.user_id == user_id,  # type: ignore[attr-defined]
        model.deleted_at.isnot(None),  # type: ignore[attr-defined]
        model.deleted_at > cutoff,  # type: ignore[attr-defined]
    )
    rows = list((await session.execute(stmt)).scalars().all())
    entity_type = model.__tablename__  # type: ignore[attr-defined]
    return [
        DeletedItem(
            id=row.id,
            entity_type=entity_type,
            label=label_fn(row),  # type: ignore[operator]
            deleted_at=row.deleted_at.replace(tzinfo=UTC) if row.deleted_at.tzinfo is None else row.deleted_at,
        )
        for row in rows
    ]


@router.get("", response_model=RecentlyDeletedResponse)
async def list_recently_deleted(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> RecentlyDeletedResponse:
    uid = user.id

    results: list[DeletedItem] = []
    results += await _query_deleted(session, Account, uid, lambda r: r.name)
    results += await _query_deleted(session, Payee, uid, lambda r: r.name)
    results += await _query_deleted(session, Category, uid, lambda r: r.name)
    results += await _query_deleted(session, Tag, uid, lambda r: r.name)
    results += await _query_deleted(session, Transaction, uid, lambda r: r.description or f"{r.type} {r.amount}")
    results += await _query_deleted(session, Budget, uid, lambda r: r.name)
    results += await _query_deleted(session, Subscription, uid, lambda r: r.name)
    results += await _query_deleted(session, PiggyBank, uid, lambda r: r.name)

    results.sort(key=lambda x: x.deleted_at, reverse=True)
    return RecentlyDeletedResponse(items=results)
