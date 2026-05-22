# Current Task: Task 1.2 — Password Hashing & JWT

## What I'm implementing
Password hashing with argon2id and JWT token generation/validation.

## Files I'm working in
backend/app/security/passwords.py
backend/app/security/tokens.py
backend/tests/test_security.py

## Key constraints to remember
- argon2id for password hashing (argon2-cffi installed)
- JWT HS256 using python-jose
- Access token: 24h expiry
- Refresh token: 30d expiry
- JWT secret from settings.jwt_secret

## Tests to write first (TDD)
- test_security.py: hash + verify, token roundtrip, expiry check, tampering detection

## Definition of done
pytest passes for security module tests
