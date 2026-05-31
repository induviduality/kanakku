"""ARQ worker job for async PDF import processing."""

from __future__ import annotations

import io
import logging
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

import sqlalchemy as sa

from app.db.session import async_session_factory
from app.models.import_batch import (
    ImportBatch,
    ImportBatchStatus,
    RawImportRecord,
    RecordConfidence,
    RecordMatchType,
    RecordStatus,
)
from app.parsers.registry import detect_parser
from app.services.balance_verifier import verify_balance
from app.services.dedup import find_duplicates

logger = logging.getLogger(__name__)


async def process_pdf_import(
    ctx: dict[str, object],
    batch_id: str,
    pdf_bytes: bytes,
    password: str | None,
) -> None:
    """ARQ job: unlock PDF, parse, deduplicate, store raw records, update batch status."""
    bid = uuid.UUID(batch_id)
    async with async_session_factory() as session:
        result = await session.execute(
            sa.select(ImportBatch).where(ImportBatch.id == bid)
        )
        batch = result.scalar_one_or_none()
        if batch is None:
            logger.error("Batch %s not found", batch_id)
            return

        batch.status = ImportBatchStatus.processing
        await session.commit()

        try:
            pdf_file = io.BytesIO(pdf_bytes)
            unlocked = _unlock_pdf(pdf_file, password)

            parser = detect_parser(unlocked)
            if parser is None:
                batch.status = ImportBatchStatus.failed
                await session.commit()
                return

            unlocked.seek(0)
            candidates = parser.parse(unlocked)

            # Balance verification
            unlocked.seek(0)
            header = parser.extract_statement_header(unlocked)
            batch.verification_status = verify_balance(header, candidates)

            # Deduplication
            existing_txns = await _load_existing_transactions(
                session, batch.user_id, batch.account_id
            )
            for candidate in candidates:
                parsed = candidate.to_dict()
                dupes = find_duplicates(parsed, existing_txns)
                if dupes:
                    match_type = RecordMatchType.duplicate
                    confidence = RecordConfidence.high
                    rec_status = RecordStatus.duplicate
                    # Store matched IDs so the UI can show what was matched
                    parsed["_duplicate_transaction_ids"] = [d["id"] for d in dupes]
                else:
                    match_type = RecordMatchType.new
                    confidence = RecordConfidence.high
                    rec_status = RecordStatus.pending

                record = RawImportRecord(
                    batch_id=bid,
                    raw_text=candidate.raw_text,
                    parsed_json=parsed,
                    status=rec_status,
                    confidence=confidence,
                    match_type=match_type,
                )
                session.add(record)

            batch.total_parsed = len(candidates)
            batch.total_confirmed = 0
            batch.total_rejected = 0
            batch.status = ImportBatchStatus.completed
            batch.completed_at = datetime.now(UTC)

            await session.commit()

        except Exception:
            logger.exception("PDF import failed for batch %s", batch_id)
            batch.status = ImportBatchStatus.failed
            await session.commit()
            raise


def _unlock_pdf(pdf_file: io.BytesIO, password: str | None) -> io.BytesIO:
    """Use pikepdf to decrypt a potentially password-protected PDF."""
    import pikepdf

    pdf_file.seek(0)
    try:
        pdf = pikepdf.open(pdf_file, password=password or "")
    except pikepdf.PasswordError as e:
        raise ValueError("Incorrect PDF password") from e
    except pikepdf.PdfError as e:
        raise ValueError(f"Corrupted or invalid PDF: {e}") from e

    output = io.BytesIO()
    pdf.save(output)
    output.seek(0)
    return output


async def _load_existing_transactions(
    session: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID | None
) -> list[dict[str, object]]:
    """Load recent transactions for deduplication comparison."""
    from app.models.transaction import Transaction

    query = sa.select(
        Transaction.id,
        Transaction.transacted_at,
        Transaction.amount,
        Transaction.description,
        Transaction.account_id,
    ).where(
        Transaction.user_id == user_id,
        Transaction.deleted_at.is_(None),
    )
    if account_id is not None:
        query = query.where(Transaction.account_id == account_id)

    result = await session.execute(query)
    rows = result.all()
    return [
        {
            "id": str(row.id),
            "transacted_at": row.transacted_at,
            "amount": row.amount,
            "description": row.description,
            "account_id": str(row.account_id),
        }
        for row in rows
    ]
