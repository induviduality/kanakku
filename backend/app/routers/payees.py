import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.payee import Payee, PayeeType
from app.models.user import User
from app.schemas.payee import PayeeCreate, PayeePatch, PayeeResponse

router = APIRouter(prefix="/payees", tags=["payees"])

_SOFT_DELETE_WINDOW = timedelta(days=30)


async def _get_payee_or_404(
    payee_id: uuid.UUID,
    user: User,
    session: AsyncSession,
    include_deleted: bool = False,
) -> Payee:
    stmt = select(Payee).where(Payee.id == payee_id, Payee.user_id == user.id)
    if not include_deleted:
        stmt = stmt.where(Payee.deleted_at.is_(None))
    result = await session.execute(stmt)
    payee = result.scalar_one_or_none()
    if payee is None:
        raise HTTPException(status_code=404, detail="Payee not found")
    return payee


@router.post("", status_code=201, response_model=PayeeResponse)
async def create_payee(
    body: PayeeCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PayeeResponse:
    payee = Payee(
        id=uuid.uuid4(),
        user_id=current_user.id,
        name=body.name,
        type=body.type,
        notes=body.notes,
        is_active=body.is_active,
    )
    session.add(payee)
    await session.commit()
    await session.refresh(payee)
    return PayeeResponse.model_validate(payee)


@router.get("", response_model=list[PayeeResponse])
async def list_payees(
    search: str | None = None,
    type: PayeeType | None = None,
    include_deleted: bool = False,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[PayeeResponse]:
    stmt = select(Payee).where(Payee.user_id == current_user.id)
    if not include_deleted:
        stmt = stmt.where(Payee.deleted_at.is_(None))
    if search:
        stmt = stmt.where(Payee.name.ilike(f"%{search}%"))
    if type is not None:
        stmt = stmt.where(Payee.type == type)
    stmt = stmt.order_by(Payee.name)
    result = await session.execute(stmt)
    return [PayeeResponse.model_validate(p) for p in result.scalars()]


@router.get("/{payee_id}", response_model=PayeeResponse)
async def get_payee(
    payee_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PayeeResponse:
    payee = await _get_payee_or_404(payee_id, current_user, session)
    return PayeeResponse.model_validate(payee)


@router.patch("/{payee_id}", response_model=PayeeResponse)
async def patch_payee(
    payee_id: uuid.UUID,
    body: PayeePatch,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PayeeResponse:
    payee = await _get_payee_or_404(payee_id, current_user, session)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(payee, field, value)
    await session.commit()
    await session.refresh(payee)
    return PayeeResponse.model_validate(payee)


@router.delete("/{payee_id}", status_code=204)
async def delete_payee(
    payee_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    payee = await _get_payee_or_404(payee_id, current_user, session)
    payee.deleted_at = datetime.now(UTC)
    await session.commit()


@router.post("/{payee_id}/restore", response_model=PayeeResponse)
async def restore_payee(
    payee_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> PayeeResponse:
    payee = await _get_payee_or_404(
        payee_id, current_user, session, include_deleted=True
    )
    if payee.deleted_at is None:
        raise HTTPException(status_code=400, detail="Payee is not deleted")
    if datetime.now(UTC) - payee.deleted_at.replace(tzinfo=UTC) > _SOFT_DELETE_WINDOW:
        raise HTTPException(
            status_code=410,
            detail="Payee deleted more than 30 days ago; cannot restore",
        )
    payee.deleted_at = None
    await session.commit()
    await session.refresh(payee)
    return PayeeResponse.model_validate(payee)
