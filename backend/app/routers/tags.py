import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.tag import Tag
from app.models.user import User
from app.schemas.tag import TagCreate, TagPatch, TagResponse

router = APIRouter(prefix="/tags", tags=["tags"])

_SOFT_DELETE_WINDOW = timedelta(days=30)


async def _get_tag_or_404(
    tag_id: uuid.UUID,
    user: User,
    session: AsyncSession,
    include_deleted: bool = False,
) -> Tag:
    stmt = select(Tag).where(Tag.id == tag_id, Tag.user_id == user.id)
    if not include_deleted:
        stmt = stmt.where(Tag.deleted_at.is_(None))
    result = await session.execute(stmt)
    tag = result.scalar_one_or_none()
    if tag is None:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag


@router.post("", status_code=201, response_model=TagResponse)
async def create_tag(
    body: TagCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TagResponse:
    tag = Tag(
        id=uuid.uuid4(),
        user_id=current_user.id,
        name=body.name,
        color=body.color,
    )
    session.add(tag)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Tag name already exists")
    await session.refresh(tag)
    return TagResponse.model_validate(tag)


@router.get("", response_model=list[TagResponse])
async def list_tags(
    include_deleted: bool = False,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[TagResponse]:
    stmt = select(Tag).where(Tag.user_id == current_user.id)
    if not include_deleted:
        stmt = stmt.where(Tag.deleted_at.is_(None))
    stmt = stmt.order_by(Tag.name)
    result = await session.execute(stmt)
    return [TagResponse.model_validate(t) for t in result.scalars()]


@router.get("/{tag_id}", response_model=TagResponse)
async def get_tag(
    tag_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TagResponse:
    tag = await _get_tag_or_404(tag_id, current_user, session)
    return TagResponse.model_validate(tag)


@router.patch("/{tag_id}", response_model=TagResponse)
async def patch_tag(
    tag_id: uuid.UUID,
    body: TagPatch,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TagResponse:
    tag = await _get_tag_or_404(tag_id, current_user, session)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(tag, field, value)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=409, detail="Tag name already exists")
    await session.refresh(tag)
    return TagResponse.model_validate(tag)


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(
    tag_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    tag = await _get_tag_or_404(tag_id, current_user, session)
    tag.deleted_at = datetime.now(UTC)
    await session.commit()


@router.post("/{tag_id}/restore", response_model=TagResponse)
async def restore_tag(
    tag_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TagResponse:
    tag = await _get_tag_or_404(tag_id, current_user, session, include_deleted=True)
    if tag.deleted_at is None:
        raise HTTPException(status_code=400, detail="Tag is not deleted")
    if datetime.now(UTC) - tag.deleted_at.replace(tzinfo=UTC) > _SOFT_DELETE_WINDOW:
        raise HTTPException(
            status_code=410,
            detail="Tag deleted more than 30 days ago; cannot restore",
        )
    tag.deleted_at = None
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot restore: a tag with this name already exists",
        )
    await session.refresh(tag)
    return TagResponse.model_validate(tag)
