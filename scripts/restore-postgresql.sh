#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"
echo "ADVERTENCIA: Esta operación sobrescribirá la base de datos actual."
read -p "Escriba RESTAURAR para continuar: " CONFIRM
if [ "$CONFIRM" != "RESTAURAR" ]; then echo "Cancelado."; exit 1; fi
read -p "Ruta del archivo SQL de backup: " SQLFILE
if [ ! -f "$SQLFILE" ]; then echo "Archivo no encontrado."; exit 1; fi
docker compose exec -T postgres psql -U taller -d taller < "$SQLFILE"
echo "[OK] Restauración finalizada."
