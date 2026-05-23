# Personal Finance Tracker — Project Context

## What This Is
A self-hosted personal finance tracker. Single user. 
Privacy-first. Data lives in Postgres, queryable via raw SQL.
Full spec at docs/tdd.md.

## Core Principles (never violate these)
- NFR-1.1: No code changes between self-hosted and cloud deployment. 
  Config only via env vars.
- NFR-2.1: All LLM processing must have a fully local mode (Ollama).
  No data leaves the host unless LLM_BACKEND is explicitly set to a cloud provider.
- FR-7.9: Net expense for splits = user_own_share + forgiven_shares only.
  Pending shares do not reduce reported expense.
- Transactions have three types only: expense, income, transfer.
  "split_parent" is NOT a transaction type — splits are a separate entity.
- Soft delete everywhere. deleted_at nullable column. 30-day recovery.
- All DB constraints enforced at both application AND database level.

## Stack
Backend: Python 3.12 + FastAPI + SQLAlchemy 2 async + Alembic + ARQ
Frontend: Bun + Vite + React 19 + Tailwind + Radix UI + TanStack Query/Router
DB: PostgreSQL 16
Containers: Docker Compose (same file for home server + VPS)

## Current Task
See docs/context/current-milestone.md

## Decision Log
All architectural and implementation decisions at docs/decisions/log.md
Check this before implementing anything non-trivial.

## What's Done
See docs/context/completed.md

## Working Instructions for Claude Code

Before starting any task:
1. Read docs/context/current-milestone.md
2. Read docs/decisions/log.md (scan for anything affecting current files)
3. Read docs/context/completed.md (understand what's already built)

After completing any task (update after EACH TASK, not after a full milestone):
1. Append to docs/decisions/log.md if any non-trivial decision was made.
   Non-trivial = anything where you chose between two reasonable approaches.
2. Update docs/context/completed.md with a brief summary of the just-finished task.
3. Update docs/context/current-milestone.md to reflect the just-finished task
   and set the next task (or mark milestone done if all tasks complete).
4. Check docs/todo.md and cross off the completed items, if applicable.
5. Commit the changes before moving on to the next task. Do not batch
   multiple tasks into one commit.

IMPORTANT: Steps 2–4 must happen after EVERY individual task, not just at
milestone boundaries. If a milestone has tasks 8.1, 8.2, 8.3, update the docs
and commit after 8.1, again after 8.2, again after 8.3.

When asked to commit, do not include yourself as a co-author.

Definition of non-trivial decision (log it):
- Chose between two valid architectural approaches
- Deviated from prompt_plan.md or tdd.md
- Added something not in the plan
- Found a constraint or edge case not in the spec
- Made a performance tradeoff

Do NOT log: boilerplate, naming choices, formatting, standard CRUD.

## Dev Seed Data

`backend/app/dev_seed.py` seeds realistic fixture data when `DEV_MODE=true`.
It runs automatically on every startup and is **fully idempotent** (fixed UUIDs,
skips existing rows).

**When to update the seed file:**
- A new feature introduces a domain object (model, relationship) that has no
  fixture representation yet — add a scenario so it's visible in dev.
- A new page or component needs a specific state to be testable (e.g. empty
  list, partially-filled form, error state) — add that state as a fixture.
- A new enum value or status is introduced — add at least one row that shows it.

**Rules for extending:**
1. Assign a new fixed UUID constant in the `# Fixed UUIDs` block at the top.
   Use the same prefix pattern for that entity type.
2. Add a `# Scenario: <description>` comment above the new row.
3. Never change an existing UUID — it would create a duplicate on a fresh DB
   while leaving the old row orphaned on an existing one.
4. Keep `seed_dev_data()` idempotent: always check-before-insert using the
   existing set-based pattern in the file.