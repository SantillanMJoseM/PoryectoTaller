# Backup y restauración

## Backup

```bash
./scripts/backup.sh
```

Genera `backups/sistema-taller-backup-<fecha>.tar.gz` con:

- Dump de PostgreSQL (formato custom).
- Archivo tar de Storage.
- Copia de `.env`.
- Metadatos.

Retención configurable con `BACKUP_RETENTION` (por defecto 7).

## Verificación de integridad

El script ejecuta `gzip -t` sobre el archivo. Para verificar manualmente:

```bash
gzip -t backups/sistema-taller-backup-*.tar.gz && echo OK
```

## Restauración

**Nunca probar restauraciones sobre el despliegue real.** Use un entorno independiente.

```bash
./scripts/stop.sh
./scripts/restore.sh backups/sistema-taller-backup-<fecha>.tar.gz
```

La restauración no borra los volúmenes por defecto; para una prueba limpia, detenga y vacíe `volumes/db/data` y `volumes/storage` en el entorno de prueba antes de restaurar.

## Reglas

- No usar `docker compose down -v`.
- Los scripts de parada/actualización no eliminan datos.
