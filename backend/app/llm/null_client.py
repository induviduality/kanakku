"""NullClient — safe no-op implementation for testing and LLM_BACKEND=none."""

from app.llm.base import BankCandidate, GPayRecord, LLMClient, Match


class NullClient(LLMClient):
    """Returns None / empty results. Used when LLM_BACKEND=none or in tests."""

    async def suggest_category(
        self,
        payee_name: str,
        description: str,
        available_categories: list[str],
    ) -> str | None:
        return None

    async def match_gpay_to_bank(
        self,
        gpay_records: list[GPayRecord],
        bank_candidates: list[list[BankCandidate]],
    ) -> list[Match]:
        return [Match(gpay_index=i, bank_index=-1) for i in range(len(gpay_records))]
