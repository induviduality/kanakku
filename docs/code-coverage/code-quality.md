# Code Quality & Coverage (local-only)

A free, self-hosted **SonarQube Community Edition** setup that gives you the rich
dashboard of a Sonar/Codacy free tier — bugs, vulnerabilities, code smells, security
hotspots, test coverage, duplication, complexity, and maintainability/reliability/security
ratings with history — plus plain **static HTML coverage reports** you can open without
any server (and without Docker).

**Backend and frontend are fully separate**: separate test commands, separate coverage
reports, and **two separate SonarQube projects** (`kanakku-backend`, `kanakku-frontend`)
with their own dashboards. Everything runs on your machine — no cloud, no upload.

> Running on Windows vs a cloud VPS vs a Raspberry Pi? See the per-environment command guide:
> **[README.md](./README.md)**.

| | Backend (Python) | Frontend (TS/React) |
|---|---|---|
| Tests | `pytest` | `vitest` |
| Coverage | `coverage.py` → `backend/coverage.xml`, `backend/htmlcov/` | v8 → `frontend/coverage/lcov.info`, `frontend/coverage/` |
| Lint/SAST | `ruff`, `mypy`, `bandit` | `eslint` |
| Sonar project | `kanakku-backend` | `kanakku-frontend` |
| Sonar config | [`backend/sonar-project.properties`](../../backend/sonar-project.properties) | [`frontend/sonar-project.properties`](../../frontend/sonar-project.properties) |

> Also involved: [`infra/sonarqube/docker-compose.yml`](../../infra/sonarqube/docker-compose.yml),
> [`scripts/quality.ps1`](../../scripts/quality.ps1) / [`scripts/quality.sh`](../../scripts/quality.sh),
> coverage config in [`backend/pyproject.toml`](../../backend/pyproject.toml) and
> [`frontend/vite.config.ts`](../../frontend/vite.config.ts).

---

## Prerequisites

- **`uv`** (backend) and **`bun`** (frontend) — already used by the project. This is all you
  need for coverage + lint + HTML reports. **No Docker required for those.**
- A **test Postgres** for *backend* coverage (the suite needs a DB). Lightest: `cd infra && make up`
  (the app's own DB) or any local Postgres. Frontend coverage needs nothing extra.
- **Docker** — *only* if you also want the SonarQube dashboard (it's a server + a scanner).
  ~2 GB free RAM while it runs.

On Windows use `scripts\quality.ps1`; on Linux/macOS/Pi use `scripts/quality.sh`. Same commands.

---

## Quickest path: just the HTML reports (no server, no Docker)

```powershell
# Windows                                   # Linux / macOS / Pi
.\scripts\quality.ps1 coverage-backend       ./scripts/quality.sh coverage-backend
.\scripts\quality.ps1 coverage-frontend      ./scripts/quality.sh coverage-frontend
```
Open:
- **Backend:** `backend/htmlcov/index.html`
- **Frontend:** `frontend/coverage/index.html`

---

## Full SonarQube dashboards (richest data — needs Docker)

**One-time:** start the server and make a token.
```powershell
.\scripts\quality.ps1 sonar-up
# Open http://localhost:9000  → log in admin / admin → set a new password.
# My Account ▸ Security ▸ Generate Token → copy it.
$env:SONAR_TOKEN = "squ_paste_token_here"     # PowerShell
# export SONAR_TOKEN=squ_paste_token_here     # bash
```

**Backend** → project `kanakku-backend`:
```powershell
.\scripts\quality.ps1 coverage-backend
.\scripts\quality.ps1 scan-backend
# → http://localhost:9000/dashboard?id=kanakku-backend
```

**Frontend** → project `kanakku-frontend`:
```powershell
.\scripts\quality.ps1 coverage-frontend
.\scripts\quality.ps1 scan-frontend
# → http://localhost:9000/dashboard?id=kanakku-frontend
```

Shortcuts that do coverage + lint + scan for one side:
`.\scripts\quality.ps1 backend`  ·  `.\scripts\quality.ps1 frontend`.

Re-run anytime for a fresh snapshot — SonarQube keeps history per project so you can watch
trends. Stop the server (data persists in Docker volumes) with `sonar-down`.

---

## Command reference

| Command | Side | Does | Docker? | Output |
|---|---|---|---|---|
| `test-backend` | BE | `pytest` (needs test DB) | no | console |
| `coverage-backend` | BE | tests + coverage | no | `backend/coverage.xml`, `backend/htmlcov/` |
| `lint-backend` | BE | `ruff` + `mypy` + `bandit` | no | `backend/reports/` |
| `scan-backend` | BE | scan → `kanakku-backend` | yes | dashboard |
| `backend` | BE | coverage + lint + scan | yes | all of the above |
| `test-frontend` | FE | `vitest` | no | console |
| `coverage-frontend` | FE | tests + coverage | no | `frontend/coverage/` (html + lcov) |
| `lint-frontend` | FE | `eslint` | no | `frontend/reports/` |
| `scan-frontend` | FE | scan → `kanakku-frontend` | yes | dashboard |
| `frontend` | FE | coverage + lint + scan | yes | all of the above |
| `sonar-up` / `sonar-down` | – | start / stop SonarQube | yes | `http://localhost:9000` |

Raw equivalents (no script):
```bash
# Backend                                           # Frontend
cd backend                                          cd frontend
uv run --extra dev pytest --cov=app \               bun run coverage
  --cov-report=xml --cov-report=html
# scan one side (server up + token exported), from that side's dir:
docker run --rm -e SONAR_HOST_URL=http://host.docker.internal:9000 \
  -e SONAR_TOKEN=$SONAR_TOKEN -v "$PWD:/usr/src" sonarsource/sonar-scanner-cli
```

---

## Enrich a dashboard with linter findings (optional)

SonarQube's bundled analyzers already overlap with these, but you can import exact findings:
1. Run `lint-backend` / `lint-frontend` (writes JSON/txt under `*/reports/`; `bandit` was added
   to the backend `dev` extra).
2. Uncomment the matching `sonar.*.reportPaths` lines in that side's `sonar-project.properties`.
3. Re-run the scan. (Exact support varies by SonarQube version; coverage import is the core.)

## Quality Gate (pass/fail thresholds)

In the UI: **Quality Gates** → use *Sonar way* or make your own (e.g. "Coverage on New Code ≥ 80%",
"0 new bugs"), then assign it per project under **Project Settings ▸ Quality Gate**. Each scan then
shows a green/red gate. Stored in SonarQube, not the repo.

---

## Troubleshooting

- **SonarQube container keeps restarting on boot** — almost always `vm.max_map_count` too low for
  the embedded Elasticsearch. The compose ships an `init-sysctl` service that sets it; if your Docker
  blocks privileged init containers, set it manually:
  - Windows (Docker Desktop/WSL2): `wsl -d docker-desktop sysctl -w vm.max_map_count=262144`
  - Linux: `sudo sysctl -w vm.max_map_count=262144` (persist in `/etc/sysctl.conf`).
- **`scan-*` can't reach the server** — the scanner runs in its own container and reaches SonarQube
  via `host.docker.internal` (scripts add `--add-host` on Linux). For a server elsewhere, set
  `SONAR_HOST_URL`.
- **Backend coverage DB errors** — start a test Postgres (`cd infra && make up`) or point
  `DATABASE_URL` at a throwaway DB. Coverage is still written for whatever tests ran.

---

## Git-ignored outputs

Not committed (see [`.gitignore`](../../.gitignore)): `backend/.coverage`, `backend/coverage.xml`,
`backend/htmlcov/`, `backend/reports/`, `frontend/coverage/`, `frontend/reports/`, `.scannerwork/`.
SonarQube data lives in Docker volumes, not the repo.

> Want CI later? The same `coverage-*` + `scan-*` commands run in any CI — you'd just add a SonarQube
> URL + token as secrets. Out of scope for now (local-only).
