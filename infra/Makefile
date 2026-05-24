.PHONY: up down restart logs build ps \
        backend-shell worker-shell frontend-shell psql redis-shell ollama-shell \
        migrate ollama-init prod-up prod-down

# ── Compose lifecycle ──────────────────────────────────────────────────────────

# Local dev: applies docker-compose.yml + docker-compose.override.yml automatically
up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose build

# Production: skips the dev override file
prod-up:
	docker compose -f docker-compose.yml up -d

prod-down:
	docker compose -f docker-compose.yml down

ps:
	docker compose ps

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

logs-worker:
	docker compose logs -f worker

logs-frontend:
	docker compose logs -f frontend

# ── Shells ─────────────────────────────────────────────────────────────────────

backend-shell:
	docker compose exec api bash

worker-shell:
	docker compose exec worker bash

frontend-shell:
	docker compose exec frontend sh

psql:
	docker compose exec db psql -U $${POSTGRES_USER:-kanakku} -d $${POSTGRES_DB:-kanakku}

redis-shell:
	docker compose exec redis redis-cli

ollama-shell:
	docker compose exec ollama bash

# ── Database ───────────────────────────────────────────────────────────────────

migrate:
	docker compose exec api alembic upgrade head

migrate-down:
	docker compose exec api alembic downgrade -1

# ── Ollama ─────────────────────────────────────────────────────────────────────

ollama-init:
	bash scripts/init-ollama.sh

# ── Tests ──────────────────────────────────────────────────────────────────────

test-backend:
	docker compose exec api pytest

test-frontend:
	docker compose exec frontend bun run test

# Run Playwright e2e tests against the running stack
e2e:
	cd ../frontend && E2E_BASE_URL=http://localhost E2E_SKIP_SERVER=1 bun run e2e
