"""Migration round-trip tests (synchronous — alembic uses asyncio.run internally)."""

import asyncio
import os

from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command
from app.config import settings


def get_alembic_cfg() -> Config:
    backend_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
    cfg = Config(os.path.join(backend_dir, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    return cfg


async def _get_table_names() -> list[str]:
    engine = create_async_engine(settings.database_url)
    try:
        async with engine.connect() as conn:
            return await conn.run_sync(
                lambda sync_conn: inspect(sync_conn).get_table_names()
            )
    finally:
        await engine.dispose()


async def _drop_all_for_clean_state() -> None:
    engine = create_async_engine(settings.database_url)
    try:
        async with engine.begin() as conn:
            await conn.execute(text("DROP TABLE IF EXISTS invite_tokens CASCADE"))
            await conn.execute(text("DROP TABLE IF EXISTS sessions CASCADE"))
            await conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))
            await conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))
    finally:
        await engine.dispose()


def test_migration_upgrade_head() -> None:
    asyncio.run(_drop_all_for_clean_state())

    cfg = get_alembic_cfg()
    command.upgrade(cfg, "head")

    tables = asyncio.run(_get_table_names())
    assert "users" in tables
    assert "sessions" in tables
    assert "invite_tokens" in tables


def test_migration_downgrade_base() -> None:
    cfg = get_alembic_cfg()
    command.downgrade(cfg, "base")

    tables = asyncio.run(_get_table_names())
    assert "users" not in tables
    assert "sessions" not in tables
    assert "invite_tokens" not in tables
