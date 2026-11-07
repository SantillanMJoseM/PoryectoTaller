# Actualización segura

1. Comprobar estado: `./scripts/status.sh`.
2. Verificar espacio libre.
3. Backup: `./scripts/backup.sh`.
4. Actualizar: `./scripts/update.sh`.

El script `update.sh` realiza:

- Comprobación de estado y espacio.
- Backup previo.
- `docker compose pull`.
- Regeneración de migraciones empaquetadas.
- `docker compose up -d` (preserva volúmenes).
- Verificación de salud.

No actualiza versiones mayores de PostgreSQL/Supabase sin migración probada.
