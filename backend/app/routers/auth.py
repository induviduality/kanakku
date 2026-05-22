import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.user import User
from app.schemas.auth import SetupRequest, TokenResponse
from app.security.passwords import hash_password
from app.security.tokens import create_access_token, create_refresh_token

router = APIRouter(prefix="/auth", tags=["auth"])


async def _assert_no_users_exist(session: AsyncSession = Depends(get_session)) -> None:
    result = await session.execute(select(func.count()).select_from(User))
    if result.scalar_one() > 0:
        raise HTTPException(status_code=404, detail="Setup already completed")


@router.post("/setup", status_code=201, response_model=TokenResponse)
async def setup(
    body: SetupRequest,
    _: None = Depends(_assert_no_users_exist),
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    user = User(
        id=uuid.uuid4(),
        email=body.email,
        password_hash=hash_password(body.password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )
