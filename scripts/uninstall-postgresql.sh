#!/usr/bin/env bash
set -euo pipefail
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"
echo "Esto detendrá los contenedores. Los datos NO se eliminarán por defecto."
read -p "¿Continuar? (s/N): " CONFIRM
if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then echo "Cancelado."; exit 1; fi
docker compose down
echo "Contenedores detenidos. Volúmenes preservados."
read -p "¿Eliminar también los volúmenes de datos? (s/N): " DEL
if [ "$DEL" = "s" ] || [ "$DEL" = "S" ]; then
  read -p "Escriba ELIMINAR para confirmar: " CONFIRM2
  if [ "$CONFIRM2" = "ELIMINAR" ]; then
    docker compose down -v
    echo "Volúmenes eliminados."
  else
    echo "Cancelado."
  fi
fi
