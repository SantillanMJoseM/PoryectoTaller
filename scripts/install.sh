#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then cp .env.example .env; echo "Edita .env antes de continuar"; exit 1; fi
npm ci
npm run build
echo "Instalación local preparada. Ejecuta scripts/start.sh"
