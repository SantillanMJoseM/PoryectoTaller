#!/usr/bin/env bash
set -euo pipefail

APP_NAME="Sistema Taller"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
ENV_FILE="$APP_DIR/.env"
BACKUP_DIR="$APP_DIR/backups"
CRED_FILE="/root/sistema-taller-credentials.txt"
LOG_FILE="$APP_DIR/install.log"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info(){ echo -e "${BLUE}[INFO]${NC} $*"; }
ok(){ echo -e "${GREEN}[OK]${NC} $*"; }
warn(){ echo -e "${YELLOW}[WARN]${NC} $*"; }
err(){ echo -e "${RED}[ERROR]${NC} $*" >&2; }

# Requiere root
if [ "$(id -u)" -ne 0 ]; then
  err "Este instalador debe ejecutarse como root (sudo)."
  exit 1
fi

exec > >(tee -a "$LOG_FILE") 2>&1

echo "=========================================="
echo "  $APP_NAME — Instalador PostgreSQL"
echo "=========================================="

# ---------- F0: Verificación del sistema ----------
info "Verificando sistema..."
if [ -f /etc/os-release ]; then
  . /etc/os-release
  info "Distribución: $NAME $VERSION_ID"
  if [ "$ID" != "debian" ]; then warn "Distribución no Debian. Optimizado para Debian 13."; fi
else
  err "No se pudo detectar la distribución."
  exit 1
fi

ARCH="$(uname -m)"
info "Arquitectura: $ARCH"
RAM_MB="$(free -m | awk '/^Mem:/{print $2}')"
DISK_GB="$(df -BG "$APP_DIR" | awk 'NR==2{print $4}' | tr -d 'G')"
info "RAM: ${RAM_MB} MB | Espacio disponible: ${DISK_GB} GB"
if [ "$RAM_MB" -lt 1024 ]; then warn "Se recomiendan al menos 1 GB de RAM."; fi
if [ "$DISK_GB" -lt 5 ]; then err "Se requieren al menos 5 GB de espacio libre."; exit 1; fi

# Internet
if ! curl -fsSL --max-time 10 https://www.google.com >/dev/null 2>&1; then
  warn "No se pudo verificar conexión a Internet. Continuando..."
fi

# Puertos
for p in 80 4000 5432; do
  if ss -tlnp 2>/dev/null | grep -q ":$p "; then warn "El puerto $p ya está en uso."; fi
done

# ---------- F1: Instalación de dependencias ----------
info "Instalando dependencias base..."
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release git openssl

if ! command -v docker >/dev/null 2>&1; then
  info "Instalando Docker Engine..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  ok "Docker instalado."
else
  ok "Docker ya está instalado: $(docker --version)"
fi

if ! docker compose version >/dev/null 2>&1; then
  err "Docker Compose Plugin no disponible."
  exit 1
fi

# ---------- F2: Configuración automática ----------
if [ -f "$ENV_FILE" ]; then
  warn "Ya existe $ENV_FILE. No se sobrescribirán secretos existentes."
else
  info "Generando .env seguro..."
  SERVER_IP="$(hostname -I | awk '{print $1}')"
  [ -z "$SERVER_IP" ] && SERVER_IP="127.0.0.1"
  PG_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)"
  JWT_ACCESS="$(openssl rand -hex 32)"
  JWT_REFRESH="$(openssl rand -hex 32)"
  ADMIN_PASS="$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)A1"
  cat > "$ENV_FILE" <<EOF
# Generado por install-postgresql.sh — $(date -u)
VITE_API_URL=

DATABASE_URL=postgresql://taller:${PG_PASS}@postgres:5432/taller
JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
STORAGE_DIR=/data/storage
CORS_ORIGIN=*
ADMIN_EMAIL=admin@taller.com
ADMIN_PASSWORD=${ADMIN_PASS}
FORCE_PASSWORD_CHANGE=true
EOF
  chmod 600 "$ENV_FILE"
  # credenciales protegidas
  cat > "$CRED_FILE" <<EOF
Sistema Taller — Credenciales iniciales (generadas $(date -u))
URL: http://${SERVER_IP}:8080
Correo: admin@taller.com
Contraseña inicial: ${ADMIN_PASS}
IMPORTANTE: Cambie la contraseña durante el primer ingreso.
EOF
  chmod 600 "$CRED_FILE"
  ok ".env generado. Credenciales en $CRED_FILE (permisos 600)."
fi

# ---------- Instalación previa ----------
if docker compose -f "$COMPOSE_FILE" ps -q 2>/dev/null | grep -q .; then
  warn "Se detectó una instalación previa. No se borrarán datos."
fi

mkdir -p "$BACKUP_DIR"

# ---------- F3: Construcción y despliegue ----------
info "Construyendo imágenes y levantando servicios..."
cd "$APP_DIR"
docker compose -f "$COMPOSE_FILE" up -d --build 2>&1 | tail -20

info "Esperando a que PostgreSQL esté healthy..."
for i in $(seq 1 60); do
  if docker compose -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -q "healthy"; then
    ok "PostgreSQL healthy."
    break
  fi
  sleep 2
done

info "Esperando a que el backend esté disponible..."
for i in $(seq 1 60); do
  if docker compose -f "$COMPOSE_FILE" ps backend 2>/dev/null | grep -q "Up"; then
    sleep 4
    break
  fi
  sleep 2
done

# ---------- F4: Pruebas de conectividad ----------
info "Ejecutando pruebas de conectividad..."
SERVER_IP="$(hostname -I | awk '{print $1}')"
if curl -sf "http://${SERVER_IP}:8080/" >/dev/null; then ok "Frontend accesible."; else warn "Frontend no responde aún."; fi
if curl -sf "http://${SERVER_IP}:4000/api/docs" >/dev/null; then ok "API docs accesible."; else warn "API docs no responde aún."; fi

# ---------- Resumen ----------
ADMIN_PASS_DISPLAY=""
if [ -f "$CRED_FILE" ]; then ADMIN_PASS_DISPLAY="$(grep 'Contraseña inicial' "$CRED_FILE" | cut -d: -f2- | xargs)"; fi

echo ""
echo "=================================================="
echo "          SISTEMA TALLER - INSTALACION OK"
echo "=================================================="
echo ""
echo "Aplicacion: http://${SERVER_IP}:8080"
echo ""
echo "USUARIO ADMINISTRADOR INICIAL"
echo ""
echo "Correo: admin@taller.com"
echo "Contraseña: ${ADMIN_PASS_DISPLAY}"
echo ""
echo "IMPORTANTE:"
echo "Debe cambiar la contraseña durante el primer ingreso."
echo ""
echo "=================================================="
echo ""
echo "Credenciales guardadas en: $CRED_FILE (permisos 600)"
echo "Backups: $BACKUP_DIR"
echo "Logs: $LOG_FILE"
echo ""
echo "Comandos útiles:"
echo "  Estado:  bash $APP_DIR/scripts/status-postgresql.sh"
echo "  Logs:    docker compose -f $COMPOSE_FILE logs -f"
echo "  Backup:  bash $APP_DIR/scripts/backup-postgresql.sh"
echo "=================================================="
