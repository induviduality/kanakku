import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator

from app.models.transaction import SpendingClassification, TransactionType


class TransactionCreate(BaseModel):
    type: TransactionType
    transacted_at: datetime
    amount: Decimal
    currency: str | None = None  # defaults to account's currency
    description: str | None = None
    notes: str | None = None
    external_ref: str | None = None
    account_id: uuid.UUID
    payment_method_id: uuid.UUID | None = None
    payee_id: uuid.UUID | None = None
    to_account_id: uuid.UUID | None = None
    to_amount: Decimal | None = None
    to_currency: str | None = None
    category_ids: list[uuid.UUID] = []
    tag_ids: list[uuid.UUID] = []
    budget_ids: list[uuid.UUID] = []
    subscription_id: uuid.UUID | None = None
    spending_classification: SpendingClassification | None = None
    piggy_bank_id: uuid.UUID | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be positive")
        return v


class TransactionPatch(BaseModel):
    type: TransactionType | None = None
    transacted_at: datetime | None = None
    amount: Decimal | None = None
    currency: str | None = None
    description: str | None = None
    notes: str | None = None
    external_ref: str | None = None
    account_id: uuid.UUID | None = None
    payment_method_id: uuid.UUID | None = None
    payee_id: uuid.UUID | None = None
    to_account_id: uuid.UUID | None = None
    to_amount: Decimal | None = None
    to_currency: str | None = None
    category_ids: list[uuid.UUID] | None = None
    tag_ids: list[uuid.UUID] | None = None
    budget_ids: list[uuid.UUID] | None = None
    subscription_id: uuid.UUID | None = None
    spending_classification: SpendingClassification | None = None
    piggy_bank_id: uuid.UUID | None = None

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: Decimal | None) -> Decimal | None:
        if v is not None and v <= 0:
            raise ValueError("amount must be positive")
        return v


class TransactionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    type: TransactionType
    transacted_at: datetime
    amount: Decimal
    currency: str
    description: str | None
    notes: str | None
    external_ref: str | None
    account_id: uuid.UUID
    payment_method_id: uuid.UUID | None
    payment_method_name: str | None  # denormalized for display
    payee_id: uuid.UUID | None
    to_account_id: uuid.UUID | None
    to_amount: Decimal | None
    to_currency: str | None
    subscription_id: uuid.UUID | None
    import_record_id: uuid.UUID | None
    split_id: uuid.UUID | None  # set if this transaction is a split parent
    is_split: bool  # True if this transaction has an associated split
    spending_classification: SpendingClassification | None
    piggy_bank_id: uuid.UUID | None
    category_ids: list[uuid.UUID]
    tag_ids: list[uuid.UUID]
    budget_ids: list[uuid.UUID]
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    next_cursor: str | None
    total: int
    total_inflow: Decimal
    total_outflow: Decimal
