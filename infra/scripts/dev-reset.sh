#!/usr/bin/env bash
# dev-reset.sh — wipe everything and start the app from scratch.
# Run from the repo root or the infra/ directory.
# Requires: Docker with Compose v2, Git Bash / WSL / any bash on Windows.

set -euo pipefail

# Always run relative to infra/ where the compose files live
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# ── 1. Tear down all containers + wipe volumes (DB, Redis, Caddy certs) ──────
echo "==> Stopping and removing containers + volumes..."
docker compose down -v --remove-orphans 2>/dev/null || true

# ── 2. Ensure the external proxy network exists (Caddy needs it) ─────────────
PROXY_NET="${PROXY_NETWORK:-my-example-proxy-nw}"
if ! docker network inspect "$PROXY_NET" > /dev/null 2>&1; then
  echo "==> Creating external network: $PROXY_NET"
  docker network create "$PROXY_NET"
fi

# ── 3. Rebuild backend + frontend images ─────────────────────────────────────
echo "==> Building images..."
docker compose build api worker frontend

# ── 4. Start DB + Redis and wait until healthy ────────────────────────────────
echo "==> Starting database and Redis..."
docker compose up -d db redis

echo -n "==> Waiting for Postgres to be ready"
POSTGRES_USER_VAL="${POSTGRES_USER:-kanakku}"
POSTGRES_DB_VAL="${POSTGRES_DB:-kanakku}"
until docker compose exec -T db pg_isready -U "$POSTGRES_USER_VAL" -d "$POSTGRES_DB_VAL" > /dev/null 2>&1; do
  echo -n "."
  sleep 1
done
echo " ready."

# ── 5. Run all Alembic migrations ─────────────────────────────────────────────
echo "==> Running migrations..."
docker compose run --rm --no-deps api alembic upgrade head

# ── 6. Start the full stack ───────────────────────────────────────────────────
# The API lifespan will call seed_dev_data() if DEV_MODE=true in .env,
# wiping and reseeding the dev user + all fixture data automatically.
echo "==> Starting all services..."
docker compose up -d

echo ""
echo "Done. Services:"
echo "  Frontend : http://localhost:5173"
echo "  API      : http://localhost:8000"
echo "  Caddy    : http://localhost:${CADDY_PORT:-8081}"
echo ""
echo "Logs: cd infra && docker compose logs -f api"
