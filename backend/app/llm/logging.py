"""Decorator and helpers for logging LLM calls to llm_activity_log."""

import time
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.llm_activity_log import LLMActivityLog


async def log_llm_call(
    *,
    session: AsyncSession,
    user_id: uuid.UUID,
    operation: str,
    backend: str,
    model: str,
    payload_summary: dict[str, Any],
    duration_ms: int,
    succeeded: bool,
) -> None:
    """Persist a single LLM call record."""
    entry = LLMActivityLog(
        user_id=user_id,
        operation=operation,
        payload_summary=payload_summary,
        backend=backend,
        model=model,
        duration_ms=duration_ms,
        succeeded=succeeded,
    )
    session.add(entry)
    await session.commit()


def _payload_for_suggest_category(
    payee_name: str, description: str, available_categories: list[str]
) -> dict[str, Any]:
    return {
        "payee": payee_name,
        "description_length": len(description),
        "category_count": len(available_categories),
    }


def _payload_for_match_gpay(
    gpay_count: int,
    candidate_count: int,
) -> dict[str, Any]:
    return {
        "gpay_count": gpay_count,
        "candidate_count": candidate_count,
    }


class LoggingLLMClient:
    """Wraps any LLMClient and logs every call to llm_activity_log."""

    def __init__(
        self,
        inner: Any,
        session: AsyncSession,
        user_id: uuid.UUID,
        backend: str,
        model: str,
    ) -> None:
        self._inner = inner
        self._session = session
        self._user_id = user_id
        self._backend = backend
        self._model = model

    async def suggest_category(
        self,
        payee_name: str,
        description: str,
        available_categories: list[str],
    ) -> str | None:
        t0 = time.monotonic()
        succeeded = False
        result: str | None = None
        try:
            result = await self._inner.suggest_category(payee_name, description, available_categories)
            succeeded = True
            return result
        finally:
            ms = int((time.monotonic() - t0) * 1000)
            await log_llm_call(
                session=self._session,
                user_id=self._user_id,
                operation="suggest_category",
                backend=self._backend,
                model=self._model,
                payload_summary=_payload_for_suggest_category(
                    payee_name, description, available_categories
                ),
                duration_ms=ms,
                succeeded=succeeded,
            )

    async def match_gpay_to_bank(
        self,
        gpay_records: list[Any],
        bank_candidates: list[list[Any]],
    ) -> list[Any]:
        t0 = time.monotonic()
        succeeded = False
        try:
            result = await self._inner.match_gpay_to_bank(gpay_records, bank_candidates)
            succeeded = True
            return result  # type: ignore[no-any-return]
        finally:
            ms = int((time.monotonic() - t0) * 1000)
            total_candidates = sum(len(c) for c in bank_candidates)
            await log_llm_call(
                session=self._session,
                user_id=self._user_id,
                operation="match_gpay_to_bank",
                backend=self._backend,
                model=self._model,
                payload_summary=_payload_for_match_gpay(len(gpay_records), total_candidates),
                duration_ms=ms,
                succeeded=succeeded,
            )
