import hashlib
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from jose import JWTError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.session import Session as SessionModel
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    MeResponse,
    RefreshRequest,
    SetupRequest,
    TokenResponse,
)
from app.security.passwords import hash_password, verify_password
from app.security.tokens import (
    REFRESH_TOKEN_EXPIRES,
    create_access_token,
    create_refresh_token,
    decode_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


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


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    result = await session.execute(
        select(User).where(User.email == body.email, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    db_session = SessionModel(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash=_hash_token(refresh_token),
        expires_at=datetime.now(UTC) + REFRESH_TOKEN_EXPIRES,
    )
    session.add(db_session)
    await session.commit()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout", status_code=204)
async def logout(
    body: LogoutRequest,
    _current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    result = await session.execute(
        select(SessionModel).where(SessionModel.token_hash == _hash_token(body.refresh_token))
    )
    db_session = result.scalar_one_or_none()
    if db_session is not None:
        await session.delete(db_session)
        await session.commit()


@router.get("/me", response_model=MeResponse)
async def me(current_user: User = Depends(get_current_user)) -> MeResponse:
    return MeResponse(
        id=current_user.id,
        email=current_user.email,
        created_at=current_user.created_at,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    try:
        payload = decode_token(body.refresh_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    result = await session.execute(
        select(SessionModel).where(
            SessionModel.token_hash == _hash_token(body.refresh_token)
        )
    )
    db_session = result.scalar_one_or_none()
    if db_session is None:
        raise HTTPException(status_code=401, detail="Session not found or revoked")

    user_id = uuid.UUID(str(payload["sub"]))
    new_access = create_access_token(user_id)
    new_refresh = create_refresh_token(user_id)

    await session.delete(db_session)
    session.add(
        SessionModel(
            id=uuid.uuid4(),
            user_id=user_id,
            token_hash=_hash_token(new_refresh),
            expires_at=datetime.now(UTC) + REFRESH_TOKEN_EXPIRES,
        )
    )
    await session.commit()

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)
