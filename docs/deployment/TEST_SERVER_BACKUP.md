# Test Server Backup

Backup pre-despliegue:
- PostgreSQL Supabase: /home/developer/backups-taller/supabase_postgres_20261109_112201.sql
- Storage: volumen Docker supabase_storage_sistema-taller (respaldo manual si se requiere)

Backup nueva arquitectura:
- pg_dump -h localhost -p 5433 -U taller -d taller > backup.sql
- tar del volumen storage (taller-postgres_storage)
