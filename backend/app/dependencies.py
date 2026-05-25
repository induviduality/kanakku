import uuid

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_session
from app.models.user import User
from app.security.tokens import decode_token

_DEV_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

# auto_error=False lets us handle missing credentials ourselves (needed for dev bypass)
_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_session),
) -> User:
    # In dev mode, fall back to the seed user when no token is provided
    if settings.dev_mode and credentials is None:
        result = await session.execute(
            select(User).where(User.id == _DEV_USER_ID, User.deleted_at.is_(None))
        )
        user = result.scalar_one_or_none()
        if user is not None:
            return user

    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = uuid.UUID(str(payload["sub"]))
    result = await session.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user
