# Current Task: Task 0.2 — Backend Bootstrap

## What I'm implementing
Python FastAPI backend: pyproject.toml, app/main.py (/health), app/config.py (pydantic-settings), app/db/session.py + base.py, Alembic init, tests/conftest.py, ARM64 Dockerfile.

## Files I'm working in
backend/

## Key constraints to remember
- NFR-1.1: config only via env vars (pydantic-settings)
- NFR-2.1: LLM_BACKEND env var controls local vs cloud
- ARM64-compatible Docker image (for Pi 5)

## Already decided (see decisions/log.md for full context)
- Stack: Python 3.12 + FastAPI + SQLAlchemy 2 async + Alembic + ARQ
- DB: PostgreSQL 16

## Tests to write first (TDD)
- /health returns 200
- DB connect succeeds

## Definition of done
pytest, ruff, mypy all pass