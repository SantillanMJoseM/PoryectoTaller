# Upgrade & Rollback — Sistema Taller

## Actualización

```bash
git pull
npm ci
npm test
npm run build
./scripts/start.sh
```

## Rollback de frontend

1. Restaurar el `dist/` anterior.
2. `docker compose up -d`.
3. Verificar `http://<IP>/`.

## Rollback de base de datos

- Usar backup SQL o PITR de Supabase.
- No ejecutar migraciones a la inversa automáticamente.

## Restricciones

- No borrar volúmenes sin backup.
- No usar force push.
- No publicar en remotos.
