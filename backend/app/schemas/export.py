import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.export_job import ExportJobStatus


class ExportJobResponse(BaseModel):
    id: uuid.UUID
    status: ExportJobStatus
    created_at: datetime
    completed_at: datetime | None = None
    error: str | None = None

    model_config = {"from_attributes": True}
