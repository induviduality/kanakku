import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from jose import JWTError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.dependencies import get_current_user
from app.models.invite_token import InviteToken
from app.models.session import Session as SessionModel
from app.models.user import User
from app.models.user_settings import UserSettings
from app.schemas.auth import (
    AcceptInviteRequest,
    InviteCreateRequest,
    InviteCreateResponse,
    InviteInfoResponse,
    LoginRequest,
    LogoutRequest,
    MeResponse,
    RefreshRequest,
    SetupRequest,
    TokenResponse,
)
from app.config import settings
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
    await session.flush()
    session.add(UserSettings(user_id=user.id))
    await session.commit()
    await session.refresh(user)
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/dev-login", response_model=TokenResponse)
async def dev_login(session: AsyncSession = Depends(get_session)) -> TokenResponse:
    """Auto-login as the dev seed user. Only available when DEV_MODE=true."""
    if not settings.dev_mode:
        raise HTTPException(status_code=404, detail="Not found")

    DEV_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")

    result = await session.execute(
        select(User).where(User.id == DEV_USER_ID, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=503, detail="Dev user not seeded yet")

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


_INVITE_TTL = timedelta(days=7)


@router.post("/invites", status_code=201, response_model=InviteCreateResponse)
async def create_invite(
    body: InviteCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> InviteCreateResponse:
    plain_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + _INVITE_TTL
    session.add(
        InviteToken(
            id=uuid.uuid4(),
            created_by_user_id=current_user.id,
            token_hash=_hash_token(plain_token),
            email=body.email,
            expires_at=expires_at,
        )
    )
    await session.commit()
    return InviteCreateResponse(token=plain_token, expires_at=expires_at)


@router.get("/invites/{token}/info", response_model=InviteInfoResponse)
async def invite_info(
    token: str,
    session: AsyncSession = Depends(get_session),
) -> InviteInfoResponse:
    result = await session.execute(
        select(InviteToken).where(InviteToken.token_hash == _hash_token(token))
    )
    invite = result.scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.used_at is not None or invite.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=410, detail="Invite expired or already used")
    return InviteInfoResponse(expires_at=invite.expires_at, email=invite.email)


@router.post("/accept-invite", status_code=201, response_model=TokenResponse)
async def accept_invite(
    body: AcceptInviteRequest,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    result = await session.execute(
        select(InviteToken).where(InviteToken.token_hash == _hash_token(body.token))
    )
    invite = result.scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.used_at is not None:
        raise HTTPException(status_code=410, detail="Invite already used")
    if invite.expires_at < datetime.now(UTC):
        raise HTTPException(status_code=410, detail="Invite expired")
    if invite.email is not None and invite.email.lower() != body.email.lower():
        raise HTTPException(status_code=400, detail="Email does not match invite")

    existing = await session.execute(
        select(User).where(User.email == body.email, User.deleted_at.is_(None))
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        id=uuid.uuid4(),
        email=body.email,
        password_hash=hash_password(body.password),
    )
    session.add(user)
    await session.flush()
    session.add(UserSettings(user_id=user.id))

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    session.add(
        SessionModel(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=_hash_token(refresh_token),
            expires_at=datetime.now(UTC) + REFRESH_TOKEN_EXPIRES,
        )
    )
    invite.used_at = datetime.now(UTC)
    await session.commit()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)
