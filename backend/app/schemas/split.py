import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator, model_validator

from app.models.split import SplitShareStatus


class SplitShareCreate(BaseModel):
    payee_id: uuid.UUID | None = None
    amount: Decimal
    notes: str | None = None
    # Income transactions that settle this share; each is credited at its full amount.
    settlement_transaction_ids: list[uuid.UUID] = []
    # Amount forgiven on this share (reduces what the payee owes; increases net expense).
    forgiven_amount: Decimal = Decimal("0")

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v

    @field_validator("forgiven_amount")
    @classmethod
    def forgiven_non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("forgiven_amount must be non-negative")
        return v

    @model_validator(mode="after")
    def own_share_has_no_settlement_or_forgiveness(self) -> "SplitShareCreate":
        if self.payee_id is None:
            if self.settlement_transaction_ids:
                raise ValueError("the user's own share cannot have settlement transactions")
            if self.forgiven_amount > 0:
                raise ValueError("the user's own share cannot be forgiven")
        return self


class ForgivenShareCreate(BaseModel):
    payee_id: uuid.UUID | None = None
    amount: Decimal | str
    notes: str | None = None

    @field_validator("amount", mode="before")
    @classmethod
    def coerce_amount(cls, v: object) -> Decimal:
        return Decimal(str(v))

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class BundleCreate(BaseModel):
    expense_transaction_ids: list[uuid.UUID]
    income_transaction_ids: list[uuid.UUID] = []
    forgiven_shares: list[ForgivenShareCreate] = []
    notes: str | None = None

    @field_validator("expense_transaction_ids")
    @classmethod
    def at_least_one_expense(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        if not v:
            raise ValueError("expense_transaction_ids must not be empty")
        return v


class SplitCreate(BaseModel):
    expense_transaction_ids: list[uuid.UUID]
    notes: str | None = None
    shares: list[SplitShareCreate]

    @field_validator("expense_transaction_ids")
    @classmethod
    def at_least_one_expense(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        if not v:
            raise ValueError("expense_transaction_ids must not be empty")
        return v

    @field_validator("shares")
    @classmethod
    def shares_not_empty(cls, v: list[SplitShareCreate]) -> list[SplitShareCreate]:
        if not v:
            raise ValueError("shares must not be empty")
        return v

    @model_validator(mode="after")
    def no_duplicate_payees(self) -> "SplitCreate":
        non_null = [s.payee_id for s in self.shares if s.payee_id is not None]
        if len(non_null) != len(set(non_null)):
            raise ValueError("each payee may appear in at most one share per split")
        null_count = sum(1 for s in self.shares if s.payee_id is None)
        if null_count > 1:
            raise ValueError("only one share without a payee (user's own share) is allowed per split")
        return self

    @model_validator(mode="after")
    def no_duplicate_settlements(self) -> "SplitCreate":
        all_ids = [tid for s in self.shares for tid in s.settlement_transaction_ids]
        if len(all_ids) != len(set(all_ids)):
            raise ValueError("a settlement transaction may be linked to at most one share")
        return self


class SplitSharePatch(BaseModel):
    """Fields that may be updated on an existing share. Omit a field to leave it unchanged."""
    payee_id: uuid.UUID | None = None
    amount: Decimal | None = None
    notes: str | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("amount must be positive")
        return v


class SettleRequest(BaseModel):
    """Link an income transaction to a share. amount defaults to the full transaction amount."""
    transaction_id: uuid.UUID
    amount: Decimal | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("amount must be positive")
        return v


class ForgiveRequest(BaseModel):
    """Set the forgiven_amount for a share (replaces any prior value)."""
    amount: Decimal

    @field_validator("amount")
    @classmethod
    def amount_non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("amount must be non-negative")
        return v


class SplitShareSettlementResponse(BaseModel):
    id: uuid.UUID
    share_id: uuid.UUID
    transaction_id: uuid.UUID
    amount: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


class SplitShareResponse(BaseModel):
    id: uuid.UUID
    split_id: uuid.UUID
    payee_id: uuid.UUID | None
    amount: Decimal
    status: SplitShareStatus
    forgiven_amount: Decimal
    paid_amount: Decimal
    settlements: list[SplitShareSettlementResponse]
    notes: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SplitResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    expense_transaction_ids: list[uuid.UUID]
    expense_date: datetime
    notes: str | None
    shares: list[SplitShareResponse]
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}
