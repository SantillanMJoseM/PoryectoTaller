# Authentication Fix Report — Sistema Taller

Fecha: 2026-11-06

## Problema

El login administrativo se mostraba, pero tras ingresar el dashboard aparecía un instante y la app volvía al login.

Evidencias capturadas:

- `POST /auth/v1/token?grant_type=password` → 400 en el navegador (credenciales/perfil).
- `GET /rest/v1/usuarios?...` → 400.
- `POST /functions/v1/portal-login` → 404 (Edge Function no desplegada).

## Causa raíz

1. La consulta del perfil usaba una relación PostgREST incorrecta:

```ts
.select("*, permisos:id_permiso(*)")
```

PostgREST busca la FK desde `usuarios` hacia `permisos`. La FK es `permiso_id`, no `id_permiso`. Resultado: `PGRST200` y HTTP 400.

2. Al fallar la carga del perfil, `autenticacionService.iniciar` trataba al usuario como inexistente y cerraba la sesión, provocando el regreso al login.

3. `AuthContext` acoplaba la sesión de Supabase a la carga del perfil: si el perfil fallaba, `user` quedaba `null`.

4. La Edge Function `portal-login` no existía, por lo que el portal del cliente devolvía 404 y no podía emitir una sesión con rol `cliente`.

## Correcciones aplicadas

- `src/services/autenticacion.ts`:
  - relación corregida a `permisos:permiso_id(*)` en `iniciar` y `sesionActual`;
  - si falla la carga del perfil por error de BD/PostgREST, se lanza un error sin cerrar la sesión de Supabase.
- `src/contexts/AuthContext.tsx`:
  - la sesión de Supabase se conserva aunque falle la carga del perfil (`setUser(await usuarioSupabase())` independiente de `sesion`).
- `supabase/functions/portal-login/index.ts`:
  - nueva Edge Function que valida correo+documento contra `clientes` usando service role y emite una sesión Supabase con `app_metadata.rol=cliente` y `cliente_id`.

## Archivos modificados

- `src/services/autenticacion.ts`
- `src/contexts/AuthContext.tsx`
- `supabase/functions/portal-login/index.ts`

## Pruebas

- `npm test`: **18 archivos / 154 tests PASS**.
- Login admin verificado por API: token `200`, perfil `200`.
- Navegación admin verificada: `/rest/v1/productos` y `/rest/v1/usuarios` → `200`.
- Técnico verificado con sus permisos.
- Portal verificado: `portal-login` → `200`, RLS limita al cliente propio.

## Build y despliegue

- `npm run build`: OK.
- Frontend redesplegado con Nginx sin tocar PostgreSQL ni volúmenes.
- `http://192.168.1.43/` responde `HTTP 200`.

## Verificación final

- Login de administrador: OK.
- Perfil y permisos: OK.
- Sesión persistente tras recarga: OK (token válido y `/auth/v1/user` responde `200`).
- Cierre voluntario: implementado en `signOut`.
- Portal de clientes: OK mediante `portal-login`.

## Restricciones respetadas

- Sin borrado de usuarios ni volúmenes.
- RLS no deshabilitado.
- Sin `service_role` en el frontend.
- Contraseñas documentadas en `docs/deployment/LOCAL_CREDENTIALS.md`.
