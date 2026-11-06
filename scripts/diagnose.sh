#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== docker compose ps =="
docker compose ps

echo
echo "== supabase status =="
supabase status
