import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator

from app.models.subscription import BillingCycle


class SubscriptionCreate(BaseModel):
    name: str
    amount: Decimal
    currency: str
    billing_cycle: BillingCycle
    billing_day: int
    last_billed_at: datetime | None = None
    account_id: uuid.UUID
    payment_method_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    is_active: bool = True
    url: str | None = None
    notes: str | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v

    @field_validator("billing_day")
    @classmethod
    def billing_day_positive(cls, v: int) -> int:
        if v < 0:
            raise ValueError("billing_day must be non-negative")
        return v


class SubscriptionPatch(BaseModel):
    name: str | None = None
    amount: Decimal | None = None
    currency: str | None = None
    billing_cycle: BillingCycle | None = None
    billing_day: int | None = None
    last_billed_at: datetime | None = None
    account_id: uuid.UUID | None = None
    payment_method_id: uuid.UUID | None = None
    category_id: uuid.UUID | None = None
    is_active: bool | None = None
    url: str | None = None
    notes: str | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("amount must be positive")
        return v


class SubscriptionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    amount: Decimal
    currency: str
    billing_cycle: BillingCycle
    billing_day: int
    last_billed_at: datetime | None
    account_id: uuid.UUID
    payment_method_id: uuid.UUID | None
    category_id: uuid.UUID | None
    is_active: bool
    url: str | None
    notes: str | None
    next_billing_date: date | None = None
    status: str | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}
