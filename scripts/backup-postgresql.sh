#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"
BACKUP_DIR="$APP_DIR/backups"
mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/taller_backup_${TS}.tar.gz"
echo "[INFO] Creando backup PostgreSQL..."
docker compose exec -T postgres pg_dump -U taller -d taller > "$BACKUP_DIR/db_${TS}.sql"
echo "[INFO] Comprimiendo..."
tar -czf "$FILE" -C "$APP_DIR" .env volumes 2>/dev/null || true
echo "[OK] Backup creado: $FILE"
ls -lh "$BACKUP_DIR/db_${TS}.sql"
