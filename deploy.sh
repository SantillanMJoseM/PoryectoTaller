#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Vite carga .env.local (mayor prioridad) o .env durante `npm run build`.
# Se acepta cualquiera de los dos; ninguno se versiona (ver .gitignore).
if [ -f ".env.local" ]; then
  ENV_FILE=".env.local"
elif [ -f ".env" ]; then
  ENV_FILE=".env"
else
  echo "ERROR: falta .env.local o .env (copiar .env.example y completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY)" >&2
  exit 1
fi
echo "Build con variables de $ENV_FILE"

export PATH="${PATH}:/home/developer/.local/node/bin"
npm ci
npm run build
echo "Build listo en dist/"
