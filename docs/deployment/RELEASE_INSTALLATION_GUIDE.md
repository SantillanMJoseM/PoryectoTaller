# Release Installation Guide — Sistema Taller

## Requisitos

- Node.js 22 (o >= 20)
- npm
- Docker Engine + Docker Compose
- Supabase CLI
- Git

## Instalación reproducible

```bash
git clone <URL_DEL_REPOSITORIO>
cd sistema-taller
cp .env.example .env.local
# Editar .env.local:
# VITE_SUPABASE_URL=http://<IP_SERVIDOR>:54321
# VITE_SUPABASE_ANON_KEY=<anon key local>
npm ci
npm test
npm run build
./scripts/start.sh
```

## Servicios

- Frontend: `http://<IP_SERVIDOR>` (puerto 80)
- Supabase API: `http://<IP_SERVIDOR>:54321`
- PostgreSQL: `<IP_SERVIDOR>:54322`
- Studio: `http://<IP_SERVIDOR>:54323`
- Mailpit: `http://<IP_SERVIDOR>:54324`

## Migraciones

Se aplican automáticamente con `supabase start` en orden 0001–0007.

## Credenciales

Ver `docs/deployment/LOCAL_CREDENTIALS.md` (archivo local, no versionado).

## Backup y recuperación

Ver `docs/deployment/LOCAL_DEPLOYMENT.md`.
