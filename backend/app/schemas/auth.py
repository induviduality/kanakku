import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr


class SetupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class MeResponse(BaseModel):
    id: uuid.UUID
    email: str
    created_at: datetime


class InviteCreateRequest(BaseModel):
    email: EmailStr | None = None


class InviteCreateResponse(BaseModel):
    token: str
    expires_at: datetime


class InviteInfoResponse(BaseModel):
    expires_at: datetime
    email: str | None


class AcceptInviteRequest(BaseModel):
    token: str
    email: EmailStr
    password: str
