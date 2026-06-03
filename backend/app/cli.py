"""
Backend CLI — run as:  python -m app.cli <command> [options]

Commands
--------
create-user  --email EMAIL --password PASSWORD
export-archive  --user-email EMAIL --output PATH
import-archive  --user-email EMAIL --input PATH
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import pathlib
import sys
import tarfile
from typing import Any

# ── helpers ───────────────────────────────────────────────────────────────────


def _get_engine() -> "Any":
    from app.db.session import engine
    return engine


async def _find_user(session: "Any", email: str) -> "Any":
    import sqlalchemy as sa

    from app.models.user import User

    result = await session.execute(sa.select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is None:
        print(f"ERROR: No user found with email {email!r}", file=sys.stderr)
        sys.exit(1)
    return user


# ── create-user ───────────────────────────────────────────────────────────────


async def _create_user(email: str, password: str) -> None:
    import sqlalchemy as sa
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.models.user import User
    from app.models.user_settings import UserSettings
    from app.security.passwords import hash_password

    engine = _get_engine()
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        existing = await session.execute(sa.select(User).where(User.email == email))
        if existing.scalar_one_or_none() is not None:
            print(f"ERROR: User {email!r} already exists.", file=sys.stderr)
            sys.exit(1)

        user = User(email=email, password_hash=hash_password(password))
        session.add(user)
        await session.flush()
        session.add(UserSettings(user_id=user.id))
        await session.commit()
        print(f"Created user: {email} (id={user.id})")


# ── export-archive ────────────────────────────────────────────────────────────


async def _export_archive(email: str, output: str) -> None:
    from datetime import UTC, datetime

    import sqlalchemy as sa
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.workers.export_worker import (
        _EXPORT_TABLES,
        SCHEMA_VERSION,
        _add_json,
        _row_to_dict,
    )

    engine = _get_engine()
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        user = await _find_user(session, email)
        uid = user.id

        table_data: dict[str, list[dict[str, object]]] = {}
        async with session.begin():
            for table_name, query in _EXPORT_TABLES:
                result = await session.execute(sa.text(query), {"user_id": uid})
                table_data[table_name] = [_row_to_dict(r) for r in result]

    manifest = {
        "schema_version": SCHEMA_VERSION,
        "exported_at": datetime.now(UTC).isoformat(),
        "user_id": str(uid),
        "table_list": [t for t, _ in _EXPORT_TABLES],
        "record_counts": {t: len(rows) for t, rows in table_data.items()},
    }

    out_path = pathlib.Path(output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        _add_json(tar, "manifest.json", manifest)
        for table_name, rows in table_data.items():
            _add_json(tar, f"{table_name}.json", rows)

    out_path.write_bytes(buf.getvalue())
    total = sum(len(r) for r in table_data.values())
    print(f"Exported {total} records to {out_path}")


# ── import-archive ────────────────────────────────────────────────────────────


async def _import_archive(email: str, input_path: str) -> None:
    import sqlalchemy as sa
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.workers.export_worker import _EXPORT_TABLES, SCHEMA_VERSION

    engine = _get_engine()
    factory = async_sessionmaker(engine, expire_on_commit=False)

    archive_bytes = pathlib.Path(input_path).read_bytes()
    buf = io.BytesIO(archive_bytes)
    with tarfile.open(fileobj=buf, mode="r:gz") as tar:
        manifest: dict[str, object] = json.loads(tar.extractfile("manifest.json").read())  # type: ignore[union-attr]
        if manifest.get("schema_version") != SCHEMA_VERSION:
            print(f"ERROR: Unsupported schema_version {manifest.get('schema_version')}", file=sys.stderr)
            sys.exit(1)

        archived_uid = str(manifest.get("user_id", ""))
        import_order = [t for t, _ in _EXPORT_TABLES]
        table_data: dict[str, list[dict[str, object]]] = {}
        for table_name in import_order:
            try:
                member = tar.getmember(f"{table_name}.json")
                table_data[table_name] = json.loads(tar.extractfile(member).read())  # type: ignore[union-attr]
            except KeyError:
                table_data[table_name] = []

    async with factory() as session:
        user = await _find_user(session, email)
        target_uid = str(user.id)

        # Remap user_id
        user_id_tables = {
            "user_settings", "accounts", "categories", "payees", "tags",
            "subscriptions", "budgets", "piggy_banks", "transactions", "splits",
            "import_batches", "report_dashboards", "llm_activity_logs",
        }
        if archived_uid != target_uid:
            for tname, rows in table_data.items():
                if tname in user_id_tables:
                    for row in rows:
                        if str(row.get("user_id")) == archived_uid:
                            row["user_id"] = target_uid

        inserted: dict[str, int] = {}
        async with session.begin():
            for table_name in import_order:
                rows = table_data.get(table_name, [])
                if not rows:
                    inserted[table_name] = 0
                    continue
                for row in rows:
                    cols = ", ".join(row.keys())
                    placeholders = ", ".join(f":{k}" for k in row.keys())
                    await session.execute(
                        sa.text(f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})"),
                        row,
                    )
                inserted[table_name] = len(rows)

    total = sum(inserted.values())
    print(f"Imported {total} records into user {email}")


# ── main ──────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="Kanakku CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    cu = sub.add_parser("create-user", help="Create a new user")
    cu.add_argument("--email", required=True)
    cu.add_argument("--password", required=True)

    ex = sub.add_parser("export-archive", help="Export user data to tar.gz")
    ex.add_argument("--user-email", required=True)
    ex.add_argument("--output", required=True)

    im = sub.add_parser("import-archive", help="Import archive into user account")
    im.add_argument("--user-email", required=True)
    im.add_argument("--input", required=True)

    args = parser.parse_args()

    if args.command == "create-user":
        asyncio.run(_create_user(args.email, args.password))
    elif args.command == "export-archive":
        asyncio.run(_export_archive(args.user_email, args.output))
    elif args.command == "import-archive":
        asyncio.run(_import_archive(args.user_email, args.input))


if __name__ == "__main__":
    main()
