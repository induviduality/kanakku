import uuid
from datetime import datetime

from pydantic import BaseModel


class SettingsResponse(BaseModel):
    user_id: uuid.UUID
    primary_currency: str
    timezone: str
    date_format: str
    number_format: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class SettingsPatch(BaseModel):
    primary_currency: str | None = None
    timezone: str | None = None
    date_format: str | None = None
    number_format: str | None = None
