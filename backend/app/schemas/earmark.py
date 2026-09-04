import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


class EarmarkCreate(BaseModel):
    name: str
    amount: Decimal
    currency: str
    account_id: uuid.UUID | None = None
    piggy_bank_id: uuid.UUID | None = None
    icon: str | None = None
    color: str | None = None
    notes: str | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class EarmarkPatch(BaseModel):
    name: str | None = None
    amount: Decimal | None = None
    currency: str | None = None
    account_id: uuid.UUID | None = None
    piggy_bank_id: uuid.UUID | None = None
    icon: str | None = None
    color: str | None = None
    notes: str | None = None
    is_active: bool | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("amount must be positive")
        return v


class EarmarkResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    amount: Decimal
    currency: str
    account_id: uuid.UUID | None
    account_name: str | None = None
    piggy_bank_id: uuid.UUID | None
    piggy_bank_name: str | None = None
    icon: str | None
    color: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}


class EarmarkSummaryItem(BaseModel):
    id: uuid.UUID
    name: str
    amount: Decimal
    account_name: str | None
    piggy_bank_name: str | None
