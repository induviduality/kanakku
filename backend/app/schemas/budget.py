import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, field_validator

from app.models.budget import BudgetPeriod, BudgetType


class EditScope(StrEnum):
    current_and_future = "current_and_future"
    future_only = "future_only"


class DeleteScope(StrEnum):
    instance = "instance"
    current_and_future = "current_and_future"
    future_only = "future_only"


class BudgetCreate(BaseModel):
    name: str
    amount: Decimal
    currency: str
    period: BudgetPeriod | None = None
    start_date: date | None = None
    end_date: date | None = None
    type: BudgetType
    recurrence_rule: str | None = None
    is_active: bool = True
    notes: str | None = None
    category_ids: list[uuid.UUID] = []
    activated_at: datetime | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class BudgetPatch(BaseModel):
    name: str | None = None
    amount: Decimal | None = None
    currency: str | None = None
    period: BudgetPeriod | None = None
    start_date: date | None = None
    end_date: date | None = None
    recurrence_rule: str | None = None
    is_active: bool | None = None
    notes: str | None = None
    category_ids: list[uuid.UUID] | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("amount must be positive")
        return v


class BudgetResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    amount: Decimal
    currency: str
    period: BudgetPeriod | None
    start_date: date | None
    end_date: date | None
    type: BudgetType
    recurrence_rule: str | None
    parent_budget_id: uuid.UUID | None
    is_modified_instance: bool
    is_active: bool
    notes: str | None
    category_ids: list[uuid.UUID]
    current_spent: Decimal = Decimal("0")
    activated_at: datetime | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}
