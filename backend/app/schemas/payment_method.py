import uuid
from datetime import datetime

from pydantic import BaseModel, model_validator

from app.models.payment_method import PaymentMethodType


class PaymentMethodCreate(BaseModel):
    type: PaymentMethodType
    name: str
    upi_app: str | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def validate_upi_app(self) -> "PaymentMethodCreate":
        if self.type == PaymentMethodType.upi and not self.upi_app:
            raise ValueError("upi_app is required when type is upi")
        if self.type != PaymentMethodType.upi and self.upi_app is not None:
            raise ValueError("upi_app is only allowed when type is upi")
        return self


class PaymentMethodPatch(BaseModel):
    name: str | None = None
    upi_app: str | None = None
    is_active: bool | None = None


class PaymentMethodResponse(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    type: PaymentMethodType
    name: str
    upi_app: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}
