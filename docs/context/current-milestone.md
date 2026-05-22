# Current Task: Task 1.1 — Users + Sessions Schema

## What I'm implementing
SQLAlchemy models: User, Session, InviteToken. Alembic migration. Tests for model creation and migration up/down.

## Files I'm working in
backend/app/models/
backend/alembic/versions/
backend/tests/

## Key constraints to remember
- UUIDs use PG UUID type (not VARCHAR)
- All timestamps use TIMESTAMPTZ
- Soft delete: deleted_at nullable on relevant models
- Tokens stored hashed (plain token only in URL/response, never in DB)

## Already decided (see decisions/log.md for full context)
- Stack: SQLAlchemy 2 async, Alembic, asyncpg

## Tests to write first (TDD)
- test_models_users.py: create user, email unique constraint, timestamps
- test_migration.py: alembic upgrade head + downgrade base both clean

## Definition of done
pytest passes including migration round-trip