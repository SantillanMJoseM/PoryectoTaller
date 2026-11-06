#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Backend local (Postgres, Auth, REST, Storage, Studio) gestionado por Supabase CLI.
supabase start

# Frontend: nginx sirve dist/ en el puerto 80 (LAN: http://192.168.1.43).
docker compose up -d
