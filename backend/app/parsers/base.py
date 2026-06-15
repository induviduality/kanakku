"""Abstract base interface for bank statement PDF parsers."""

import io
from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal


@dataclass
class StatementHeader:
    """Summary information extracted from the statement header."""
    opening_balance: Decimal | None = None
    closing_balance: Decimal | None = None
    statement_from: str | None = None
    statement_to: str | None = None


@dataclass
class ParsedRecord:
    """A single transaction candidate extracted from a bank statement."""
    date: str
    description: str
    amount: Decimal
    type: str  # "expense", "income", or "opening_balance"
    balance: Decimal | None = None
    reference: str | None = None
    raw_text: str | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "date": self.date,
            "description": self.description,
            "amount": str(self.amount),
            "type": self.type,
            "balance": str(self.balance) if self.balance is not None else None,
            "reference": self.reference,
            "raw_text": self.raw_text,
        }


class BaseParser(ABC):
    """Every bank parser implements this interface."""

    @classmethod
    @abstractmethod
    def can_parse(cls, pdf: io.BytesIO) -> bool:
        """Return True if this parser recognises the PDF (e.g. by header text)."""

    @abstractmethod
    def parse(self, pdf: io.BytesIO) -> list[ParsedRecord]:
        """Extract all transaction records from the PDF."""

    def extract_statement_header(self, pdf: io.BytesIO) -> StatementHeader:
        """Extract opening/closing balance from the statement header.

        Parsers that support balance verification should override this.
        """
        return StatementHeader()
