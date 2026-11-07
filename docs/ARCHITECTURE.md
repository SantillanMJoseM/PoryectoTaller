# Arquitectura — Sistema Taller (paquete Docker portable)

## Componentes

- **Frontend**: SPA React/Vite servida por Nginx (imagen construida localmente).
- **API Gateway**: Envoy (supabase self-hosted) en el puerto 8000.
- **Auth**: GoTrue.
- **REST**: PostgREST.
- **Realtime**: Supabase Realtime.
- **Storage**: Supabase Storage + ImgProxy.
- **PostgreSQL**: Supabase Postgres 17 (imagen fijada).
- **Pooler**: Supavisor.
- **Studio**: panel de administración (puerto 54323, solo red local).
- **Mailpit**: correo de prueba (puerto 54324).
- **Edge Functions**: runtime Deno; incluye `portal-login`.
- **Cloudflared**: túnel opcional (perfil `tunnel`).

## Puertos

- 80: frontend (HTTP).
- 8000: API Supabase (REST/Auth/Storage/Functions).
- 54321: alias API (compatibilidad, mismo gateway).
- 54322: PostgreSQL (no exponer a Internet).
- 54323: Studio (solo LAN).
- 54324: Mailpit.

## Persistencia

- `volumes/db/data`: datos PostgreSQL.
- `volumes/storage`: archivos de Storage.
- Volumen nombrado `db-config`: clave pgsodium.
- Volumen nombrado `deno-cache`: caché Deno.

## No exponer

PostgreSQL, Studio, Mailpit y servicios internos no deben publicarse a Internet. Solo frontend (80) y API (8000) se exponen, idealmente mediante Cloudflare Tunnel.
