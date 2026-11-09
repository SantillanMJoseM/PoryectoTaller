#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"
echo "=== Estado de servicios ==="
docker compose ps
echo ""
echo "=== Salud PostgreSQL ==="
docker compose exec -T postgres pg_isready -U taller -d taller || true
echo ""
echo "=== Espacio disponible ==="
df -h "$APP_DIR" | tail -1
echo ""
echo "=== IP del servidor ==="
hostname -I | awk '{print $1}'
