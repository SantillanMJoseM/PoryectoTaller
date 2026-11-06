# Installation Package — Sistema Taller

## Contenido

- Código fuente completo (`src/`, `supabase/`, `scripts/`, `docs/`).
- `docker-compose.yml` (frontend nginx).
- `nginx.conf`.
- `supabase/config.toml`.
- `supabase/migrations/0001–0007`.
- `supabase/functions/portal-login`.
- `supabase/seed.sql`.
- `.env.example`.
- Scripts: `install.sh`, `deploy.sh`, `start.sh`, `stop.sh`, `diagnose.sh`.
- Documentación de despliegue y recuperación.

## Requisitos del servidor

- Debian 12/13 (u otra distribución compatible).
- Docker Engine + Docker Compose.
- Node.js 22 (o >= 20).
- Supabase CLI.
- Acceso a Internet para la instalación inicial.

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Instalación

```bash
npm ci
npm test
npm run build
./scripts/start.sh
```

## Persistencia

- Volumen Docker de Supabase (PostgreSQL).
- `dist/` para el frontend.
- Buckets de Storage para logos/anexos/documentos.

## Backup y restore

Ver `docs/deployment/LOCAL_DEPLOYMENT.md`.
