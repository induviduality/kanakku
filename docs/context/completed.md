# Completed Milestones

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
