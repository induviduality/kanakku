import uuid
from datetime import datetime

from pydantic import BaseModel


class TagCreate(BaseModel):
    name: str
    color: str | None = None


class TagPatch(BaseModel):
    name: str | None = None
    color: str | None = None


class TagResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    color: str | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}
