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
    _db_session.engine = engine
    _db_session.async_session_factory = async_sessionmaker(engine, expire_on_commit=False)
    yield engine
    await engine.dispose()
    _db_session.engine = original_engine
    _db_session.async_session_factory = original_factory


# Base.metadata.create_all only creates ORM-mapped tables — raw-SQL objects
# defined directly in Alembic migrations (views, etc.) never get created by
# it, so the test DB silently diverges from what a real `alembic upgrade
# head` produces. transaction_with_net_amount (migration 0027, the latest
# revision touching it) is the one such object currently in use; recreate it
# by hand here rather than pulling in Alembic's own migration runner for
# tests. If a future migration changes this view again, update this string
# to match — this needs to track alembic/versions/0027_fix_net_amount_view_partial_forgiveness.py's _VIEW_UP.
_NET_AMOUNT_VIEW_SQL = """
CREATE OR REPLACE VIEW transaction_with_net_amount AS
SELECT
    t.id, t.user_id, t.type, t.transacted_at, t.amount, t.currency,
    t.description, t.notes, t.account_id, t.payment_method_id, t.payee_id,
    t.to_account_id, t.to_amount, t.to_currency, t.subscription_id,
    t.import_record_id, t.created_at, t.updated_at, t.deleted_at,
    CASE
        WHEN s.id IS NULL THEN t.amount
        ELSE COALESCE(
            (SELECT SUM(
               CASE
                 WHEN ss.payee_id IS NULL             THEN ss.amount
                 WHEN ss.status = 'forgiven'::splitsharestatus THEN ss.amount
                 ELSE ss.forgiven_amount
               END
             )
             FROM split_shares ss
             WHERE ss.split_id = s.id),
            t.amount
        )
    END AS net_amount
FROM transactions t
LEFT JOIN split_expenses se ON se.transaction_id = t.id
LEFT JOIN splits s ON s.id = se.split_id AND s.deleted_at IS NULL;
"""


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
        await conn.execute(text(_NET_AMOUNT_VIEW_SQL))
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
