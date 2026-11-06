# Local Deployment — Sistema Taller

IP LAN del LXC: 192.168.1.43

Limitación: Docker no está instalado en este entorno y no se pudo instalar sin privilegios de root. Se preparó docker-compose.yml, nginx.conf y scripts, pero el despliegue real no se ejecutó aquí.

Procedimiento:
1. Instalar Docker + Compose (requiere root) o usar entorno con permisos.
2. Copiar .env.example a .env y completar VITE_SUPABASE_URL/ANON_KEY (instancia local).
3. Ejecutar scripts/install.sh
4. Ejecutar scripts/start.sh
5. Aplicar migraciones 0001-0006 en Postgres/Supabase.
6. Acceder a http://192.168.1.43

Persistencia: volumen db_data.
