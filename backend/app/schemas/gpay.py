import uuid
from datetime import datetime

from pydantic import BaseModel

from app.models.gpay_match import GPayMatchStatus


class GPayMatchResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    gpay_data: dict[str, object]
    candidate_transaction_ids: list[uuid.UUID]
    chosen_transaction_id: uuid.UUID | None
    llm_suggestion_id: uuid.UUID | None
    status: GPayMatchStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class GPayResolveRequest(BaseModel):
    chosen_transaction_id: uuid.UUID


class GPayUploadResponse(BaseModel):
    parsed: int
    auto_linked: int
    pending: int
    orphans: int
    matches: list[GPayMatchResponse]
