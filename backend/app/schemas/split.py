import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator

from app.models.split import SplitShareStatus


class SplitShareCreate(BaseModel):
    payee_id: uuid.UUID | None = None
    amount: Decimal
    notes: str | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class ForgivenShareCreate(BaseModel):
    payee_id: uuid.UUID | None = None
    amount: Decimal
    notes: str | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class BundleCreate(BaseModel):
    expense_transaction_id: uuid.UUID
    income_transaction_ids: list[uuid.UUID] = []
    forgiven_shares: list[ForgivenShareCreate] = []
    notes: str | None = None


class SplitCreate(BaseModel):
    expense_transaction_id: uuid.UUID
    notes: str | None = None
    shares: list[SplitShareCreate]

    @field_validator("shares")
    @classmethod
    def shares_not_empty(cls, v: list[SplitShareCreate]) -> list[SplitShareCreate]:
        if not v:
            raise ValueError("shares must not be empty")
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
    expense_transaction_id: uuid.UUID
    notes: str | None
    shares: list[SplitShareResponse]
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}
