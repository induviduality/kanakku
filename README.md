# Kanakku

Kanakku is a self-hosted personal finance tracker for users in India, built around frictionless PDF bank statement import and natural-language transaction entry. Your data lives in your own Postgres database — queryable however you like, never leaving your host unless you choose.

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/induviduality/kanakku.git
cd kanakku/infra

# 2. Configure
cp env.example .env
# Edit .env — at minimum set JWT_SECRET (openssl rand -hex 32) and POSTGRES_PASSWORD

# 3. Start
docker compose up -d

# 4. Run migrations
docker compose exec api alembic upgrade head

# 5. (Optional) Pull the Ollama LLM model for AI features
docker compose exec ollama ollama pull qwen2.5:1.5b
```

Visit **http://localhost** — Caddy proxies the frontend and API.

**First time?** The `/setup` page creates the initial user account.

→ [docs/SETUP.md](docs/SETUP.md) — full prerequisites guide per platform (Windows, Pi 5, Cloud VPS)

---

## Architecture Overview

```
Browser / PWA
     │
  Caddy (reverse proxy, TLS)
     ├── /api/*  →  FastAPI (Python 3.12, async)
     │               ├── SQLAlchemy 2 + Alembic
     │               ├── ARQ worker (background jobs)
     │               └── Ollama (local LLM, optional)
     └── /*      →  Nginx (React 19 SPA, Tailwind, Radix UI)
                            └── TanStack Query / Router
Database: PostgreSQL 16
Queue:    Redis 7
```

Full technical spec: [docs/TDD.md](docs/TDD.md)

---

## Deployment

### Raspberry Pi 5 (recommended — home server)

The Pi 5 (8GB) runs the full stack comfortably. Access it from anywhere via **Tailscale** (recommended) or by pointing a domain at your home IP.

```bash
# On the Pi
git clone https://github.com/induviduality/kanakku.git
cd kanakku/infra
cp env.example .env
nano .env   # set JWT_SECRET, POSTGRES_PASSWORD, PUBLIC_DOMAIN

# Start (production mode — no dev overrides)
docker compose -f docker-compose.yml up -d
docker compose -f docker-compose.yml exec api alembic upgrade head
```

See [docs/running.md](docs/running.md#option-3a-deploy-to-raspberry-pi-5) for the full setup.

### Cloud VPS

Identical to Pi deployment. Set `PUBLIC_DOMAIN` to your public domain — Caddy provisions Let's Encrypt TLS automatically (ports 80/443 must be open).

See [docs/running.md](docs/running.md#option-3b-deploy-to-cloud-vps).

---

## Backup & Restore

```bash
# Manual backup (timestamped .dump file)
BACKUP_DIR=/var/backups/kanakku bash infra/scripts/backup.sh

# Restore
BACKUP_FILE=/var/backups/kanakku/kanakku_20260101T030000Z.dump bash infra/scripts/restore.sh

# Nightly automated backup with rotation (add to cron)
# See docs/operations.md for the cron entry
```

---

## Adding a New Bank Parser

1. Create `backend/app/parsers/banks/<bank>.py` implementing `BankParser.parse(text) → list[ParsedTransaction]`.
2. Register it in `backend/app/parsers/registry.py` inside `detect_parser()`.
3. Add tests in `backend/tests/parsers/test_<bank>.py`.

The HDFC parser (`hdfc.py`) is the reference implementation.

---

## Docs

| File | What's in it |
|------|-------------|
| [docs/SETUP.md](docs/SETUP.md) | **Start here** — prerequisites + install commands per platform |
| [docs/running.md](docs/running.md) | How to run the stack (native dev, Docker, Pi, VPS) |
| [docs/operations.md](docs/operations.md) | Operational runbook — backups, logs, updates, Tailscale |
| [docs/api.md](docs/api.md) | API reference (OpenAPI UI link) |
| [docs/TDD.md](docs/TDD.md) | Full technical design document |
| [docs/decisions/log.md](docs/decisions/log.md) | Architecture and implementation decisions |

---

## Contributing

Pull requests welcome. Please:
- Add tests for any new functionality (backend: pytest, frontend: vitest)
- Keep the LLM path local-only (`LLM_BACKEND=ollama` or `none`) — no data should leave the host by default
- Run `ruff check app/` and `mypy app/` before pushing backend changes
- Run `bun run test` and `bun run build` before pushing frontend changes
