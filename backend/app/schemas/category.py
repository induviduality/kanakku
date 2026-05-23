import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.category import CategoryApplicability


class CategoryCreate(BaseModel):
    name: str
    icon: str | None = None
    color: str | None = None
    applicability: CategoryApplicability | None = None


class CategoryPatch(BaseModel):
    name: str | None = None
    icon: str | None = None
    color: str | None = None
    applicability: CategoryApplicability | None = None


class CategoryResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    icon: str | None
    color: str | None
    applicability: CategoryApplicability | None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None

    model_config = {"from_attributes": True}
