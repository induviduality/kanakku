# Current Task: Task 0.5 — GitHub Actions CI

## What I'm implementing
GitHub Actions CI: backend job (pytest + ruff + mypy) and frontend job (bun test + build) running in parallel on push/PR to main.

## Files I'm working in
.github/workflows/

## Key constraints to remember
- CI runs on GitHub-hosted x86_64 runners (not ARM64)
- Backend job needs postgres + redis service containers
- Use `bun run test` not `bun test`

## Already decided (see decisions/log.md for full context)
- ARM64 builds tested at deploy time, not in CI

## Tests to write first (TDD)
- ci.yml backend job: ruff, mypy, pytest --cov
- ci.yml frontend job: bun run test, bun run build

## Definition of done
Both jobs pass on a dummy PR