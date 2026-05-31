"""ARQ worker job for async JSON archive export."""

from __future__ import annotations

import io
import json
import logging
import pathlib
import tarfile
import tempfile
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

import sqlalchemy as sa

from app.db.session import async_session_factory
from app.models.export_job import ExportJob, ExportJobStatus

logger = logging.getLogger(__name__)

SCHEMA_VERSION = 1

# Tables exported in dependency order so import can replay them in the same order.
# Each entry: (table_name, SQL query with :user_id param)
_EXPORT_TABLES: list[tuple[str, str]] = [
    ("user_settings", "SELECT * FROM user_settings WHERE user_id = :user_id"),
    ("accounts", "SELECT * FROM accounts WHERE user_id = :user_id"),
    ("categories", "SELECT * FROM categories WHERE user_id = :user_id"),
    ("payees", "SELECT * FROM payees WHERE user_id = :user_id"),
    (
        "payee_default_categories",
        "SELECT pdc.* FROM payee_default_categories pdc "
        "JOIN payees p ON p.id = pdc.payee_id WHERE p.user_id = :user_id",
    ),
    ("tags", "SELECT * FROM tags WHERE user_id = :user_id"),
    (
        "payment_methods",
        "SELECT pm.* FROM payment_methods pm "
        "JOIN accounts a ON a.id = pm.account_id WHERE a.user_id = :user_id",
    ),
    ("subscriptions", "SELECT * FROM subscriptions WHERE user_id = :user_id"),
    ("budgets", "SELECT * FROM budgets WHERE user_id = :user_id"),
    (
        "budget_categories",
        "SELECT bc.* FROM budget_categories bc "
        "JOIN budgets b ON b.id = bc.budget_id WHERE b.user_id = :user_id",
    ),
    ("piggy_banks", "SELECT * FROM piggy_banks WHERE user_id = :user_id"),
    (
        "piggy_bank_contributions",
        "SELECT pbc.* FROM piggy_bank_contributions pbc "
        "JOIN piggy_banks pb ON pb.id = pbc.piggy_bank_id WHERE pb.user_id = :user_id",
    ),
    ("transactions", "SELECT * FROM transactions WHERE user_id = :user_id"),
    (
        "transaction_categories",
        "SELECT tc.* FROM transaction_categories tc "
        "JOIN transactions t ON t.id = tc.transaction_id WHERE t.user_id = :user_id",
    ),
    (
        "transaction_tags",
        "SELECT tt.* FROM transaction_tags tt "
        "JOIN transactions t ON t.id = tt.transaction_id WHERE t.user_id = :user_id",
    ),
    (
        "transaction_budgets",
        "SELECT tb.* FROM transaction_budgets tb "
        "JOIN transactions t ON t.id = tb.transaction_id WHERE t.user_id = :user_id",
    ),
    ("splits", "SELECT * FROM splits WHERE user_id = :user_id"),
    (
        "split_shares",
        "SELECT ss.* FROM split_shares ss "
        "JOIN splits s ON s.id = ss.split_id WHERE s.user_id = :user_id",
    ),
    (
        "split_share_settlements",
        "SELECT sss.* FROM split_share_settlements sss "
        "JOIN split_shares ss ON ss.id = sss.share_id "
        "JOIN splits s ON s.id = ss.split_id WHERE s.user_id = :user_id",
    ),
    ("import_batches", "SELECT * FROM import_batches WHERE user_id = :user_id"),
    (
        "raw_import_records",
        "SELECT rir.* FROM raw_import_records rir "
        "JOIN import_batches ib ON ib.id = rir.batch_id WHERE ib.user_id = :user_id",
    ),
    ("gpay_matches", "SELECT * FROM gpay_matches WHERE user_id = :user_id"),
    ("report_dashboards", "SELECT * FROM report_dashboards WHERE user_id = :user_id"),
    (
        "report_widgets",
        "SELECT rw.* FROM report_widgets rw "
        "JOIN report_dashboards rd ON rd.id = rw.dashboard_id WHERE rd.user_id = :user_id",
    ),
    ("llm_activity_logs", "SELECT * FROM llm_activity_logs WHERE user_id = :user_id"),
]


def _serialize(v: object) -> object:
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, Decimal):
        return str(v)
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return v


def _row_to_dict(row: sa.engine.Row) -> dict[str, object]:  # type: ignore[type-arg]
    return {k: _serialize(v) for k, v in row._mapping.items()}


async def export_archive(ctx: dict[str, object], job_id: str, user_id: str) -> None:
    """ARQ job: export all user data to a tar.gz archive."""
    jid = uuid.UUID(job_id)
    uid = uuid.UUID(user_id)

    async with async_session_factory() as session:
        result = await session.execute(sa.select(ExportJob).where(ExportJob.id == jid))
        job = result.scalar_one_or_none()
        if job is None:
            logger.error("ExportJob %s not found", job_id)
            return

        job.status = ExportJobStatus.running
        await session.commit()

        try:
            table_data: dict[str, list[dict[str, object]]] = {}

            # Use begin() so we read with a consistent snapshot
            async with session.begin():
                for table_name, query in _EXPORT_TABLES:
                    result = await session.execute(
                        sa.text(query), {"user_id": uid}
                    )
                    table_data[table_name] = [_row_to_dict(r) for r in result]

            record_counts = {t: len(trows) for t, trows in table_data.items()}
            manifest = {
                "schema_version": SCHEMA_VERSION,
                "exported_at": datetime.now(UTC).isoformat(),
                "user_id": user_id,
                "table_list": [t for t, _ in _EXPORT_TABLES],
                "record_counts": record_counts,
            }

            # Write tar.gz to a temp dir
            export_dir = pathlib.Path(tempfile.gettempdir()) / "kanakku_exports"
            export_dir.mkdir(parents=True, exist_ok=True)
            archive_path = export_dir / f"{job_id}.tar.gz"

            buf = io.BytesIO()
            with tarfile.open(fileobj=buf, mode="w:gz") as tar:
                _add_json(tar, "manifest.json", manifest)
                for table_name, trows in table_data.items():
                    _add_json(tar, f"{table_name}.json", trows)

            archive_path.write_bytes(buf.getvalue())

            job.status = ExportJobStatus.done
            job.file_path = str(archive_path)
            job.completed_at = datetime.now(UTC)
            await session.commit()

        except Exception:
            logger.exception("Export failed for job %s", job_id)
            job.status = ExportJobStatus.failed
            job.error = "Export failed"
            job.completed_at = datetime.now(UTC)
            await session.commit()
            raise


def _add_json(tar: tarfile.TarFile, name: str, data: object) -> None:
    payload = json.dumps(data, ensure_ascii=False, indent=2).encode()
    info = tarfile.TarInfo(name=name)
    info.size = len(payload)
    tar.addfile(info, io.BytesIO(payload))
