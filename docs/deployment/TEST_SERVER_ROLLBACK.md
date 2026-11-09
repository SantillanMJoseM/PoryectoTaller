# Test Server Rollback

1. Detener nueva stack: cd /home/developer/taller-postgres && docker compose down (sin -v)
2. Restaurar Supabase stack: docker compose up en el directorio original de Sistema Taller.
3. Restaurar DB si es necesario: docker exec supabase_db_sistema-taller psql ... < backup.sql
4. La rama main permanece estable; la migración está aislada en migration/postgres-puro.

No se eliminaron volúmenes. Rollback sin pérdida de datos.
