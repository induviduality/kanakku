import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator

from app.models.piggy_bank import ContributionType


class PiggyBankCreate(BaseModel):
    name: str
    target_amount: Decimal
    currency: str
    target_date: date | None = None
    notes: str | None = None

    @field_validator("target_amount")
    @classmethod
    def target_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("target_amount must be positive")
        return v


class PiggyBankPatch(BaseModel):
    name: str | None = None
    target_amount: Decimal | None = None
    currency: str | None = None
    target_date: date | None = None
    notes: str | None = None

    @field_validator("target_amount")
    @classmethod
    def target_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("target_amount must be positive")
        return v


class PiggyBankResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    target_amount: Decimal
    currency: str
    current_amount: Decimal
    target_date: date | None
    notes: str | None
    is_completed: bool
    progress_pct: float
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}


class ContributionCreate(BaseModel):
    transaction_id: uuid.UUID
    contribution_type: ContributionType
    amount: Decimal
    date: date
    notes: str | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class ContributionResponse(BaseModel):
    id: uuid.UUID
    piggy_bank_id: uuid.UUID
    transaction_id: uuid.UUID
    contribution_type: ContributionType
    amount: Decimal
    date: date
    notes: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
