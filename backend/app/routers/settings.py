from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.user import User
from app.models.user_settings import UserSettings
from app.schemas.settings import SettingsPatch, SettingsResponse

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
