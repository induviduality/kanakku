# Current Task: Task 1.5 — Invite Token System

## What I'm implementing
Three endpoints for the invite token flow:
- POST /auth/invites — create an invite token (auth required)
- GET /auth/invites/{token}/info — get invite metadata (public)
- POST /auth/accept-invite — redeem invite, create new user, return token pair

## Files I'm working in
backend/app/routers/auth.py  (extend)
backend/app/schemas/auth.py  (InviteCreateRequest, InviteInfoResponse, AcceptInviteRequest)
backend/tests/test_auth_invite.py

## Key constraints to remember
- Tokens stored hashed (SHA-256), plain token only in response URL / body
- Token is a URL-safe random string (secrets.token_urlsafe)
- expires_at: default 7 days from creation
- Single-use: used_at set on redemption, subsequent redemption → 410 Gone
- Email field optional on creation; if set, AcceptInvite must match it
- Info endpoint returns: expires_at, email (if set), already_used bool
- No public signup — only via valid, unexpired, unused invite token

## Tests to write first (TDD)
- Create invite (auth required), unauthenticated → 401
- Info: valid token, expired token → 410, used token → 410, unknown → 404
- Accept: success creates user + session + tokens, duplicate email 409,
  wrong email 400, expired → 410, already used → 410

## Definition of done
pytest passes for all invite tests
