#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION="${BACKUP_RETENTION:-7}"
mkdir -p "$BACKUP_DIR"

TS="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${BACKUP_DIR}/sistema-taller-backup-${TS}.tar.gz"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Backup PostgreSQL (formato custom)..."
if ! docker compose exec -T db pg_dump -U postgres -Fc postgres > "${WORK}/db.dump" 2>"${WORK}/db.err"; then
  echo "ERROR: pg_dump fallo:" >&2
  cat "${WORK}/db.err" >&2
  exit 1
fi

echo "Backup Storage..."
tar -czf "${WORK}/storage.tar.gz" -C volumes/storage . 2>/dev/null || true

echo "Backup configuracion..."
cp .env "${WORK}/env.backup" 2>/dev/null || true
printf 'fecha=%s\nhost=%s\n' "$TS" "$(hostname)" > "${WORK}/metadata.txt"

echo "Empaquetando..."
tar -czf "$ARCHIVE" -C "$WORK" .
if ! gzip -t "$ARCHIVE"; then
  echo "ERROR: archivo de backup corrupto" >&2
  exit 1
fi

echo "Backup creado: $ARCHIVE"

ls -1t "${BACKUP_DIR}"/sistema-taller-backup-*.tar.gz 2>/dev/null | tail -n +$((RETENTION+1)) | xargs -r rm -f

echo "Backups disponibles:"
ls -lh "${BACKUP_DIR}"/sistema-taller-backup-*.tar.gz 2>/dev/null | tail -5
