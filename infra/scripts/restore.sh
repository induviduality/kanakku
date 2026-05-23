#!/usr/bin/env bash
# restore.sh — restore a Kanakku pg_dump archive into the target database.
#
# Usage:
#   DUMP_FILE=/backups/kanakku_20260101T000000Z.dump ./restore.sh
#   DUMP_FILE=./kanakku.dump DATABASE_URL=postgresql://user:pass@host/db ./restore.sh
#
# Required env vars:
#   DUMP_FILE      path to the .dump file produced by backup.sh
#   DATABASE_URL   postgresql+asyncpg://... or plain postgresql:// URL
#
# WARNING: This drops and recreates the public schema — all existing data is lost.

set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://kanakku:kanakku@localhost:5432/kanakku}"
DUMP_FILE="${DUMP_FILE:-}"

if [[ -z "${DUMP_FILE}" ]]; then
    echo "ERROR: DUMP_FILE must be set to the path of a .dump file" >&2
    exit 1
fi

if [[ ! -f "${DUMP_FILE}" ]]; then
    echo "ERROR: Dump file not found: ${DUMP_FILE}" >&2
    exit 1
fi

PG_URL="${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}"

echo "[restore] Dropping public schema and recreating ..."
psql "${PG_URL}" --command="DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "[restore] Restoring from ${DUMP_FILE} ..."
pg_restore --no-acl --no-owner --format=custom \
    --dbname="${PG_URL}" \
    "${DUMP_FILE}"

echo "[restore] Done."
