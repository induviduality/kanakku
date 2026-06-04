# Dev Mode

Dev mode is controlled by a single env var: `DEV_MODE=true`.

## What it does

When `DEV_MODE=true` the backend:
- Reseeds the database with fixture data on every startup (idempotent — safe to restart freely).
- Enables `GET /api/v1/auth/dev-login` which logs in as the seed user without credentials (no password needed).

The frontend reads `VITE_DEV_MODE` (build-time) to adjust auth behaviour:
- `bypass-auth` — auto-logs in via `/auth/dev-login` on app load, skipping the login page. Requires `DEV_MODE=true` on the backend.
- `seeded` — shows the login page with dev credentials pre-filled; signup disabled.
- _(unset)_ — full production behaviour.

## Dev credentials

```
Email:    dev@kanakku.com
Password: dev-password
```

These match `DEV_USER_EMAIL` / `DEV_USER_PASSWORD` in `backend/app/dev_seed.py`.

## Local dev (no Docker)

Set in `backend/.env`:
```dotenv
DEV_MODE=true
```

Then start the backend as usual:
```bash
cd backend
uvicorn app.main:app --reload --port 8765
```

Log in at `http://localhost:5173` with the dev credentials above, or call the dev-login endpoint directly:
```bash
curl -X GET http://localhost:8765/api/v1/auth/dev-login
# Returns {"access_token": "...", "refresh_token": "..."}
```

## Docker (full stack)

Set in `infra/.env`:
```dotenv
DEV_MODE=true
VITE_DEV_MODE=bypass-auth   # optional: skip login page
VITE_DEV_EMAIL=dev@kanakku.com
VITE_DEV_PASSWORD=dev-password
```

Then:
```bash
cd infra
docker compose up
```

The `docker-compose.override.yml` (picked up automatically) mounts source code for hot reload.

## Frontend-only dev against a production backend

Leave `DEV_MODE` unset on the backend. Set in `frontend/.env.local`:
```dotenv
VITE_DEV_MODE=seeded
VITE_DEV_EMAIL=your@email.com
VITE_DEV_PASSWORD=yourpassword
```

This pre-fills the login form without bypassing auth.
