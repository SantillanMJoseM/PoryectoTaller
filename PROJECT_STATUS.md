# PROJECT_STATUS — Sistema Taller

- Status: COMPLETED — despliegue local real verificado
- Stack: React + TypeScript + Tailwind + shadcn/ui + Supabase (self-hosted vía Supabase CLI)
- Build: OK (`npm run build`, `dist/` generado)
- Tests: 153/153 passed (`npm test` sin `.env`)
- Módulos: 17 implementados y navegables
- Migraciones: 0001–0006 aplicadas en Supabase local
- RLS: habilitado en 23/23 tablas públicas
- Deploy local: verificado en LXC Debian 13 — http://192.168.1.43
- Servicios: frontend nginx :80, Supabase API :54321, PostgreSQL :54322, Studio :54323, Mailpit :54324
- Fecha de cierre: 2026-11-06
