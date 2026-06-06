"""Migration round-trip tests (synchronous — alembic uses asyncio.run internally)."""

import asyncio
import os
from typing import Callable

from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command
from app.config import settings


def _test_db_url() -> str:
    url = settings.database_url
    if url.endswith("/kanakku"):
        return url[:-len("/kanakku")] + "/kanakku_test"
    return url


def get_alembic_cfg() -> Config:
    backend_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
    cfg = Config(os.path.join(backend_dir, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    cfg.set_main_option("sqlalchemy.url", _test_db_url())
    return cfg


async def _get_table_names() -> list[str]:
    engine = create_async_engine(_test_db_url())
    try:
        async with engine.connect() as conn:
            return await conn.run_sync(
                lambda sync_conn: inspect(sync_conn).get_table_names()
            )
    finally:
        await engine.dispose()


async def _reset_schema() -> None:
    engine = create_async_engine(_test_db_url())
    try:
        async with engine.begin() as conn:
            await conn.execute(text("DROP SCHEMA public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
    finally:
        await engine.dispose()


def _run_with_test_db(fn: "Callable[[], None]") -> None:
    """Run fn with settings.database_url patched to the test DB."""
    import app.config as _cfg
    original = _cfg.settings.database_url
    object.__setattr__(_cfg.settings, "database_url", _test_db_url())
    try:
        fn()
    finally:
        object.__setattr__(_cfg.settings, "database_url", original)


def test_migration_upgrade_head() -> None:
    asyncio.run(_reset_schema())

    cfg = get_alembic_cfg()
    _run_with_test_db(lambda: command.upgrade(cfg, "head"))

    tables = asyncio.run(_get_table_names())
    assert "users" in tables
    assert "sessions" in tables
    assert "invite_tokens" in tables


def test_migration_downgrade_base() -> None:
    cfg = get_alembic_cfg()
    _run_with_test_db(lambda: command.downgrade(cfg, "base"))

    tables = asyncio.run(_get_table_names())
    assert "users" not in tables
    assert "sessions" not in tables
    assert "invite_tokens" not in tables
