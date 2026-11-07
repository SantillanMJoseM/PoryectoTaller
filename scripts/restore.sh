#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -lt 1 ]; then
  echo "Uso: $0 <archivo-backup.tar.gz>"
  exit 1
fi
ARCHIVE="$1"
[ -f "$ARCHIVE" ] || { echo "Archivo no existe: $ARCHIVE" >&2; exit 1; }

echo "ADVERTENCIA: la restauracion sobrescribe datos actuales."
echo "Detenga los servicios antes de restaurar (scripts/stop.sh)."
read -r -p "Continuar? (y/N) " REPLY
case "$REPLY" in [Yy]) ;; *) echo "Cancelado."; exit 0 ;; esac

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
tar -xzf "$ARCHIVE" -C "$WORK"

# Detener (sin borrar volumenes)
docker compose down

# Restaurar PostgreSQL
if [ -f "${WORK}/db.dump" ]; then
  echo "Restaurando base de datos..."
  # Iniciar solo db
  docker compose up -d db
  sleep 8
  # Recrear db limpia? Para seguridad, restaurar sobre existente puede duplicar.
  # Se recomienda volumen vacio para prueba. Aqui se aplica pg_restore --clean.
  docker compose exec -T db pg_restore -U postgres --clean --if-exists -d postgres "${WORK}/db.dump" || true
fi

# Restaurar Storage
if [ -f "${WORK}/storage.tar.gz" ]; then
  echo "Restaurando storage..."
  tar -xzf "${WORK}/storage.tar.gz" -C volumes/storage
fi

# Configuracion (opcional)
if [ -f "${WORK}/env.backup" ]; then
  cp "${WORK}/env.backup" .env.restored
  echo "Configuracion restaurada en .env.restored (revise antes de usar)."
fi

docker compose up -d
echo "Restauracion finalizada. Verifique con scripts/status.sh"
