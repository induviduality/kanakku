#!/usr/bin/env bash
# backup.sh — dump the Kanakku PostgreSQL database to a timestamped file.
#
# Usage:
#   BACKUP_DIR=/backups ./backup.sh
#   BACKUP_DIR=/backups DATABASE_URL=postgresql://user:pass@host/db ./backup.sh
#
# Required env vars (all have defaults for the standard Docker Compose setup):
#   DATABASE_URL   postgresql+asyncpg://... or plain postgresql:// URL
#   BACKUP_DIR     directory to write dumps into (default: /tmp/kanakku_backups)

set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://kanakku:kanakku@localhost:5432/kanakku}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/kanakku_backups}"

# Strip the asyncpg driver prefix so pg_dump can use the URL directly
PG_URL="${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}"

mkdir -p "${BACKUP_DIR}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTFILE="${BACKUP_DIR}/kanakku_${TIMESTAMP}.dump"

echo "[backup] Dumping database to ${OUTFILE} ..."
pg_dump --format=custom --no-acl --no-owner \
    "${PG_URL}" \
    --file="${OUTFILE}"

echo "[backup] Done. Archive size: $(du -sh "${OUTFILE}" | cut -f1)"
echo "${OUTFILE}"
