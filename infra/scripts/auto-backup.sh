#!/usr/bin/env bash
# auto-backup.sh — Nightly backup with rotation for Kanakku PostgreSQL.
#
# Rotation policy:
#   Daily   — 7 most recent   (kanakku_daily_*.dump)
#   Weekly  — 4 most recent Monday backups (kanakku_weekly_*.dump)
#   Monthly — 12 most recent 1st-of-month backups (kanakku_monthly_*.dump)
#
# Usage:
#   BACKUP_DIR=/backups ./auto-backup.sh
#   DATABASE_URL=postgresql://... BACKUP_DIR=/backups ./auto-backup.sh
#
# Recommended cron entry (03:00 daily):
#   0 3 * * * BACKUP_DIR=/var/backups/kanakku DATABASE_URL=postgresql://kanakku:<pass>@localhost:5432/kanakku /opt/kanakku/infra/scripts/auto-backup.sh >> /var/log/kanakku-backup.log 2>&1
#
# Environment variables:
#   DATABASE_URL   postgresql:// or postgresql+asyncpg:// URL
#   BACKUP_DIR     directory to write backups into (default: /tmp/kanakku_backups)
#   KEEP_DAILY     number of daily backups to retain (default: 7)
#   KEEP_WEEKLY    number of weekly backups to retain (default: 4)
#   KEEP_MONTHLY   number of monthly backups to retain (default: 12)
#   DRY_RUN        set to 1 to skip pg_dump (creates empty placeholder, for testing)

set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://kanakku:kanakku@localhost:5432/kanakku}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/kanakku_backups}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${KEEP_MONTHLY:-12}"
DRY_RUN="${DRY_RUN:-0}"

# Strip asyncpg driver prefix so pg_dump can use the URL
PG_URL="${DATABASE_URL/postgresql+asyncpg:\/\//postgresql://}"

mkdir -p "${BACKUP_DIR}"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
# Allow overrides for testing (DRY_RUN=1 DOW=1 DOM=01 ...)
DOW="${DOW:-$(date -u +%u)}"   # 1=Monday … 7=Sunday
DOM="${DOM:-$(date -u +%d)}"   # day of month, zero-padded (01–31)

# ── Daily backup ──────────────────────────────────────────────────────────────

DAILY_FILE="${BACKUP_DIR}/kanakku_daily_${TIMESTAMP}.dump"
echo "[auto-backup] ${TIMESTAMP} — writing daily backup: ${DAILY_FILE}"

if [[ "${DRY_RUN}" == "1" ]]; then
    touch "${DAILY_FILE}"
    echo "[auto-backup] DRY_RUN=1 — skipped pg_dump, created empty placeholder"
else
    pg_dump --format=custom --no-acl --no-owner "${PG_URL}" --file="${DAILY_FILE}"
    echo "[auto-backup] Daily done. Size: $(du -sh "${DAILY_FILE}" | cut -f1)"
fi

# ── Weekly backup (Monday) ────────────────────────────────────────────────────

if [[ "${DOW}" == "1" ]]; then
    WEEKLY_FILE="${BACKUP_DIR}/kanakku_weekly_${TIMESTAMP}.dump"
    cp "${DAILY_FILE}" "${WEEKLY_FILE}"
    echo "[auto-backup] Weekly backup written: ${WEEKLY_FILE}"
fi

# ── Monthly backup (1st of month) ─────────────────────────────────────────────

if [[ "${DOM}" == "01" ]]; then
    MONTHLY_FILE="${BACKUP_DIR}/kanakku_monthly_${TIMESTAMP}.dump"
    cp "${DAILY_FILE}" "${MONTHLY_FILE}"
    echo "[auto-backup] Monthly backup written: ${MONTHLY_FILE}"
fi

# ── Rotation ──────────────────────────────────────────────────────────────────
# Keep the N newest files of each type; delete the rest.

rotate() {
    local prefix="$1"
    local keep="$2"
    local pattern="${BACKUP_DIR}/${prefix}_*.dump"

    # Build a newline-separated list sorted newest-first
    local all
    all="$(ls -t ${pattern} 2>/dev/null || true)"
    if [[ -z "${all}" ]]; then
        return
    fi

    # Skip the first $keep lines; delete everything after
    local to_delete
    to_delete="$(echo "${all}" | tail -n +"$((keep + 1))")"
    if [[ -n "${to_delete}" ]]; then
        while IFS= read -r f; do
            echo "[auto-backup] Removing old backup: ${f}"
            rm -f "${f}"
        done <<< "${to_delete}"
    fi
}

rotate "kanakku_daily"   "${KEEP_DAILY}"
rotate "kanakku_weekly"  "${KEEP_WEEKLY}"
rotate "kanakku_monthly" "${KEEP_MONTHLY}"

echo "[auto-backup] Rotation complete. Remaining counts:"
echo "  daily:   $(ls "${BACKUP_DIR}"/kanakku_daily_*.dump 2>/dev/null | wc -l)"
echo "  weekly:  $(ls "${BACKUP_DIR}"/kanakku_weekly_*.dump 2>/dev/null | wc -l)"
echo "  monthly: $(ls "${BACKUP_DIR}"/kanakku_monthly_*.dump 2>/dev/null | wc -l)"
