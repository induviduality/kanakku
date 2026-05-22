# Completed Milestones

## Task 1.6: Frontend Auth Pages
- lib/auth-storage.ts: access token in memory, refresh token in localStorage; storeTokens/clearAuth helpers
- api/auth.ts: useSetup, useLogin, useAcceptInvite mutations (TanStack Query); fetchInviteInfo query fn; storeTokens on success
- pages/Setup.tsx: email+password form → POST /auth/setup → navigate /
- pages/Login.tsx: email+password form → POST /auth/login → navigate /
- pages/AcceptInvite.tsx: reads token from useSearch; fetches invite info (shows 410/404 errors); pre-fills locked email; POST /auth/accept-invite → navigate /
- components/AuthGuard.tsx: useEffect redirect to /login when not authenticated; renders children when authed
- router.tsx: TanStack Router with /, /setup, /login, /accept-invite routes
- App.tsx: RouterProvider; main.tsx: QueryClientProvider wrapper
- MSW setup: test/handlers.ts, test/server.ts; setup.ts starts/resets/stops server per test
- Tests: 15 passing (5 test files) — Setup (4), Login (3), AcceptInvite (5), AuthGuard (2), App (1)
- bun run test passes, bun run build clean

## Task 1.5: Invite Token System
- POST /auth/invites: auth required, generates secrets.token_urlsafe(32), stores SHA-256 hash, optional email lock, 7-day TTL
- GET /auth/invites/{token}/info: public; 404 unknown, 410 expired/used, 200 with expires_at + email
- POST /auth/accept-invite: validates token (404/410), email match check (400), duplicate email (409), creates user + session, marks used_at
- tests/test_auth_invite.py: 13 integration tests covering all paths

## Task 1.4: Login, Logout, Me, Refresh
- app/dependencies.py: get_current_user — decodes Bearer access JWT, loads User from DB, 401 on invalid/expired/deleted
- POST /auth/login: verifies email+password, creates Session row (token_hash=SHA-256 of refresh token), returns token pair
- POST /auth/logout: requires auth, deletes Session by refresh token hash; 204
- GET /auth/me: returns id, email, created_at for current user
- POST /auth/refresh: verifies refresh JWT + Session row, rotates token (delete old session, issue new), returns new pair
- schemas/auth.py: added LoginRequest, LogoutRequest, RefreshRequest, MeResponse
- tests/test_auth_endpoints.py: 13 integration tests covering all paths (need Postgres)

## Task 1.3: First-Run Setup
- app/routers/auth.py: POST /api/v1/auth/setup — creates first user, returns token pair; 404 once any user exists
- _assert_no_users_exist dependency: counts users via SELECT COUNT(*), raises 404 if > 0
- app/schemas/auth.py: SetupRequest (EmailStr + password), TokenResponse
- app/main.py: auth router included at /api/v1 prefix
- pyproject.toml: pydantic[email] dependency added (needed for EmailStr)
- tests/test_auth_setup.py: 6 integration tests (success, token validity, 404 on repeat, validation errors)

## Task 1.2: Password Hashing & JWT
- app/security/passwords.py: argon2id hash + verify (argon2-cffi)
- app/security/tokens.py: create_access_token (24h), create_refresh_token (30d), decode_token — all HS256 via python-jose; accept optional expires_delta for test overrides
- tests/test_security.py: 9 unit tests (no DB) — hash, verify, roundtrip, expiry, tampering, wrong-secret; all passing

## Task 1.1: Users + Sessions Schema
- app/models/user.py: User (id UUID, email UNIQUE, password_hash, created_at TIMESTAMPTZ, deleted_at nullable)
- app/models/session.py: Session (id UUID, user_id FK→users CASCADE, token_hash UNIQUE, expires_at, created_at)
- app/models/invite_token.py: InviteToken (id UUID, created_by_user_id FK→users CASCADE, token_hash UNIQUE, email nullable, expires_at, used_at nullable, created_at)
- alembic/versions/0001_users_sessions_invite_tokens.py: migration with full upgrade/downgrade
- tests/test_models_users.py: create user, email unique constraint, timestamps, session/invite_token creation
- tests/test_migration.py: synchronous round-trip test (upgrade head + downgrade base)
- conftest.py: added db_tables + db_session fixtures using async_sessionmaker
- Note: tests require a running Postgres; ruff + mypy clean

## Task 0.5: GitHub Actions CI
- .github/workflows/ci.yml: backend (ruff + mypy + pytest) and frontend (lint + test + build) jobs in parallel
- .github/workflows/ci-arm.yml: ARM64 Docker builds via QEMU on push to main
- Backend job has postgres:16 + redis:7 service containers
- Uses astral-sh/setup-uv and oven-sh/setup-bun official actions
- Not verified yet — needs a real PR against main to confirm green

## Task 0.4: Docker Compose Dev Setup
- docker-compose.yml: postgres:16, redis:7, api, worker, frontend, ollama, caddy
- api/worker mount source for hot reload in dev
- env.example: all vars from TDD 4.10 with clear comments
- infra/Makefile: up/down/restart/build/ps/logs/logs-api/logs-worker/migrate/psql/redis-shell/ollama-shell/ollama-init
- infra/scripts/init-ollama.sh: waits for Ollama readiness then pulls model
- Not runtime-tested (no Docker locally); files are deployment-ready

## Task 0.3: Frontend Bootstrap
- Vite + React 19 + TypeScript scaffolded with bun
- Tailwind CSS v4 via @tailwindcss/vite (CSS-first, no config file)
- Radix UI: dialog, dropdown-menu, tabs, toast
- TanStack Query + Router, Recharts, vite-plugin-pwa (disabled)
- Vitest + RTL + jsdom; `bun run test` passes, `bun run build` clean
- src/ structure: api/, components/, pages/, lib/, styles/, test/
- App.tsx: "Kanakku" h1 + Radix Dialog demo with Tailwind
- Dockerfile: multi-stage oven/bun + nginx:alpine (ARM64-compatible)
- Note: use `bun run test` (vitest), NOT `bun test` (bun's native runner)

## Task 0.2: Backend Bootstrap
- pyproject.toml (hatchling build, all deps, dev extras)
- app/main.py — FastAPI app with GET /health → {"status": "ok"}
- app/config.py — pydantic-settings loading all env vars from TDD 4.10
- app/db/session.py — async engine + session factory
- app/db/base.py — SQLAlchemy DeclarativeBase
- alembic.ini + alembic/env.py (async-compatible) + script.py.mako
- tests/conftest.py — async client + db_engine fixtures
- tests/test_health.py + tests/test_db.py
- Dockerfile — multi-stage, python:3.12-slim, ARM64-compatible

## Task 0.1: Monorepo Structure
- Created full directory layout: backend/, frontend/, infra/, .github/workflows/
- Root .gitignore (Python, Node, env files, OS, Docker volumes)
- README.md with 2-sentence project description linking to docs/TDD.md
- MIT LICENSE
- Root CLAUDE.md importing docs/CLAUDE.md via @-import
- infra/docker-compose.yml (postgres, backend, frontend, caddy)
- infra/Caddyfile (reverse proxy skeleton)
- infra/env.example (all env vars from TDD 4.10)
