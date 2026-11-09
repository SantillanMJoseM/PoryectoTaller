#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_DIR="$(pwd)"

# --- Dependencias -------------------------------------------------------------
for c in docker openssl; do
  command -v "$c" >/dev/null 2>&1 || { echo "ERROR: falta dependencia: $c" >&2; exit 1; }
done
docker compose version >/dev/null 2>&1 || { echo "ERROR: docker compose no disponible" >&2; exit 1; }

# --- Directorios persistentes ------------------------------------------------
mkdir -p volumes/db/data volumes/storage volumes/snippets volumes/functions \
         volumes/proxy volumes/logs volumes/pooler volumes/api/envoy volumes/db/init

# --- Migraciones empaquetadas (regenerar siempre, idempotente) ---------------
rm -f volumes/db/app-migrations.sql
for f in supabase/migrations/*.sql; do
  case "$f" in *0005_storage.sql) continue ;; esac
  cat "$f" >> volumes/db/app-migrations.sql
  echo "" >> volumes/db/app-migrations.sql
done
cp -f supabase/seed.sql volumes/db/seed.sql
cp -f supabase/functions/portal-login/index.ts volumes/functions/portal-login/index.ts

# --- Configuración .env ------------------------------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Generando secretos..."
  sh utils/generate-keys.sh --update-env >/dev/null
  sh utils/add-new-auth-keys.sh --update-env >/dev/null || true
  # Generar contraseña interna del portal si falta
  if ! grep -q '^PORTAL_CLIENT_PASSWORD=.' .env; then
    pp="$(openssl rand -hex 16)"
    if grep -q '^PORTAL_CLIENT_PASSWORD=' .env; then
      sed -i "s|^PORTAL_CLIENT_PASSWORD=.*|PORTAL_CLIENT_PASSWORD=${pp}|" .env
    else
      echo "PORTAL_CLIENT_PASSWORD=${pp}" >> .env
    fi
  fi

  # Generar contraseña inicial del administrador si falta
  if ! grep -q '^ADMIN_INITIAL_PASSWORD=.' .env; then
    ap="$(openssl rand -base64 18 | tr -d '\n')"
    if grep -q '^ADMIN_INITIAL_PASSWORD=' .env; then
      sed -i "s|^ADMIN_INITIAL_PASSWORD=.*|ADMIN_INITIAL_PASSWORD=${ap}|" .env
    else
      echo "ADMIN_INITIAL_PASSWORD=${ap}" >> .env
    fi
  fi
fi

# Host público (opcional): --host http://IP
HOST_URL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --host) HOST_URL="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ -z "$HOST_URL" ]; then
  IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [ -n "$IP" ]; then HOST_URL="http://${IP}"; else HOST_URL="http://localhost"; fi
fi

# Actualizar URLs si no están personalizadas (solo valores por defecto)
if grep -q '^SUPABASE_PUBLIC_URL=http://localhost' .env; then
  sed -i "s|^SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=${HOST_URL}:8000|" .env
fi
if grep -q '^API_EXTERNAL_URL=http://localhost' .env; then
  sed -i "s|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=${HOST_URL}:8000/auth/v1|" .env
fi
if grep -q '^SITE_URL=http://localhost' .env; then
  sed -i "s|^SITE_URL=.*|SITE_URL=${HOST_URL}|" .env
fi

# Asegurar token cloudflare vacío si no existe
grep -q '^CLOUDFLARE_TUNNEL_TOKEN=' .env || echo 'CLOUDFLARE_TUNNEL_TOKEN=' >> .env

# --- Detección de instalación existente --------------------------------------
if [ -s volumes/db/data/PG_VERSION 2>/dev/null ]; then
  echo "Instalación existente con datos detectada. No se resiembra."
else
  echo "Instalación nueva: los datos se crearán en el primer arranque."
fi

# --- Build + arranque --------------------------------------------------------
echo "Construyendo frontend..."
docker compose build frontend

echo "Iniciando servicios..."
docker compose up -d

echo "Esperando healthchecks..."
for i in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 2
done

echo "Aplicando migracion de Storage (si corresponde)..."
for i in $(seq 1 30); do
  if docker compose ps storage 2>/dev/null | grep -q healthy; then break; fi
  sleep 2
done
docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=0 < volumes/db/storage-migrations.sql >/tmp/opencode/storage-mig.log 2>&1 || true
cat /tmp/opencode/storage-mig.log | tail -5

# Esperar a que Edge Functions esté disponible
for i in $(seq 1 30); do
  if docker compose ps functions 2>/dev/null | grep -q healthy; then break; fi
  sleep 2
done
sleep 8

# Crear administrador inicial si no existe (idempotente)
ADMIN_EMAIL="admin@taller.com"
ADMIN_PASS="$(grep '^ADMIN_INITIAL_PASSWORD=' .env | cut -d= -f2-)"
SERVICE_KEY="$(grep '^SERVICE_ROLE_KEY=' .env | cut -d= -f2-)"
API_URL="$(grep '^SUPABASE_PUBLIC_URL=' .env | cut -d= -f2-)"
if [ -n "$ADMIN_PASS" ] && [ -n "$SERVICE_KEY" ]; then
  echo "Inicializando administrador inicial (${ADMIN_EMAIL})..."
  curl -s -X POST "${API_URL}/functions/v1/admin-usuarios"     -H "Authorization: Bearer ${SERVICE_KEY}"     -H "apikey: ${SERVICE_KEY}"     -H 'Content-Type: application/json'     -d "{\"action\":\"bootstrap\",\"correo\":\"${ADMIN_EMAIL}\",\"contrasena\":\"${ADMIN_PASS}\",\"nombre\":\"Administrador\",\"usuario_id\":\"00000000-0000-4000-8000-000000000011\"}"     >/tmp/opencode/bootstrap.log 2>&1 || true
  cat /tmp/opencode/bootstrap.log | tail -3
fi

sleep 5
docker compose ps

echo ""
echo "Instalación completada."
echo "Frontend: ${HOST_URL}"
echo "API:      ${HOST_URL}:8000"
echo "Studio:   ${HOST_URL}:54323 (solo red local)"
