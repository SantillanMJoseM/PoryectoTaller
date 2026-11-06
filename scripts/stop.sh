#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Orden inverso al arranque: primero el frontend nginx, luego el stack de Supabase.
docker compose down
supabase stop
