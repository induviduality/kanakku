# Running Kanakku

> **First time?** Install platform prerequisites before reading this — see [docs/SETUP.md](SETUP.md).

Three ways to run the stack:

1. **Local dev** — native processes, fastest iteration
2. **Docker (full stack)** — containers on your laptop, mirrors production
3. **Deployed** — Raspberry Pi 5 or cloud VPS

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.12+ | [python.org](https://python.org) or `winget install Python.Python.3.12` |
| uv | any | `pip install uv` or `winget install astral-sh.uv` |
| Bun | 1.3+ | `irm bun.sh/install.ps1 \| iex` (Windows) |
| PostgreSQL | 16+ | [postgresql.org](https://postgresql.org) or Docker |
| Redis | 7+ | [redis.io](https://redis.io) or Docker |
| Docker + Compose | any | [docker.com](https://docker.com) — only needed for options 2 and 3 |
| Ollama | any | [ollama.com](https://ollama.com) — optional, only needed for LLM features |

---

## Option 1: Local Dev (native, no Docker)

Fastest for day-to-day development. Run each service directly on your machine.

### 1a. PostgreSQL and Redis

Install locally, or spin up just these two in Docker:

```bash
# One-liner: postgres + redis only
docker run -d --name kanakku-pg -e POSTGRES_DB=kanakku -e POSTGRES_USER=kanakku -e POSTGRES_PASSWORD=kanakku -p 5432:5432 postgres:16
docker run -d --name kanakku-redis -p 6379:6379 redis:7
```

Or install natively:
- **Windows**: [postgresql.org/download/windows](https://postgresql.org/download/windows) + `winget install Redis.Redis`
- **macOS**: `brew install postgresql@16 redis`

Create the dev database if using a local Postgres install:
```bash
createdb kanakku
createuser kanakku --password  # set password: kanakku
psql -c "GRANT ALL ON DATABASE kanakku TO kanakku;"
```

### 1b. Backend

```bash
cd backend

# Create venv and install deps (only needed once)
uv venv .venv --python 3.12
uv pip install -e ".[dev]"

# Copy env file and edit if needed
cp ../infra/env.example .env
# Edit .env: set DATABASE_URL, JWT_SECRET, etc.

# Run database migrations
.venv/Scripts/activate        # Windows
# source .venv/bin/activate   # macOS/Linux
alembic upgrade head

# Start API server (hot reload)
uvicorn app.main:app --reload --port 8765
```

API is now at `http://localhost:8765`. Docs at `http://localhost:8765/docs`.

To also run the ARQ background worker (needed for PDF imports, exports):
```bash
# In a second terminal, with venv activated
python -m arq app.workers.settings.WorkerSettings
```

### 1c. Frontend

```bash
cd frontend

# Install deps (only needed once)
bun install

# Start dev server (hot reload)
bun run dev
```

Frontend is now at `http://localhost:5173`.

### 1d. Ollama (optional — only needed for LLM features)

Ollama is **not** included in the Docker Compose stack. Install it separately from [ollama.com](https://ollama.com), then run it as a standalone process.

```bash
ollama pull qwen2.5:1.5b
ollama serve   # starts on http://localhost:11434
```

In your backend `.env`, set:
```
LLM_BACKEND=ollama
OLLAMA_HOST=http://localhost:11434
```

If you don't want LLM features, set `LLM_BACKEND=none` — all LLM calls return null results gracefully.

### 1e. Environment file for local dev

Create `backend/.env` (not committed — gitignored):

```dotenv
DATABASE_URL=postgresql+asyncpg://kanakku:kanakku@localhost:5432/kanakku
JWT_SECRET=dev-secret-change-me
LLM_BACKEND=none
OLLAMA_HOST=http://localhost:11434
LLM_MODEL=qwen2.5:1.5b
REDIS_URL=redis://localhost:6379
PUBLIC_BASE_URL=http://localhost:8765
DEBUG=true
```

### 1f. Running tests

```bash
cd backend
.venv/Scripts/pytest                  # all tests (needs running postgres)
.venv/Scripts/pytest tests/test_health.py  # health test only (no db needed)
.venv/Scripts/ruff check app/
.venv/Scripts/mypy app/
```

```bash
cd frontend
bun run test        # vitest (use this, NOT "bun test")
bun run build       # production build check
```

---

## Option 2: Docker Full Stack (local)

Runs every service in containers. Closer to production but slower to iterate.
Requires Docker Desktop installed and running.

`docker-compose.override.yml` is picked up automatically in local dev — it adds
code volume mounts (hot reload) and exposes service ports directly. On production
servers this file is absent, so `docker compose up` uses the production baseline.

```bash
cd infra

# Copy env and fill in secrets
cp env.example .env
# Edit .env — at minimum change JWT_SECRET and POSTGRES_PASSWORD

# Start everything (dev: includes override file automatically)
docker compose up

# Or in background
docker compose up -d

# View logs
docker compose logs -f api

# Stop
docker compose down
```

To run in production mode locally (no code mounts, multi-worker):
```bash
docker compose -f docker-compose.yml up -d
# or: make prod-up
```

Services and their ports:

| Service | URL |
|---------|-----|
| API | `http://localhost:8765` |
| API docs | `http://localhost:8765/docs` |
| Frontend | `http://localhost:5173` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

Run migrations inside the container:
```bash
docker compose exec api alembic upgrade head
```

Rebuild after code changes:
```bash
docker compose build api      # rebuild backend image
docker compose build frontend # rebuild frontend image
docker compose up -d          # restart with new images
```

---

## Option 3a: Deploy to Raspberry Pi 5

The Pi 5 runs the same `docker-compose.yml` as local Docker — only env vars differ.

### First-time setup on the Pi

```bash
# On the Pi (SSH in first)
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Clone the repo
git clone https://github.com/induviduality/kanakku.git
cd kanakku/infra

# Create .env
cp env.example .env
nano .env   # fill in all values — especially JWT_SECRET, POSTGRES_PASSWORD, DOMAIN
```

### `.env` values for Pi deployment

```dotenv
DOMAIN=kanakku.local          # or your Tailscale hostname, or a real domain
DATABASE_URL=postgresql+asyncpg://kanakku:<password>@db:5432/kanakku
POSTGRES_DB=kanakku
POSTGRES_USER=kanakku
POSTGRES_PASSWORD=<strong-password>
JWT_SECRET=<openssl rand -hex 32>
LLM_BACKEND=none
# LLM_BACKEND=ollama          # optional: set if running a standalone Ollama instance
# OLLAMA_HOST=http://<ollama-host>:11434
# LLM_MODEL=qwen2.5:1.5b
REDIS_URL=redis://redis:6379
PUBLIC_BASE_URL=https://<your-domain>
DEBUG=false
```

### Start

```bash
cd kanakku/infra
docker compose up -d

# Run migrations
docker compose exec api alembic upgrade head
```

The Caddyfile proxies traffic: frontend on `/`, API on `/api`. Access at `http://<pi-ip>` or `http://kanakku.local` if using mDNS.

### Updates

```bash
# On the Pi
cd kanakku
git pull
cd infra
docker compose build
docker compose up -d
docker compose exec api alembic upgrade head
```

### Accessing from outside your home network

Recommended: **Tailscale** (zero-config VPN).

```bash
# On the Pi
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up

# On your phone/laptop — install Tailscale and join same account
# Pi will be reachable at its Tailscale IP or hostname
```

Do **not** expose Postgres or Redis ports publicly. The Caddy reverse proxy only exposes 80/443.

---

## Option 3b: Deploy to Cloud VPS

Identical to Pi deployment. The only differences are the domain and the Caddy TLS config.

### Requirements

- A VPS with ≥1GB RAM (2GB recommended)
- A domain name pointed at the VPS IP (A record)
- Ports 80 and 443 open in firewall

### Setup

```bash
# SSH into VPS
git clone https://github.com/induviduality/kanakku.git
cd kanakku/infra
cp env.example .env
nano .env
```

Set in `.env`:
```dotenv
DOMAIN=kanakku.yourdomain.com
PUBLIC_BASE_URL=https://kanakku.yourdomain.com
# ...rest same as Pi
```

The Caddyfile handles Let's Encrypt TLS automatically when `DOMAIN` is a real public hostname. No extra steps.

```bash
docker compose up -d
docker compose exec api alembic upgrade head
```

---

## Quick Reference

| Task | Local dev | Docker |
|------|-----------|--------|
| Start backend | `uvicorn app.main:app --reload` (in `backend/`) | `docker compose up api` |
| Start frontend | `bun run dev` (in `frontend/`) | `docker compose up frontend` |
| Run migrations | `alembic upgrade head` (in `backend/`, venv active) | `docker compose exec api alembic upgrade head` |
| Run backend tests | `.venv/Scripts/pytest` (in `backend/`) | `docker compose exec api pytest` |
| Run frontend tests | `bun run test` (in `frontend/`) | `docker compose exec frontend bun run test` |
| View API docs | `http://localhost:8765/docs` | same |
| View frontend | `http://localhost:5173` | `http://localhost:5173` |
| Restart after code change | Uvicorn hot-reloads automatically | `docker compose build && docker compose up -d` |

---

## Common Issues

**`document is not defined` in frontend tests**
Use `bun run test`, not `bun test`. The latter uses bun's native runner without jsdom.

**`alembic upgrade head` fails with connection error**
Make sure PostgreSQL is running and `DATABASE_URL` in your `.env` is correct.

**Ollama model not loading**
Run `ollama pull qwen2.5:1.5b` manually. First pull is ~1GB and can time out in scripts.

**Port already in use**
Check for existing processes: `netstat -ano | findstr :8765` (Windows) or `lsof -i :8765` (macOS/Linux).
