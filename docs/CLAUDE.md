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

After completing any task:
1. Append to docs/decisions/log.md if any non-trivial decision was made.
   Non-trivial = anything where you chose between two reasonable approaches.
2. Update docs/context/completed.md with a brief summary.
3. Update docs/context/current-milestone.md for the next task (or clear it 
   if milestone is done).
4. Check docs/todo.md and cross off the completed items, if applicable.

Definition of non-trivial decision (log it):
- Chose between two valid architectural approaches
- Deviated from prompt_plan.md or tdd.md
- Added something not in the plan
- Found a constraint or edge case not in the spec
- Made a performance tradeoff

Do NOT log: boilerplate, naming choices, formatting, standard CRUD.