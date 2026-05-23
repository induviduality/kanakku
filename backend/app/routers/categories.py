import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.category import Category, CategoryApplicability
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryPatch, CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])

_SOFT_DELETE_WINDOW = timedelta(days=30)

_DEFAULT_CATEGORIES: list[dict] = [
    {"name": "Food & Dining", "icon": "🍽️", "color": "#FF6B6B", "applicability": CategoryApplicability.expense},
    {"name": "Transport", "icon": "🚗", "color": "#4ECDC4", "applicability": CategoryApplicability.expense},
    {"name": "Shopping", "icon": "🛍️", "color": "#45B7D1", "applicability": CategoryApplicability.expense},
    {"name": "Entertainment", "icon": "🎬", "color": "#96CEB4", "applicability": CategoryApplicability.expense},
    {"name": "Healthcare", "icon": "🏥", "color": "#FFEAA7", "applicability": CategoryApplicability.expense},
    {"name": "Utilities", "icon": "💡", "color": "#DDA0DD", "applicability": CategoryApplicability.expense},
    {"name": "Rent & Housing", "icon": "🏠", "color": "#98D8C8", "applicability": CategoryApplicability.expense},
    {"name": "Education", "icon": "📚", "color": "#F7DC6F", "applicability": CategoryApplicability.expense},
    {"name": "Salary", "icon": "💼", "color": "#82E0AA", "applicability": CategoryApplicability.income},
    {"name": "Freelance", "icon": "💻", "color": "#85C1E9", "applicability": CategoryApplicability.income},
    {"name": "Investment Returns", "icon": "📈", "color": "#A9DFBF", "applicability": CategoryApplicability.income},
    {"name": "Transfer", "icon": "↔️", "color": "#BDC3C7", "applicability": CategoryApplicability.both},
]


async def _get_category_or_404(
    category_id: uuid.UUID,
    user: User,
    session: AsyncSession,
    include_deleted: bool = False,
) -> Category:
    stmt = select(Category).where(Category.id == category_id, Category.user_id == user.id)
    if not include_deleted:
        stmt = stmt.where(Category.deleted_at.is_(None))
    result = await session.execute(stmt)
    category = result.scalar_one_or_none()
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.post("", status_code=201, response_model=CategoryResponse)
async def create_category(
    body: CategoryCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CategoryResponse:
    category = Category(
        id=uuid.uuid4(),
        user_id=current_user.id,
        name=body.name,
        icon=body.icon,
        color=body.color,
        applicability=body.applicability,
    )
    session.add(category)
    await session.commit()
    await session.refresh(category)
    return CategoryResponse.model_validate(category)


@router.get("", response_model=list[CategoryResponse])
async def list_categories(
    applicability: CategoryApplicability | None = None,
    include_deleted: bool = False,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[CategoryResponse]:
    stmt = select(Category).where(Category.user_id == current_user.id)
    if not include_deleted:
        stmt = stmt.where(Category.deleted_at.is_(None))
    if applicability is not None:
        stmt = stmt.where(Category.applicability == applicability)
    stmt = stmt.order_by(Category.name)
    result = await session.execute(stmt)
    return [CategoryResponse.model_validate(c) for c in result.scalars()]


@router.get("/{category_id}", response_model=CategoryResponse)
async def get_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CategoryResponse:
    category = await _get_category_or_404(category_id, current_user, session)
    return CategoryResponse.model_validate(category)


@router.patch("/{category_id}", response_model=CategoryResponse)
async def patch_category(
    category_id: uuid.UUID,
    body: CategoryPatch,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CategoryResponse:
    category = await _get_category_or_404(category_id, current_user, session)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(category, field, value)
    await session.commit()
    await session.refresh(category)
    return CategoryResponse.model_validate(category)


@router.delete("/{category_id}", status_code=204)
async def delete_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    category = await _get_category_or_404(category_id, current_user, session)
    category.deleted_at = datetime.now(UTC)
    await session.commit()


@router.post("/{category_id}/restore", response_model=CategoryResponse)
async def restore_category(
    category_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> CategoryResponse:
    category = await _get_category_or_404(
        category_id, current_user, session, include_deleted=True
    )
    if category.deleted_at is None:
        raise HTTPException(status_code=400, detail="Category is not deleted")
    if datetime.now(UTC) - category.deleted_at.replace(tzinfo=UTC) > _SOFT_DELETE_WINDOW:
        raise HTTPException(
            status_code=410,
            detail="Category deleted more than 30 days ago; cannot restore",
        )
    category.deleted_at = None
    await session.commit()
    await session.refresh(category)
    return CategoryResponse.model_validate(category)


@router.post("/seed-defaults", status_code=201, response_model=list[CategoryResponse])
async def seed_default_categories(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[CategoryResponse]:
    existing = await session.execute(
        select(Category).where(
            Category.user_id == current_user.id,
            Category.deleted_at.is_(None),
        )
    )
    if existing.scalars().first() is not None:
        raise HTTPException(
            status_code=409,
            detail="Categories already exist; seed-defaults only runs on a fresh account",
        )

    created: list[Category] = []
    for defaults in _DEFAULT_CATEGORIES:
        category = Category(
            id=uuid.uuid4(),
            user_id=current_user.id,
            **defaults,
        )
        session.add(category)
        created.append(category)

    await session.commit()
    for c in created:
        await session.refresh(c)

    return [CategoryResponse.model_validate(c) for c in created]
