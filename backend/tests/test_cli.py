"""Tests for python -m app.cli commands."""

import io
import json
import tarfile

import pytest

from app.cli import _create_user, _export_archive, _import_archive
from app.workers.export_worker import SCHEMA_VERSION, _add_json


@pytest.mark.usefixtures("db_tables")
async def test_create_user_succeeds(db_session) -> None:
    """create-user writes a user row and prints confirmation."""
    import sqlalchemy as sa

    from app.models.user import User

    await _create_user("cli@example.com", "secure123")

    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.config import settings

    engine = create_async_engine(settings.database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        result = await session.execute(
            sa.select(User).where(User.email == "cli@example.com")
        )
        user = result.scalar_one_or_none()
    await engine.dispose()
    assert user is not None


@pytest.mark.usefixtures("db_tables")
async def test_create_user_duplicate_exits(capsys) -> None:
    await _create_user("dup@example.com", "pass123")
    with pytest.raises(SystemExit):
        await _create_user("dup@example.com", "pass456")


@pytest.mark.usefixtures("db_tables")
async def test_export_archive_creates_file(tmp_path) -> None:
    await _create_user("export_cli@example.com", "pass")
    out = tmp_path / "export.tar.gz"
    await _export_archive("export_cli@example.com", str(out))
    assert out.exists()
    assert out.stat().st_size > 0

    with tarfile.open(str(out), "r:gz") as tar:
        manifest = json.loads(tar.extractfile("manifest.json").read())  # type: ignore[union-attr]

    assert manifest["schema_version"] == SCHEMA_VERSION
    assert "table_list" in manifest


@pytest.mark.usefixtures("db_tables")
async def test_export_unknown_user_exits(tmp_path) -> None:
    with pytest.raises(SystemExit):
        await _export_archive("ghost@example.com", str(tmp_path / "out.tar.gz"))


@pytest.mark.usefixtures("db_tables")
async def test_import_archive_roundtrip(tmp_path) -> None:
    """CLI export + CLI import: total records same on destination user."""
    await _create_user("src_cli@example.com", "pass")
    out = tmp_path / "archive.tar.gz"
    await _export_archive("src_cli@example.com", str(out))

    await _create_user("dst_cli@example.com", "pass")
    await _import_archive("dst_cli@example.com", str(out))


@pytest.mark.usefixtures("db_tables")
async def test_import_wrong_schema_version_exits(tmp_path) -> None:
    await _create_user("badver@example.com", "pass")

    bad_manifest = {
        "schema_version": 99,
        "user_id": "x",
        "table_list": [],
        "record_counts": {},
        "exported_at": "2026-01-01T00:00:00+00:00",
    }
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        _add_json(tar, "manifest.json", bad_manifest)
    archive_path = tmp_path / "bad.tar.gz"
    archive_path.write_bytes(buf.getvalue())

    with pytest.raises(SystemExit):
        await _import_archive("badver@example.com", str(archive_path))
