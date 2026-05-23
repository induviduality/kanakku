"""GPay Takeout enrichment endpoints.

POST /imports/gpay-takeout          — upload Takeout JSON, run matching
GET  /imports/gpay-matches          — list all GPayMatch rows for user
GET  /imports/gpay-matches/pending  — pending (ambiguous) matches only
GET  /imports/gpay-matches/orphans  — orphan (unmatched) records
POST /imports/gpay-matches/{id}/resolve — choose a transaction for ambiguous match
"""

import uuid
from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory
from app.dependencies import get_current_user
from app.models.gpay_match import GPayMatch, GPayMatchStatus
from app.models.transaction import Transaction
from app.schemas.gpay import GPayMatchResponse, GPayResolveRequest, GPayUploadResponse
from app.services.gpay_matcher import match_records, parse_takeout, persist_results
from app.models.user import User

router = APIRouter(prefix="/imports", tags=["gpay"])


async def _get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(_get_session)]
UserDep = Annotated[User, Depends(get_current_user)]


# ── POST /imports/gpay-takeout ────────────────────────────────────────────────

@router.post("/gpay-takeout", response_model=GPayUploadResponse)
async def upload_gpay_takeout(
    file: UploadFile = File(...),
    current_user: UserDep = None,  # type: ignore[assignment]
    session: SessionDep = None,  # type: ignore[assignment]
) -> GPayUploadResponse:
    content = await file.read()
    try:
        records = parse_takeout(content)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid Takeout JSON: {exc}") from exc

    if not records:
        raise HTTPException(status_code=422, detail="No valid GPay records found in file")

    results = await match_records(session, records, current_user.id)
    matches = await persist_results(session, results, current_user.id)

    return GPayUploadResponse(
        parsed=len(records),
        auto_linked=sum(1 for m in matches if m.status == GPayMatchStatus.auto_linked),
        pending=sum(1 for m in matches if m.status == GPayMatchStatus.pending),
        orphans=sum(1 for m in matches if m.status == GPayMatchStatus.orphan),
        matches=[GPayMatchResponse.model_validate(m) for m in matches],
    )


# ── GET /imports/gpay-matches ─────────────────────────────────────────────────

@router.get("/gpay-matches", response_model=list[GPayMatchResponse])
async def list_gpay_matches(
    current_user: UserDep,
    session: SessionDep,
) -> list[GPayMatchResponse]:
    result = await session.execute(
        select(GPayMatch)
        .where(GPayMatch.user_id == current_user.id)
        .order_by(GPayMatch.created_at.desc())
    )
    return [GPayMatchResponse.model_validate(m) for m in result.scalars().all()]


@router.get("/gpay-matches/pending", response_model=list[GPayMatchResponse])
async def list_pending_gpay_matches(
    current_user: UserDep,
    session: SessionDep,
) -> list[GPayMatchResponse]:
    result = await session.execute(
        select(GPayMatch)
        .where(
            GPayMatch.user_id == current_user.id,
            GPayMatch.status == GPayMatchStatus.pending,
        )
        .order_by(GPayMatch.created_at.desc())
    )
    return [GPayMatchResponse.model_validate(m) for m in result.scalars().all()]


@router.get("/gpay-matches/orphans", response_model=list[GPayMatchResponse])
async def list_orphan_gpay_matches(
    current_user: UserDep,
    session: SessionDep,
) -> list[GPayMatchResponse]:
    result = await session.execute(
        select(GPayMatch)
        .where(
            GPayMatch.user_id == current_user.id,
            GPayMatch.status == GPayMatchStatus.orphan,
        )
        .order_by(GPayMatch.created_at.desc())
    )
    return [GPayMatchResponse.model_validate(m) for m in result.scalars().all()]


# ── POST /imports/gpay-matches/{id}/resolve ───────────────────────────────────

@router.post("/gpay-matches/{match_id}/resolve", response_model=GPayMatchResponse)
async def resolve_gpay_match(
    match_id: uuid.UUID,
    body: GPayResolveRequest,
    current_user: UserDep,
    session: SessionDep,
) -> GPayMatchResponse:
    result = await session.execute(
        select(GPayMatch).where(
            GPayMatch.id == match_id,
            GPayMatch.user_id == current_user.id,
        )
    )
    match = result.scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=404, detail="GPay match not found")
    if match.status != GPayMatchStatus.pending:
        raise HTTPException(status_code=409, detail="Match is not in pending state")

    # Verify the chosen transaction belongs to this user
    txn_result = await session.execute(
        select(Transaction).where(
            Transaction.id == body.chosen_transaction_id,
            Transaction.user_id == current_user.id,
        )
    )
    txn = txn_result.scalar_one_or_none()
    if txn is None:
        raise HTTPException(status_code=404, detail="Transaction not found")

    match.chosen_transaction_id = body.chosen_transaction_id
    match.status = GPayMatchStatus.resolved

    # Enrich bank transaction with merchant name from GPay data
    merchant = match.gpay_data.get("merchant") or match.gpay_data.get("Description") or ""
    if merchant and not txn.notes:
        txn.notes = f"GPay merchant: {merchant}"

    await session.commit()
    await session.refresh(match)
    return GPayMatchResponse.model_validate(match)
