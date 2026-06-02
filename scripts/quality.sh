#!/usr/bin/env bash
# Local code-quality helper for Kanakku (Linux / macOS / Pi / WSL).
# Backend and frontend are fully separate: separate tests, coverage, and SonarQube
# dashboards. Everything runs locally — nothing is uploaded anywhere.
#
#   ./scripts/quality.sh <command>
#
#   --- Backend ---
#   test-backend       Run BE tests (pytest)                  needs a test Postgres
#   coverage-backend   BE tests + coverage                    -> backend/coverage.xml, backend/htmlcov/
#   lint-backend       ruff + mypy + bandit                   -> backend/reports/
#   scan-backend       Scan BE into SonarQube 'kanakku-backend'
#   backend            coverage-backend + lint-backend + scan-backend
#
#   --- Frontend ---
#   test-frontend      Run FE tests (vitest)
#   coverage-frontend  FE tests + coverage                    -> frontend/coverage/ (html + lcov)
#   lint-frontend      eslint                                 -> frontend/reports/
#   scan-frontend      Scan FE into SonarQube 'kanakku-frontend'
#   frontend           coverage-frontend + lint-frontend + scan-frontend
#
#   --- Server ---
#   sonar-up / sonar-down   Start / stop local SonarQube (http://localhost:9000)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
COMPOSE="infra/sonarqube/docker-compose.yml"

# ── Backend ─────────────────────────────────────────────────────────────────────
test_backend()     { echo "==> Backend tests";    ( cd backend && uv run --extra dev pytest ); }
coverage_backend() {
  echo "==> Backend coverage (pytest + coverage.py)"
  ( cd backend && uv run --extra dev pytest --cov=app --cov-report=xml --cov-report=html --cov-report=term-missing )
  echo "    backend/coverage.xml + backend/htmlcov/index.html"
}
lint_backend() {
  echo "==> Backend lint (ruff + mypy + bandit)"
  mkdir -p backend/reports
  ( cd backend
    uv run --extra dev ruff check . --output-format json > reports/ruff.json || true
    uv run --extra dev ruff check . || true
    uv run --extra dev mypy app 2>&1 | tee reports/mypy.txt || true
    uv run --extra dev bandit -r app -f json -o reports/bandit.json || true )
}
scan_backend() { scan "backend" "kanakku-backend"; }

# ── Frontend ────────────────────────────────────────────────────────────────────
test_frontend() {
  echo "==> Frontend tests"
  ( cd frontend && { [ -d node_modules ] || bun install --frozen-lockfile; } && bun run test )
}
coverage_frontend() {
  echo "==> Frontend coverage (vitest v8)"
  ( cd frontend && { [ -d node_modules ] || bun install --frozen-lockfile; } && bun run coverage )
  echo "    frontend/coverage/lcov.info + frontend/coverage/index.html"
}
lint_frontend() {
  echo "==> Frontend lint (eslint)"
  mkdir -p frontend/reports
  ( cd frontend
    [ -d node_modules ] || bun install --frozen-lockfile
    bunx eslint . -f json -o reports/eslint.json || true
    bun run lint || true )
}
scan_frontend() { scan "frontend" "kanakku-frontend"; }

# ── Shared ──────────────────────────────────────────────────────────────────────
scan() {  # $1 = subdir, $2 = projectKey
  : "${SONAR_TOKEN:?Set SONAR_TOKEN first (SonarQube > My Account > Security > Generate Token).}"
  local host_url="${SONAR_HOST_URL:-http://host.docker.internal:9000}"
  echo "==> Scanning $1 -> $2 ($host_url)"
  docker run --rm \
    --add-host=host.docker.internal:host-gateway \
    -e SONAR_HOST_URL="$host_url" \
    -e SONAR_TOKEN="$SONAR_TOKEN" \
    -v "$ROOT/$1:/usr/src" \
    sonarsource/sonar-scanner-cli
  echo "    Dashboard: $host_url/dashboard?id=$2"
}
sonar_up()   { echo "==> Starting local SonarQube (first boot ~1-2 min)"; docker compose -f "$COMPOSE" up -d; echo "    http://localhost:9000 (admin/admin)"; }
sonar_down() { docker compose -f "$COMPOSE" down; }

case "${1:-help}" in
  test-backend)      test_backend ;;
  coverage-backend)  coverage_backend ;;
  lint-backend)      lint_backend ;;
  scan-backend)      scan_backend ;;
  backend)           coverage_backend; lint_backend; scan_backend ;;

  test-frontend)     test_frontend ;;
  coverage-frontend) coverage_frontend ;;
  lint-frontend)     lint_frontend ;;
  scan-frontend)     scan_frontend ;;
  frontend)          coverage_frontend; lint_frontend; scan_frontend ;;

  sonar-up)          sonar_up ;;
  sonar-down)        sonar_down ;;
  *) sed -n '2,30p' "$0" ;;
esac
