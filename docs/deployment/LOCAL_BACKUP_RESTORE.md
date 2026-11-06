# Local Backup & Restore — Sistema Taller

Backup: docker compose exec db pg_dump -U postgres sistema_taller > backup.sql
Restore: docker compose exec -T db psql -U postgres sistema_taller < backup.sql
Reinicio: scripts/stop.sh && scripts/start.sh
Actualización: git pull && scripts/install.sh && scripts/start.sh
