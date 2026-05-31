"""NullClient — safe no-op implementation for testing and LLM_BACKEND=none."""

from app.llm.base import LLMClient


class NullClient(LLMClient):
    """Returns None / empty results. Used when LLM_BACKEND=none or in tests."""

    async def suggest_category(
        self,
        payee_name: str,
        description: str,
        available_categories: list[str],
    ) -> str | None:
        return None
