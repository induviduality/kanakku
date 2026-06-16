#!/usr/bin/env bash
# Rebuild and redeploy containers without touching data volumes.
# Usage: ./redeploy.sh {frontend|backend|all}
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

COMPOSE="docker compose -f docker-compose.yml"

usage() {
  echo "Usage: $0 {frontend|backend|all}"
  echo ""
  echo "  frontend  Rebuild and redeploy the frontend container only"
  echo "  backend   Rebuild and redeploy the api + worker containers only"
  echo "  all       Rebuild and redeploy frontend, api, and worker containers"
  exit 1
}

deploy_frontend() {
  echo "==> Building frontend image..."
  $COMPOSE build frontend
  echo "==> Restarting frontend (no dependency restart)..."
  $COMPOSE up -d --no-deps frontend
}

deploy_backend() {
  echo "==> Building api + worker images..."
  $COMPOSE build api worker
  echo "==> Restarting api + worker (no dependency restart)..."
  $COMPOSE up -d --no-deps api worker
}

case "${1:-}" in
  frontend)
    deploy_frontend
    ;;
  backend)
    deploy_backend
    ;;
  all)
    deploy_backend
    deploy_frontend
    ;;
  *)
    usage
    ;;
esac

echo ""
echo "==> Deployment complete. Running containers:"
$COMPOSE ps --format "table {{.Name}}\t{{.Status}}"
