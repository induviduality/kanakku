"""Abstract base interface for LLM clients."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class GPayRecord:
    """A single GPay Takeout transaction record."""
    date: str
    amount: float
    merchant: str
    raw: dict = field(default_factory=dict)


@dataclass
class BankCandidate:
    """A bank transaction candidate for GPay matching."""
    transaction_id: str
    date: str
    amount: float
    description: str


@dataclass
class Match:
    """Result of matching a GPay record to a bank candidate."""
    gpay_index: int
    bank_index: int  # index into the candidate list for this gpay record; -1 = no match


class LLMClient(ABC):
    """Text-only LLM interface for v1. No vision methods."""

    @abstractmethod
    async def suggest_category(
        self,
        payee_name: str,
        description: str,
        available_categories: list[str],
    ) -> str | None:
        """Suggest a category name from available_categories, or None."""

    @abstractmethod
    async def match_gpay_to_bank(
        self,
        gpay_records: list[GPayRecord],
        bank_candidates: list[list[BankCandidate]],
    ) -> list[Match]:
        """For each GPay record, suggest the best bank candidate index.

        gpay_records: N GPay records
        bank_candidates: N lists of bank candidates (one list per GPay record)
        Returns N Match objects (one per GPay record).
        """
