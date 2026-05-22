"""Pure unit tests for password hashing and JWT — no DB required."""

import uuid
from datetime import timedelta

import pytest
from jose import JWTError

from app.security.passwords import hash_password, verify_password
from app.security.tokens import (
    create_access_token,
    create_refresh_token,
    decode_token,
)


def test_hash_differs_from_plain() -> None:
    hashed = hash_password("secret")
    assert hashed != "secret"


def test_verify_correct_password() -> None:
    hashed = hash_password("correct")
    assert verify_password("correct", hashed) is True


def test_verify_wrong_password() -> None:
    hashed = hash_password("correct")
    assert verify_password("wrong", hashed) is False


def test_same_password_produces_different_hashes() -> None:
    h1 = hash_password("same")
    h2 = hash_password("same")
    assert h1 != h2


def test_access_token_roundtrip() -> None:
    uid = uuid.uuid4()
    token = create_access_token(uid)
    payload = decode_token(token)
    assert payload["sub"] == str(uid)
    assert payload["type"] == "access"


def test_refresh_token_roundtrip() -> None:
    uid = uuid.uuid4()
    token = create_refresh_token(uid)
    payload = decode_token(token)
    assert payload["sub"] == str(uid)
    assert payload["type"] == "refresh"


def test_expired_token_raises() -> None:
    uid = uuid.uuid4()
    token = create_access_token(uid, expires_delta=timedelta(seconds=-1))
    with pytest.raises(JWTError):
        decode_token(token)


def test_tampered_token_raises() -> None:
    uid = uuid.uuid4()
    token = create_access_token(uid)
    tampered = token[:-4] + "xxxx"
    with pytest.raises(JWTError):
        decode_token(tampered)


def test_token_signed_with_wrong_secret_raises() -> None:
    uid = uuid.uuid4()
    from jose import jwt

    token = jwt.encode(
        {"sub": str(uid), "type": "access"},
        "wrong-secret",
        algorithm="HS256",
    )
    with pytest.raises(JWTError):
        decode_token(token)
