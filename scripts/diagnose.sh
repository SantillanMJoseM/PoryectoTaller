#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== docker compose ps =="
docker compose ps
echo
echo "== volúmenes =="
docker volume ls | grep -E 'sistema-taller|db-config|deno-cache' || true
echo
echo "== espacio =="
df -h . | tail -1
echo
echo "== .env (sin secretos) =="
grep -E '^(SUPABASE_PUBLIC_URL|SITE_URL|API_EXTERNAL_URL|POSTGRES_PORT|COMPOSE_FILE)=' .env || true
