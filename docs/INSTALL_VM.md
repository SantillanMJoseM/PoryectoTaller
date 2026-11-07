# Instalación en VM (Debian)

## Requisitos

- VM Debian 12/13.
- Docker Engine + Compose.
- 4 GB RAM, 20 GB disco.

## Pasos

1. Instalar Docker.
2. Copiar el paquete del proyecto a la VM.
3. Ejecutar:
   ```bash
   ./scripts/install.sh --host http://<IP_DE_LA_VM>
   ```
4. Verificar healthchecks:
   ```bash
   ./scripts/status.sh
   ```
5. Acceder a `http://<IP_DE_LA_VM>`.

## Persistencia

Los datos se guardan en `volumes/db/data` y `volumes/storage`. Realice backups periódicos con `scripts/backup.sh`.
