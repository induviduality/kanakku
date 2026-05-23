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
    settlement_transaction_id: uuid.UUID


class SplitShareResponse(BaseModel):
    id: uuid.UUID
    split_id: uuid.UUID
    payee_id: uuid.UUID | None
    amount: Decimal
    status: SplitShareStatus
    settled_at: datetime | None
    settlement_transaction_id: uuid.UUID | None
    forgiven_at: datetime | None
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
