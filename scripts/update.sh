#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 1. Comprobar estado =="
docker compose ps

echo "== 2. Verificar espacio disponible =="
AVAIL_KB=$(df -k . | awk 'NR==2 {print $4}')
if [ "${AVAIL_KB:-0}" -lt 1048576 ]; then
  echo "ERROR: menos de 1 GB libre. Abortar." >&2
  exit 1
fi

echo "== 3. Backup previo =="
sh scripts/backup.sh

echo "== 4. Obtener imágenes =="
docker compose pull

echo "== 5. Regenerar migraciones empaquetadas =="
rm -f volumes/db/app-migrations.sql
for f in supabase/migrations/*.sql; do
  case "$f" in *0005_storage.sql) continue ;; esac
  cat "$f" >> volumes/db/app-migrations.sql
  echo "" >> volumes/db/app-migrations.sql
done
cp -f supabase/seed.sql volumes/db/seed.sql

echo "== 6. Recrear servicios (preservando volúmenes) =="
docker compose up -d --remove-orphans

echo "Aplicando migracion de Storage (si corresponde)..."
docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=0 < volumes/db/storage-migrations.sql >/dev/null 2>&1 || true

echo "== 7. Verificar salud =="
sleep 10
docker compose ps

echo "== 8. Comprobar aplicación =="
sh scripts/diagnose.sh >/dev/null 2>&1 || true
echo "Actualización finalizada. Revise logs si algún servicio no está healthy."
