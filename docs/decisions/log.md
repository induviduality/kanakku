# Decision Log
The format: date, title, context, decision, alternatives, what it affects.

## 2026-05-23 — Dev mode toggled via .dev-config.yml + loader script rather than .env editing

**Context:** User wanted a single touchpoint to toggle dev mode for backend, frontend, and infra independently without editing multiple files or the .env directly.

**Decision:** Separate config file (`.dev-config.yml`) + a Python loader script (`infra/load-dev-config.py`) that reads the YAML and exports shell-ready env vars. Script also exports `DEV_MODE` for backward compat alongside the new `DEV_MODE_BACKEND / DEV_MODE_FRONTEND / DEV_MODE_INFRA`.

**Alternatives considered:**
- Edit `.env` directly — defeats the single-touchpoint goal and risks committing secrets
- Shell alias / Makefile target — less discoverable, doesn't compose well across presets

**Affects:** `.dev-config.yml`, `infra/load-dev-config.py`, `infra/env.example`, `DEV_MODE_SETUP.md`. No backend code changes; backend still reads `DEV_MODE` as before.