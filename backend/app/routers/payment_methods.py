import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.account import Account
from app.models.payment_method import PaymentMethod
from app.models.user import User
from app.schemas.payment_method import (
    PaymentMethodCreate,
    PaymentMethodPatch,
    PaymentMethodResponse,
)

router = APIRouter(
    prefix="/accounts/{account_id}/payment-methods", tags=["payment-methods"]
)

_SOFT_DELETE_WINDOW = timedelta(days=30)


async def _get_account_or_404(
    account_id: uuid.UUID, user: User, session: AsyncSession
) -> Account:
    result = await session.execute(
        select(Account).where(
            Account.id == account_id,
            Account.user_id == user.id,
            Account.deleted_at.is_(None),
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


async def _get_pm_or_404(
    pm_id: uuid.UUID,
    account_id: uuid.UUID,
    session: AsyncSession,
    include_deleted: bool = False,
) -> PaymentMethod:
    stmt = select(PaymentMethod).where(
        PaymentMethod.id == pm_id,
        PaymentMethod.account_id == account_id,
    )
    if not include_deleted:
        stmt = stmt.where(PaymentMethod.deleted_at.is_(None))
    result = await session.execute(stmt)
    pm = result.scalar_one_or_none()
    if pm is None:
        raise HTTPException(status_code=404, detail="Payment method not found")
    return pm


@router.post("", status_code=201, response_model=PaymentMethodResponse)
async def create_payment_method(
    account_id: uuid.UUID,
    body: PaymentMethodCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PaymentMethodResponse:
    await _get_account_or_404(account_id, current_user, session)
    pm = PaymentMethod(
        id=uuid.uuid4(),
        account_id=account_id,
        type=body.type,
        label=body.label,
        upi_app=body.upi_app,
        is_active=body.is_active,
    )
    session.add(pm)
    await session.commit()
    await session.refresh(pm)
    return PaymentMethodResponse.model_validate(pm)


@router.get("", response_model=list[PaymentMethodResponse])
async def list_payment_methods(
    account_id: uuid.UUID,
    include_deleted: bool = False,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[PaymentMethodResponse]:
    await _get_account_or_404(account_id, current_user, session)
    stmt = select(PaymentMethod).where(PaymentMethod.account_id == account_id)
    if not include_deleted:
        stmt = stmt.where(PaymentMethod.deleted_at.is_(None))
    stmt = stmt.order_by(PaymentMethod.created_at)
    result = await session.execute(stmt)
    return [PaymentMethodResponse.model_validate(pm) for pm in result.scalars()]


@router.patch("/{pm_id}", response_model=PaymentMethodResponse)
async def patch_payment_method(
    account_id: uuid.UUID,
    pm_id: uuid.UUID,
    body: PaymentMethodPatch,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PaymentMethodResponse:
    await _get_account_or_404(account_id, current_user, session)
    pm = await _get_pm_or_404(pm_id, account_id, session)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(pm, field, value)
    await session.commit()
    await session.refresh(pm)
    return PaymentMethodResponse.model_validate(pm)


@router.delete("/{pm_id}", status_code=204)
async def delete_payment_method(
    account_id: uuid.UUID,
    pm_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    await _get_account_or_404(account_id, current_user, session)
    pm = await _get_pm_or_404(pm_id, account_id, session)
    pm.deleted_at = datetime.now(UTC)
    await session.commit()


@router.post("/{pm_id}/restore", response_model=PaymentMethodResponse)
async def restore_payment_method(
    account_id: uuid.UUID,
    pm_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PaymentMethodResponse:
    await _get_account_or_404(account_id, current_user, session)
    pm = await _get_pm_or_404(pm_id, account_id, session, include_deleted=True)
    if pm.deleted_at is None:
        raise HTTPException(status_code=400, detail="Payment method is not deleted")
    if datetime.now(UTC) - pm.deleted_at.replace(tzinfo=UTC) > _SOFT_DELETE_WINDOW:
        raise HTTPException(
            status_code=410,
            detail="Payment method deleted more than 30 days ago; cannot restore",
        )
    pm.deleted_at = None
    await session.commit()
    await session.refresh(pm)
    return PaymentMethodResponse.model_validate(pm)
