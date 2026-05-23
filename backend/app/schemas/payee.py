import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.payee import PayeeType


class PayeeCreate(BaseModel):
    name: str
    type: PayeeType
    notes: str | None = None
    is_active: bool = True


class PayeePatch(BaseModel):
    name: str | None = None
    type: PayeeType | None = None
    notes: str | None = None
    is_active: bool | None = None


class PayeeResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    type: PayeeType
    notes: str | None
    is_active: bool
    default_category_ids: list[uuid.UUID] = []
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}
