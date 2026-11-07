# Instalación en LXC (Debian 13)

## Requisitos

- LXC con Debian 13, acceso root.
- Docker Engine + plugin Compose instalados.
- Git (opcional, para clonar).
- 4 GB RAM mínimo, 20 GB disco.

## Pasos

1. Instalar Docker (si no está):
   ```bash
   apt-get update && apt-get install -y docker.io docker-compose-plugin
   systemctl enable --now docker
   ```
2. Clonar/copiar el proyecto:
   ```bash
   git clone <repo-url> sistema-taller
   cd sistema-taller
   ```
   o copiar el paquete publicado.
3. Instalar:
   ```bash
   ./scripts/install.sh --host http://<IP_DEL_LXC>
   ```
   El instalador crea `.env`, genera secretos, construye el frontend y arranca los servicios.
4. Verificar:
   ```bash
   ./scripts/status.sh
   ./scripts/diagnose.sh
   ```
5. Acceder a `http://<IP_DEL_LXC>`.

## Actualización

Ver `docs/UPDATE.md`.

## Backup

Ver `docs/BACKUP_RESTORE.md`.

## Notas

- No use `docker compose down -v`: borra los datos.
- Studio (54323) solo para administración local.
