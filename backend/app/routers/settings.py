from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.llm_activity_log import LLMActivityLog
from app.models.user import User
from app.models.user_settings import UserSettings
from app.schemas.settings import LLMActivityLogResponse, SettingsPatch, SettingsResponse

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SettingsResponse:
    result = await session.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        raise HTTPException(status_code=404, detail="Settings not found")
    return SettingsResponse.model_validate(settings)


@router.patch("", response_model=SettingsResponse)
async def patch_settings(
    body: SettingsPatch,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> SettingsResponse:
    result = await session.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        raise HTTPException(status_code=404, detail="Settings not found")

    updates = body.model_dump(exclude_none=True)
    for field, value in updates.items():
        setattr(settings, field, value)

    await session.commit()
    await session.refresh(settings)
    return SettingsResponse.model_validate(settings)


@router.get("/llm-activity", response_model=list[LLMActivityLogResponse])
async def get_llm_activity(
    limit: int = Query(default=50, ge=1, le=200),
    operation: str | None = Query(default=None),
    backend: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[LLMActivityLogResponse]:
    query = (
        select(LLMActivityLog)
        .where(LLMActivityLog.user_id == current_user.id)
        .order_by(LLMActivityLog.created_at.desc())
        .limit(limit)
    )
    if operation is not None:
        query = query.where(LLMActivityLog.operation == operation)
    if backend is not None:
        query = query.where(LLMActivityLog.backend == backend)

    result = await session.execute(query)
    return [LLMActivityLogResponse.model_validate(row) for row in result.scalars().all()]
