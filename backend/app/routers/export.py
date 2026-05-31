"""Data portability endpoints.

POST /export                   — trigger archive export (ARQ job)
GET  /export/{job_id}          — poll job status
GET  /export/{job_id}/download — stream the completed archive
POST /import-archive           — upload archive and load data (atomic)
"""

from __future__ import annotations

import io
import json
import logging
import pathlib
import tarfile
import uuid
from collections.abc import AsyncGenerator
from typing import Annotated

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.dependencies import get_current_user
from app.models.export_job import ExportJob, ExportJobStatus
from app.models.user import User
from app.schemas.export import ExportJobResponse
from app.workers.export_worker import _EXPORT_TABLES, SCHEMA_VERSION

logger = logging.getLogger(__name__)

router = APIRouter(tags=["portability"])


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]
UserDep = Annotated[User, Depends(get_current_user)]


# ── POST /export ──────────────────────────────────────────────────────────────

@router.post("/export", status_code=status.HTTP_202_ACCEPTED, response_model=ExportJobResponse)
async def trigger_export(current_user: UserDep, session: SessionDep) -> ExportJob:
    """Enqueue a JSON archive export job. Returns job_id to poll."""
    job = ExportJob(user_id=current_user.id)
    session.add(job)
    await session.flush()

    try:
        import arq

        from app.config import settings as cfg
        redis_settings = arq.connections.RedisSettings.from_dsn(cfg.redis_url)
        pool = await arq.create_pool(redis_settings)
        await pool.enqueue_job("export_archive", str(job.id), str(current_user.id))
        await pool.aclose()
    except Exception:
        from app.workers.export_worker import export_archive
        await export_archive({}, str(job.id), str(current_user.id))

    await session.commit()
    await session.refresh(job)
    return job


# ── GET /export/{job_id} ──────────────────────────────────────────────────────

@router.get("/export/{job_id}", response_model=ExportJobResponse)
async def get_export_status(
    job_id: uuid.UUID,
    current_user: UserDep,
    session: SessionDep,
) -> ExportJob:
    result = await session.execute(
        sa.select(ExportJob).where(
            ExportJob.id == job_id,
            ExportJob.user_id == current_user.id,
        )
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Export job not found")
    return job


# ── GET /export/{job_id}/download ─────────────────────────────────────────────

@router.get("/export/{job_id}/download")
async def download_export(
    job_id: uuid.UUID,
    current_user: UserDep,
    session: SessionDep,
) -> StreamingResponse:
    result = await session.execute(
        sa.select(ExportJob).where(
            ExportJob.id == job_id,
            ExportJob.user_id == current_user.id,
        )
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="Export job not found")
    if job.status != ExportJobStatus.done:
        raise HTTPException(status_code=409, detail=f"Export is {job.status}, not done")
    if not job.file_path or not pathlib.Path(job.file_path).exists():
        raise HTTPException(status_code=404, detail="Archive file not found on disk")

    archive_bytes = pathlib.Path(job.file_path).read_bytes()

    return StreamingResponse(
        io.BytesIO(archive_bytes),
        media_type="application/gzip",
        headers={"Content-Disposition": f'attachment; filename="kanakku-export-{job_id}.tar.gz"'},
    )


# ── POST /import-archive ──────────────────────────────────────────────────────

# Load order for import (same as _EXPORT_TABLES but we only need table names)
_IMPORT_TABLE_ORDER = [t for t, _ in _EXPORT_TABLES]

# Tables with a simple user_id column we must remap to the importing user's id
_USER_ID_TABLES = {
    "user_settings", "accounts", "categories", "payees", "tags",
    "subscriptions", "budgets", "piggy_banks", "transactions", "splits",
    "import_batches", "report_dashboards", "llm_activity_logs",
}


@router.post("/import-archive", status_code=status.HTTP_200_OK)
async def import_archive(
    file: UploadFile,
    current_user: UserDep,
    session: SessionDep,
) -> dict[str, object]:
    """
    Upload a JSON archive (tar.gz) and load it into the current user's account.
    Restricted to users who have no existing transactions.
    """
    # Guard: only allow fresh users
    tx_result = await session.execute(
        sa.text("SELECT COUNT(*) FROM transactions WHERE user_id = :uid"),
        {"uid": current_user.id},
    )
    tx_count = tx_result.scalar() or 0
    if tx_count > 0:
        raise HTTPException(
            status_code=409,
            detail="Import is only allowed for users with no existing transactions",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=422, detail="Empty file")

    try:
        buf = io.BytesIO(raw)
        with tarfile.open(fileobj=buf, mode="r:gz") as tar:
            manifest_member = tar.getmember("manifest.json")
            manifest: dict[str, object] = json.loads(
                tar.extractfile(manifest_member).read()  # type: ignore[union-attr]
            )

            if manifest.get("schema_version") != SCHEMA_VERSION:
                raise HTTPException(
                    status_code=422,
                    detail=f"Unsupported archive schema_version: {manifest.get('schema_version')}",
                )

            archived_user_id = str(manifest.get("user_id", ""))
            target_user_id = str(current_user.id)

            # Load all table data from archive
            table_data: dict[str, list[dict[str, object]]] = {}
            for table_name in _IMPORT_TABLE_ORDER:
                fname = f"{table_name}.json"
                try:
                    member = tar.getmember(fname)
                    rows: list[dict[str, object]] = json.loads(
                        tar.extractfile(member).read()  # type: ignore[union-attr]
                    )
                    table_data[table_name] = rows
                except KeyError:
                    table_data[table_name] = []

    except (tarfile.TarError, json.JSONDecodeError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid archive: {exc}") from exc

    # Remap user_id if archiving user != importing user
    if archived_user_id != target_user_id:
        for table_name, rows in table_data.items():
            if table_name in _USER_ID_TABLES:
                for row in rows:
                    if str(row.get("user_id")) == archived_user_id:
                        row["user_id"] = target_user_id

    # Insert all rows in one transaction; detect UUID conflicts
    inserted_counts: dict[str, int] = {}
    try:
        async with session.begin():
            for table_name in _IMPORT_TABLE_ORDER:
                rows = table_data.get(table_name, [])
                if not rows:
                    inserted_counts[table_name] = 0
                    continue

                # Check for UUID conflicts on tables that have an 'id' column
                if rows and "id" in rows[0]:
                    ids = [r["id"] for r in rows if "id" in r]
                    conflict = await session.execute(
                        sa.text(f"SELECT id FROM {table_name} WHERE id = ANY(:ids)"),
                        {"ids": ids},
                    )
                    conflicts = conflict.fetchall()
                    if conflicts:
                        conflict_ids = [str(r[0]) for r in conflicts]
                        raise HTTPException(
                            status_code=409,
                            detail=f"UUID conflict in {table_name}: {conflict_ids[:3]}",
                        )

                for row in rows:
                    cols = ", ".join(row.keys())
                    placeholders = ", ".join(f":{k}" for k in row.keys())
                    await session.execute(
                        sa.text(f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})"),
                        row,
                    )

                inserted_counts[table_name] = len(rows)

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Import archive failed")
        raise HTTPException(status_code=422, detail=f"Import failed: {exc}") from exc

    total = sum(inserted_counts.values())
    return {"imported_tables": inserted_counts, "total_records": total}
