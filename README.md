# Sistema Taller

Aplicación web de gestión para talleres y servicios técnicos.

Stack: React + TypeScript + Tailwind CSS + shadcn/ui + Supabase.

## Scripts

- `npm install`
- `npm run dev`
- `npm run build`
- `npm test`

## Despliegue local

Ver `docs/deployment/LOCAL_DEPLOYMENT.md`.

Resumen:

```bash
cp .env.example .env.local
# completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
./deploy.sh
./scripts/start.sh
```

Acceso: `http://192.168.1.43` (o la IP del servidor).

## Estructura

- `src/` frontend
- `supabase/migrations/` esquema, RLS y migraciones (0001–0007)
- `supabase/functions/` Edge Functions (`portal-login`)
- `docs/` documentación por módulo
- `scripts/` instalación, inicio, parada y diagnóstico
