#!/usr/bin/env bash
# dev-reset.sh — wipe everything and start the app from scratch.
# Run from the repo root or the infra/ directory.
# Requires: Docker with Compose v2, Git Bash / WSL / any bash on Windows.

set -euo pipefail

# Always run relative to infra/ where the compose files live
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# ── 1. Force-stop any containers holding the ports this stack uses ────────────
echo "==> Releasing ports (8000, 5173, 5432, 6379, 11434)..."
for port in 8765 5173 5432 6379 11434; do
  ids=$(docker ps -q --filter "publish=$port" 2>/dev/null)
  if [ -n "$ids" ]; then
    echo "    stopping container(s) on port $port"
    docker stop $ids 2>/dev/null || true
  fi
done

# ── 2. Tear down all containers + wipe volumes (DB, Redis, Caddy certs) ──────
echo "==> Stopping and removing containers + volumes..."
docker compose down -v --remove-orphans 2>/dev/null || true

# ── 3. Ensure the external proxy network exists (Caddy needs it) ─────────────
PROXY_NET="${PROXY_NETWORK:-my-example-proxy-nw}"
if ! docker network inspect "$PROXY_NET" > /dev/null 2>&1; then
  echo "==> Creating external network: $PROXY_NET"
  docker network create "$PROXY_NET"
fi

# ── 4. Rebuild backend + frontend images ─────────────────────────────────────
echo "==> Building images..."
docker compose build api worker frontend

# ── 5. Start DB + Redis and wait until healthy ────────────────────────────────
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

# ── 6. Run all Alembic migrations ─────────────────────────────────────────────
echo "==> Running migrations..."
docker compose run --rm --no-deps api alembic upgrade head

# ── 7. Start the full stack ───────────────────────────────────────────────────
# The API lifespan will call seed_dev_data() if DEV_MODE=true in .env,
# wiping and reseeding the dev user + all fixture data automatically.
echo "==> Starting all services..."
docker compose up -d

echo ""
echo "Done. Services:"
echo "  Frontend : http://localhost:5173"
echo "  API      : http://localhost:8765"
echo "  Caddy    : http://localhost:${CADDY_PORT:-9090}"
echo ""
echo "Logs: cd infra && docker compose logs -f api"
