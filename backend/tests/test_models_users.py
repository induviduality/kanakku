import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.invite_token import InviteToken
from app.models.session import Session
from app.models.user import User


async def test_create_user(db_session: AsyncSession) -> None:
    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        password_hash="hashed",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    assert user.id is not None
    assert user.email == "test@example.com"
    assert isinstance(user.created_at, datetime)
    assert user.deleted_at is None


async def test_user_email_unique_constraint(db_session: AsyncSession) -> None:
    user1 = User(id=uuid.uuid4(), email="dup@example.com", password_hash="h1")
    user2 = User(id=uuid.uuid4(), email="dup@example.com", password_hash="h2")
    db_session.add(user1)
    await db_session.commit()

    db_session.add(user2)
    with pytest.raises(IntegrityError):
        await db_session.commit()


async def test_user_created_at_auto_set(db_session: AsyncSession) -> None:
    user = User(id=uuid.uuid4(), email="ts@example.com", password_hash="h")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    assert user.created_at.tzinfo is not None


async def test_create_session(db_session: AsyncSession) -> None:
    user = User(id=uuid.uuid4(), email="sess@example.com", password_hash="h")
    db_session.add(user)
    await db_session.flush()

    session = Session(
        id=uuid.uuid4(),
        user_id=user.id,
        token_hash="abc123hash",
        expires_at=datetime(2030, 1, 1, tzinfo=UTC),
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)

    assert session.user_id == user.id
    assert session.token_hash == "abc123hash"
    assert isinstance(session.created_at, datetime)


async def test_create_invite_token(db_session: AsyncSession) -> None:
    user = User(id=uuid.uuid4(), email="inv@example.com", password_hash="h")
    db_session.add(user)
    await db_session.flush()

    token = InviteToken(
        id=uuid.uuid4(),
        created_by_user_id=user.id,
        token_hash="invitehash",
        expires_at=datetime(2030, 1, 1, tzinfo=UTC),
    )
    db_session.add(token)
    await db_session.commit()
    await db_session.refresh(token)

    assert token.created_by_user_id == user.id
    assert token.email is None
    assert token.used_at is None


async def test_invite_token_with_email(db_session: AsyncSession) -> None:
    user = User(id=uuid.uuid4(), email="inv2@example.com", password_hash="h")
    db_session.add(user)
    await db_session.flush()

    token = InviteToken(
        id=uuid.uuid4(),
        created_by_user_id=user.id,
        token_hash="invitehash2",
        email="guest@example.com",
        expires_at=datetime(2030, 1, 1, tzinfo=UTC),
    )
    db_session.add(token)
    await db_session.commit()
    await db_session.refresh(token)

    assert token.email == "guest@example.com"
