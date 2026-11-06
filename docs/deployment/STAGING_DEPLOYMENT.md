# Staging Deployment — Sistema Taller

Procedimiento:
1. Copiar .env.example a .env y completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (instancia staging, no producción).
2. Ejecutar `./deploy.sh` (npm ci + npm run build).
3. Publicar `dist/` en hosting estático de staging.
4. Aplicar migraciones Supabase en staging (0001-0006).
5. Validar flujos y RLS con dos usuarios de prueba.

Rollback:
- Revertir a commit anterior y redeploy.
- Restaurar backup de base de datos staging.

Limitación: no se ejecutó despliegue real en este entorno.
