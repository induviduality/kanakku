import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.account import AccountType


class AccountCreate(BaseModel):
    name: str
    type: AccountType
    currency: str | None = None  # defaults to user's primary_currency if omitted
    opening_balance: Decimal = Decimal("0")
    is_active: bool = True


class AccountPatch(BaseModel):
    name: str | None = None
    type: AccountType | None = None
    currency: str | None = None
    is_active: bool | None = None


class AccountResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    type: AccountType
    currency: str
    opening_balance: Decimal
    current_balance: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}
