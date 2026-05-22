# Current Task: Task 1.4 — Login, Logout, Me, Refresh

## What I'm implementing
Four auth endpoints: POST /auth/login, POST /auth/logout, GET /auth/me, POST /auth/refresh.
Plus the get_current_user dependency used by all protected endpoints.

## Files I'm working in
backend/app/routers/auth.py  (extend existing)
backend/app/dependencies.py  (get_current_user)
backend/app/schemas/auth.py  (LoginRequest, MeResponse)
backend/tests/test_auth_endpoints.py

## Key constraints to remember
- Login: verify email + password, create Session row (token_hash = SHA-256 of opaque token), return token pair
- Logout: delete Session row for current session
- Me: return current user info (id, email, created_at)
- Refresh: verify refresh token JWT, issue new access token (sliding refresh)
- get_current_user: decode Bearer JWT, load User from DB, 401 if invalid/expired/deleted

## Tests to write first (TDD)
- Login happy path, wrong password 401, unknown email 401
- Logout removes session
- Me returns correct user
- Refresh issues new access token, invalid refresh token 401

## Definition of done
pytest passes for all auth endpoint tests
