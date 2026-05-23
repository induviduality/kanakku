import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.subscription import Subscription
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.subscription import SubscriptionCreate, SubscriptionPatch, SubscriptionResponse
from app.schemas.transaction import TransactionResponse
from app.services.subscription_dates import compute_next_billing_date, subscription_status

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

_SOFT_DELETE_WINDOW = timedelta(days=30)


class _LinkBody(BaseModel):
    transaction_id: uuid.UUID


async def _get_sub_or_404(
    sub_id: uuid.UUID, user: User, session: AsyncSession
) -> Subscription:
    result = await session.execute(
        select(Subscription).where(
            Subscription.id == sub_id,
            Subscription.user_id == user.id,
            Subscription.deleted_at.is_(None),
        )
    )
    sub = result.scalar_one_or_none()
    if sub is None:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return sub


def _enrich(sub: Subscription) -> SubscriptionResponse:
    data = {c.key: getattr(sub, c.key) for c in sub.__table__.columns}
    data["next_billing_date"] = compute_next_billing_date(sub)
    data["status"] = subscription_status(sub)
    return SubscriptionResponse.model_validate(data)


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("", status_code=201, response_model=SubscriptionResponse)
async def create_subscription(
    body: SubscriptionCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubscriptionResponse:
    sub = Subscription(
        user_id=current_user.id,
        name=body.name,
        amount=body.amount,
        currency=body.currency,
        billing_cycle=body.billing_cycle,
        billing_day=body.billing_day,
        last_billed_at=body.last_billed_at,
        account_id=body.account_id,
        payment_method_id=body.payment_method_id,
        category_id=body.category_id,
        is_active=body.is_active,
        url=body.url,
        notes=body.notes,
    )
    session.add(sub)
    await session.commit()
    await session.refresh(sub)
    return _enrich(sub)


@router.get("", response_model=list[SubscriptionResponse])
async def list_subscriptions(
    include_inactive: bool = Query(False),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[SubscriptionResponse]:
    stmt = select(Subscription).where(
        Subscription.user_id == current_user.id,
        Subscription.deleted_at.is_(None),
    )
    if not include_inactive:
        stmt = stmt.where(Subscription.is_active.is_(True))
    stmt = stmt.order_by(Subscription.name)
    result = await session.execute(stmt)
    return [_enrich(s) for s in result.scalars().all()]


@router.get("/{sub_id}", response_model=SubscriptionResponse)
async def get_subscription(
    sub_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubscriptionResponse:
    sub = await _get_sub_or_404(sub_id, current_user, session)
    return _enrich(sub)


@router.patch("/{sub_id}", response_model=SubscriptionResponse)
async def patch_subscription(
    sub_id: uuid.UUID,
    body: SubscriptionPatch,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubscriptionResponse:
    sub = await _get_sub_or_404(sub_id, current_user, session)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(sub, field, value)
    await session.commit()
    await session.refresh(sub)
    return _enrich(sub)


@router.delete("/{sub_id}", status_code=204)
async def delete_subscription(
    sub_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    sub = await _get_sub_or_404(sub_id, current_user, session)
    sub.deleted_at = datetime.now(UTC)
    await session.commit()


@router.post("/{sub_id}/restore", response_model=SubscriptionResponse)
async def restore_subscription(
    sub_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SubscriptionResponse:
    result = await session.execute(
        select(Subscription).where(
            Subscription.id == sub_id,
            Subscription.user_id == current_user.id,
        )
    )
    sub = result.scalar_one_or_none()
    if sub is None:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if sub.deleted_at is None:
        raise HTTPException(status_code=400, detail="Subscription is not deleted")
    cutoff = datetime.now(UTC) - _SOFT_DELETE_WINDOW
    if sub.deleted_at < cutoff:
        raise HTTPException(status_code=410, detail="Restore window expired")
    sub.deleted_at = None
    await session.commit()
    await session.refresh(sub)
    return _enrich(sub)


# ── Link transaction ──────────────────────────────────────────────────────────

@router.post("/{sub_id}/link-transaction", response_model=TransactionResponse)
async def link_transaction(
    sub_id: uuid.UUID,
    body: _LinkBody,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TransactionResponse:
    sub = await _get_sub_or_404(sub_id, current_user, session)

    result = await session.execute(
        select(Transaction).where(
            Transaction.id == body.transaction_id,
            Transaction.user_id == current_user.id,
            Transaction.deleted_at.is_(None),
        )
    )
    txn = result.scalar_one_or_none()
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    txn.subscription_id = sub.id
    await session.commit()
    await session.refresh(txn)

    from app.routers.transactions import _to_response
    return await _to_response(txn, session)


# ── History ───────────────────────────────────────────────────────────────────

@router.get("/{sub_id}/history", response_model=list[TransactionResponse])
async def get_history(
    sub_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[TransactionResponse]:
    sub = await _get_sub_or_404(sub_id, current_user, session)

    result = await session.execute(
        select(Transaction).where(
            Transaction.subscription_id == sub.id,
            Transaction.user_id == current_user.id,
            Transaction.deleted_at.is_(None),
        ).order_by(Transaction.transacted_at.desc())
    )
    txns = result.scalars().all()

    from app.routers.transactions import _to_response
    return [await _to_response(t, session) for t in txns]
