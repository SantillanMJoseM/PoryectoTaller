#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f ".env" ]; then
  echo "ERROR: falta .env (copiar .env.example y completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY)" >&2
  exit 1
fi

export PATH="${PATH}:/home/developer/.local/node/bin"
npm ci
npm run build
echo "Build listo en dist/"
