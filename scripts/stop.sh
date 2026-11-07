#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# No eliminar volúmenes: nunca usar -v aquí.
docker compose down
