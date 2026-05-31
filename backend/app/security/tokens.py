import uuid
from datetime import UTC, datetime, timedelta

from jose import jwt

from app.config import settings

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
REFRESH_TOKEN_EXPIRES = timedelta(days=30)


def create_access_token(
    user_id: uuid.UUID, expires_delta: timedelta | None = None
) -> str:
    delta = expires_delta if expires_delta is not None else ACCESS_TOKEN_EXPIRES
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id), "type": "access",
        "iat": now, "exp": now + delta,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def create_refresh_token(
    user_id: uuid.UUID, expires_delta: timedelta | None = None
) -> str:
    delta = expires_delta if expires_delta is not None else REFRESH_TOKEN_EXPIRES
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id), "type": "refresh",
        "iat": now, "exp": now + delta,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, object]:
    """Decode and validate a JWT. Raises JWTError on invalid/expired tokens."""
    result: dict[str, object] = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    return result
