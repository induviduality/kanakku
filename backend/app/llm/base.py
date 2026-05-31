"""Abstract base interface for LLM clients."""

from abc import ABC, abstractmethod


class LLMClient(ABC):
    """Text-only LLM interface. No vision methods."""

    @abstractmethod
    async def suggest_category(
        self,
        payee_name: str,
        description: str,
        available_categories: list[str],
    ) -> str | None:
        """Suggest a category name from available_categories, or None."""
