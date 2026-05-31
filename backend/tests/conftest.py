import asyncio
import sys
from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

import app.db.session as _db_session
import app.models  # noqa: F401 — registers all models with Base.metadata
from app.config import settings
from app.db.base import Base
from app.main import app as fastapi_app

# asyncpg is incompatible with Windows ProactorEventLoop (the default in Python 3.8+).
# Switch to SelectorEventLoop when running on Windows so the DB fixtures work.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


def _test_db_url() -> str:
    """Return the test database URL (kanakku_test instead of kanakku)."""
    url = settings.database_url
    # Swap the database name to the dedicated test database.
    if url.endswith("/kanakku"):
        return url[:-len("/kanakku")] + "/kanakku_test"
    return url


@pytest.fixture
async def db_engine() -> AsyncGenerator[AsyncEngine, None]:
    engine = create_async_engine(_test_db_url())
    # Monkey-patch the app's global engine so FastAPI's get_session uses the test DB.
    original_engine = _db_session.engine
    original_factory = _db_session.async_session_factory
    original_readonly = _db_session._readonly_engine
    _db_session.engine = engine
    _db_session.async_session_factory = async_sessionmaker(engine, expire_on_commit=False)
    # Also patch the readonly engine so reports/query uses the test DB.
    _db_session._readonly_engine = engine
    yield engine
    await engine.dispose()
    _db_session.engine = original_engine
    _db_session.async_session_factory = original_factory
    _db_session._readonly_engine = original_readonly


@pytest.fixture
async def db_tables(db_engine: AsyncEngine) -> AsyncGenerator[None, None]:
    # Drop the entire public schema (handles views, enums, and other dependencies)
    # then recreate it from scratch for a clean slate.
    await db_engine.dispose()
    async with db_engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
    async with db_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await db_engine.dispose()
    async with db_engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))


@pytest.fixture
async def db_session(
    db_engine: AsyncEngine, db_tables: None
) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with session_factory() as session:
        yield session


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(
        transport=ASGITransport(app=fastapi_app), base_url="http://test"
    ) as c:
        yield c


async def create_second_user(
    client: AsyncClient,
    admin_headers: dict[str, str],
    email: str = "other@example.com",
    password: str = "password123",
) -> dict[str, str]:
    """Register a second user via the invite flow and return auth headers."""
    invite_resp = await client.post(
        "/api/v1/auth/invites",
        json={"email": email},
        headers=admin_headers,
    )
    assert invite_resp.status_code == 201
    invite_token = invite_resp.json()["token"]

    reg_resp = await client.post(
        "/api/v1/auth/accept-invite",
        json={"token": invite_token, "email": email, "password": password},
    )
    assert reg_resp.status_code == 201
    return {"Authorization": f"Bearer {reg_resp.json()['access_token']}"}
