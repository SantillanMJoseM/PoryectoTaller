# Cloudflare Tunnel (opcional)

## Requisitos

- Cuenta Cloudflare con Zero Trust.
- Túnel creado y token.

## Configuración

1. Colocar el token en `.env`:
   ```
   CLOUDFLARE_TUNNEL_TOKEN=<token>
   ```
2. Activar el perfil:
   ```bash
   docker compose --profile tunnel up -d
   ```

## Reglas

- No guardar tokens en Git (`.env` está git-ignorado).
- No exponer PostgreSQL ni servicios internos.
- Exponer solo frontend (80) y, si se requiere acceso remoto a la API, el punto HTTP autorizado (8000).
- El sistema sigue funcionando localmente si Cloudflare no está conectado.
- El túnel se reinicia automáticamente (`restart: unless-stopped`).
