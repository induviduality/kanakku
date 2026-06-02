# Code Coverage & SonarQube — Setup & Run Commands by Environment

How to run the local code-quality stack on **Windows (local dev)** vs **Native Linux
(cloud VPS / Raspberry Pi 5)**. Everything is local/self-hosted — nothing is uploaded to
any third party.

> **You do not need Docker for the everyday reports.** Coverage, lint, and the browseable
> HTML reports run on plain `uv` / `bun`. Docker is required **only** for the optional
> **SonarQube dashboard** (it's a server) — that's the single extra moving part, nothing more.

> For the conceptual overview, config files, optional linter enrichment, quality gates, and
> general troubleshooting, see **[code-quality.md](./code-quality.md)**. This file is the
> per-environment command reference.

---

## 1. The setup, in one picture

Backend and frontend are **fully separate** — separate tests, separate coverage, and **two
separate SonarQube projects**.

| | Backend | Frontend |
|---|---|---|
| Tests / coverage | `pytest` + `coverage.py` (via `uv`) | `vitest` v8 (via `bun`) |
| Coverage outputs | `backend/coverage.xml`, `backend/htmlcov/` | `frontend/coverage/lcov.info`, `frontend/coverage/` |
| Lint / SAST | `ruff`, `mypy`, `bandit` | `eslint` |
| Sonar project | `kanakku-backend` | `kanakku-frontend` |
| Sonar config | [`backend/sonar-project.properties`](../../backend/sonar-project.properties) | [`frontend/sonar-project.properties`](../../frontend/sonar-project.properties) |

Files that drive it: [`infra/sonarqube/docker-compose.yml`](../../infra/sonarqube/docker-compose.yml),
[`scripts/quality.ps1`](../../scripts/quality.ps1) (Windows),
[`scripts/quality.sh`](../../scripts/quality.sh) (Linux/macOS/Pi).

---

## 2. What needs Docker (and what doesn't)

| Layer | Tooling | Docker? | Runs on |
|---|---|---|---|
| **Tests + coverage + lint** (`test-*`, `coverage-*`, `lint-*`) | `uv`, `bun` | ❌ **No** | Any (amd64 **and** arm64) |
| **SonarQube server** (`sonar-up`) | Docker | ✅ Yes | **amd64 only** (no official arm64 image) |
| **Scanner** (`scan-*`) | Docker (`sonar-scanner-cli`) | ✅ Yes | amd64 (run on amd64, or against a remote server) |

**Bottom line:** `coverage-*`, `lint-*`, and `test-*` are Docker-free and produce browseable
HTML. Only `sonar-up` (the dashboard server) and `scan-*` (the scanner) use Docker. The one
caveat: *backend* coverage runs the test suite, which needs a Postgres (lightest is the app's
own `make up`).

---

## 3. Environment support matrix

| Step | Windows (local) | Cloud VPS (amd64 Linux) | Raspberry Pi 5 (arm64) |
|---|---|---|---|
| Run tests / coverage / lint | ✅ `quality.ps1` (no Docker) | ✅ `quality.sh` (no Docker) | ✅ `quality.sh` (no Docker) |
| Open HTML reports | ✅ | ✅ | ✅ |
| SonarQube **server** | ✅ Docker Desktop | ✅ Docker Engine | ⚠️ host it on the VPS/Windows instead |
| **Scanner** | ✅ | ✅ | ⚠️ run from amd64, or against the remote server |
| `vm.max_map_count` fix | auto (init-sysctl) | `sudo sysctl` + persist | only if you run the server |
| Token env var | `$env:SONAR_TOKEN` | `export SONAR_TOKEN` | `export SONAR_TOKEN` |

---

## 4. Local — Windows (PowerShell)

### One-time setup (brief)
- Install [`uv`](https://docs.astral.sh/uv/) and [`bun`](https://bun.sh). **That's all you need
  for the no-Docker path** (coverage + lint + HTML).
- *Backend coverage only:* a **test Postgres**. Lightest is the app's DB — `cd infra ; make up`
  (uses Docker) — or point `DATABASE_URL` at a native Postgres for zero Docker.
- *Only if you want the SonarQube dashboard:* install Docker Desktop, then once —
  ```powershell
  .\scripts\quality.ps1 sonar-up                  # SonarQube at http://localhost:9000
  #   log in admin / admin → set a new password → My Account ▸ Security ▸ Generate Token
  $env:SONAR_TOKEN = "squ_paste_your_token_here"  # re-set per terminal session
  ```
  (`vm.max_map_count` is handled automatically by the compose's `init-sysctl` service on WSL2.)

### A) Without Docker — coverage + lint + HTML reports (default)
```powershell
.\scripts\quality.ps1 coverage-frontend   # → frontend/coverage/index.html   (no DB, no Docker)
.\scripts\quality.ps1 lint-frontend       # eslint
.\scripts\quality.ps1 lint-backend        # ruff + mypy + bandit   (static, no DB, no Docker)
.\scripts\quality.ps1 coverage-backend    # → backend/htmlcov/index.html   (needs the test Postgres)
```
Open the `index.html` files in your browser. No server, no scan.

### B) Optional — the SonarQube dashboard (Docker)
Server running + `$env:SONAR_TOKEN` set (see one-time setup), then:
```powershell
.\scripts\quality.ps1 scan-backend        # → http://localhost:9000/dashboard?id=kanakku-backend
.\scripts\quality.ps1 scan-frontend       # → http://localhost:9000/dashboard?id=kanakku-frontend
.\scripts\quality.ps1 sonar-down          # stop the server (data persists in volumes)
```
`scan-*` reuses the coverage files from (A), so run the matching `coverage-*` first.

---

## 5. Native — Cloud VPS (amd64 Linux)

### One-time setup (brief)
- Install Docker Engine, `uv`, `bun`.
- *Backend coverage only:* a test Postgres (`cd infra && make up`, or a native one).
- *Only for the SonarQube dashboard:* raise the kernel limit its Elasticsearch needs (persisted),
  then start the server and make a token —
  ```bash
  echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf && sudo sysctl -p
  ./scripts/quality.sh sonar-up                   # http://<vps-ip>:9000
  #   admin / admin → new password → My Account ▸ Security ▸ Generate Token
  export SONAR_TOKEN=squ_paste_your_token_here
  ```
  Recommended VPS size: **≥ 2 vCPU / 4 GB RAM** (SonarQube alone wants ~2 GB).

### Run — coverage + lint (no Docker)
```bash
./scripts/quality.sh coverage-backend
./scripts/quality.sh coverage-frontend
./scripts/quality.sh lint-backend
./scripts/quality.sh lint-frontend
```
### Scan into the dashboard (Docker)
```bash
./scripts/quality.sh scan-backend          # → /dashboard?id=kanakku-backend
./scripts/quality.sh scan-frontend         # → /dashboard?id=kanakku-frontend
```
> **Don't expose `:9000` raw to the internet.** Reach it via SSH tunnel
> (`ssh -L 9000:localhost:9000 user@vps`) or your existing reverse proxy / Tailscale.

---

## 6. Native — Raspberry Pi 5 (arm64)

The SonarQube **server** has no official arm64 image and is heavy for a Pi that's also running
the app, so **don't host it on the Pi.**

### One-time setup (brief)
- Install `uv` and `bun`. **No Docker needed** for the reports.
- *Backend coverage only:* a test Postgres (`cd infra && make up`, or a native one).
- *Only for Option B:* a SonarQube server reachable elsewhere (your VPS/Windows box, §4/§5) and
  its token — `export SONAR_HOST_URL=…` and `export SONAR_TOKEN=…`.

### Option A — Coverage + lint + HTML (fully native, no Docker) — recommended
```bash
./scripts/quality.sh coverage-backend     # → backend/htmlcov/index.html
./scripts/quality.sh coverage-frontend    # → frontend/coverage/index.html
./scripts/quality.sh lint-backend         # ruff + mypy + bandit
./scripts/quality.sh lint-frontend        # eslint
```
Open the HTML files (copy them off the Pi, or serve the folder). Coverage % + line-by-line gaps
+ lint findings, no server.

### Option B — Scan into a SonarQube server hosted elsewhere
```bash
export SONAR_HOST_URL=http://<vps-ip>:9000        # the amd64 server from §5
export SONAR_TOKEN=squ_paste_your_token_here
./scripts/quality.sh coverage-backend && ./scripts/quality.sh scan-backend
./scripts/quality.sh coverage-frontend && ./scripts/quality.sh scan-frontend
```
If `sonarsource/sonar-scanner-cli` won't run on the Pi's arch, generate coverage on the Pi and
run the `scan-*` step from the amd64 host — `coverage.xml` / `lcov.info` are portable text files.

---

## 7. Per-environment cheat sheet

| | Windows (local) | Cloud VPS (amd64) | Pi 5 (arm64) |
|---|---|---|---|
| Helper script | `scripts\quality.ps1` | `scripts/quality.sh` | `scripts/quality.sh` |
| Set token | `$env:SONAR_TOKEN = "…"` | `export SONAR_TOKEN=…` | `export SONAR_TOKEN=…` |
| Point at remote server | `$env:SONAR_HOST_URL = "…"` | `export SONAR_HOST_URL=…` | `export SONAR_HOST_URL=…` |
| Backend coverage (no Docker) | `quality.ps1 coverage-backend` | `quality.sh coverage-backend` | `quality.sh coverage-backend` |
| Frontend coverage (no Docker) | `quality.ps1 coverage-frontend` | `quality.sh coverage-frontend` | `quality.sh coverage-frontend` |
| Lint (no Docker) | `quality.ps1 lint-backend` / `lint-frontend` | `quality.sh lint-backend` / `lint-frontend` | same |
| Start server (Docker) | `quality.ps1 sonar-up` | `quality.sh sonar-up` | *(host on VPS instead)* |
| Scan (Docker) | `quality.ps1 scan-backend` / `scan-frontend` | `quality.sh scan-backend` / `scan-frontend` | scan against remote (Option B) |
| max_map_count | automatic | `sudo sysctl -w vm.max_map_count=262144` | n/a (no local server) |

**Reminders that apply everywhere:**
- No Docker for `coverage-*` / `lint-*` / `test-*`. Docker is only for `sonar-up` + `scan-*`.
- Backend coverage needs a reachable **test Postgres** (`cd infra && make up`).
- The suites currently have **pre-existing failing tests**; coverage is still emitted
  (`reportOnFailure: true` for the frontend, and `pytest-cov` writes on exit regardless).
- Generated reports are git-ignored (`backend/htmlcov/`, `backend/coverage.xml`,
  `frontend/coverage/`, `*/reports/`, `.scannerwork/`).

---

*Updated 2026-06-02. Local-only setup — no third-party hosting.*
