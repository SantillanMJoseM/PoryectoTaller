#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"
echo "[INFO] Realizando backup previo..."
bash "$APP_DIR/scripts/backup-postgresql.sh"
echo "[INFO] Descargando cambios..."
git pull origin migration/postgres-puro
echo "[INFO] Construyendo imágenes..."
docker compose up -d --build
echo "[INFO] Aplicando migraciones (automático en backend)..."
docker compose logs backend --tail 20
echo "[OK] Actualización finalizada."
