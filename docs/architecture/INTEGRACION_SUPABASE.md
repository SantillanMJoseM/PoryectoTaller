# Integración Supabase — Auth, Storage y Cola de emails (TASK-0008)

> Autor: AG-011 · Fecha: 05/11/2026 · Fuente de verdad: `docs/requirements/SOURCE_PROMPT.md`

## 1. Alcance

Implementación de la capa de integración con Supabase exigida por el plan:

| Entregable | Ruta | Rol |
|---|---|---|
| Cliente Supabase | `src/lib/supabase.ts` | Instancia única de Supabase (Auth + Postgres + Storage), constantes de buckets y helpers de almacenamiento |
| Contexto de sesión | `src/contexts/AuthContext.tsx` | Sesión administrativa/portal + permisos (códigos de actividad) para la UI |
| Cola de emails | `src/services/emailQueue.ts` | Coordinación CRUD (`emails.ts`) ↔ Edge Function `enviar-email`, reintentos, recuperación y autoproceso |

No se alteró ningún módulo ni tabla del SOURCE_PROMPT: las 17 entidades
(`usuarios`, `permisos`, `sesiones`, `cola_emails`, `empresa`, …) y los
módulos obligatorios siguen definidos en `src/lib/types.ts` y las migraciones
`supabase/migrations` (0001–0005) creadas en TASK-0007.

## 2. Diseño

### 2.1 `src/lib/supabase.ts`

- Credenciales **solo** desde `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
  (nunca `service_role`; regla «no exponer credenciales»).
- `createClient` con `persistSession`, `autoRefreshToken` y
  `detectSessionInUrl` → cumple «sesión persistente con expiración».
- `esSupabaseConfigurado` + `avisoConfiguracion()` para diagnóstico sin
  bloquear el arranque.
- Storage (migración 0005): buckets privados `documentos` y `anexos`,
  helper `rutaSegura()` (UUID + saneamiento), `subirAlBucket`,
  `firmarUrlBucket` (URL firmada 1 h), `descargarDelBucket`,
  `eliminarDelBucket` (idempotente), límite global 20 MB.

### 2.2 `src/contexts/AuthContext.tsx`

- Delega en `autenticacionService` (TASK-0007): login con correo/contraseña,
  validación de usuario activo + grupo de permisos activo, y registro de la
  fila en la tabla `sesiones` (RPC `sesion_registrar`, 12 h admin).
- Al restaurar una sesión persistente, re-registra la fila de `sesiones`
  (si el navegador refrescó y perdió `idSesion`); fallo no bloqueante.
- API compatible con la UI existente (`user`, `loading`, `signIn`,
  `signOut`) y extendida: `sesion`, `permisos`, `puede(codigos)`.
- El rol administrador/cliente queda separado por RLS con el JWT
  (`app_metadata.rol`); el portal del cliente reutiliza el mismo runtime
  de Auth con esa separación.

### 2.3 `src/services/emailQueue.ts`

Integración de la cola (SOURCE_PROMPT §14), sin duplicar el CRUD de `emails.ts`:

```
encolar / encolarOrden ─▶ emailsService.crear        (estado: pendiente)
procesar(limite)        ─▶ emailsService.procesar    (pendiente → enviando →
                                                       enviado | fallido vía
                                                       Edge Function «enviar-email»)
reintentarFallidos      ─▶ lista fallidos → pendiente → procesar
recuperarEstancadas     ─▶ «enviando» con > 10 min → pendiente (crash/pestaña cerrada)
ciclo()                 ─▶ recuperarEstancadas + procesar; nunca lanza
iniciarAutoproceso      ─▶ setInterval 60 s (una pasada inmediata)
detenerAutoproceso      ─▶ limpia el temporizador
```

- La política de reintentos es exponencial (`segundosReintento`: 30·2^i,
  tope 32×) para futuros usos de schedulers externos.
- Autoproceso desactivable con `VITE_EMAILS_AUTO_PROCESAR=false`
  (documentado en `.env.example`).
- Exports añadidos desde `src/services/index.ts`: `emailQueueService`,
  `FN_ENVIAR_EMAIL`, `AUTOPROCESO_ACTIVADO`.

## 3. Pruebas

- `src/test/emailQueue.test.ts`: detección de correos estancados, política
  de reintentos, composición del mensaje de orden, flujo
  reintentar→procesar y ciclo sin excepciones (**mock** de `emailsService`;
  no toca la base de datos real).
- `src/test/supabase.test.ts`: buckets, límite 20 MB, degradado sin `.env`
  y saneamiento de rutas.
- Se conservan los tests previos (smoke, dinero, fechas, permisos,
  financiero-utils, validaciones).

## 4. Problemas conocidos

1. La ejecución de `npm test`/`vitest` falló en este entorno por rechazo de
   permisos del sandbox (no cupo tiempo); las pruebas están listas y se
   deben correr con `npm test` en CI.
2. El envío real requiere la Edge Function `enviar-email` (SMTP); sin ella
   los correos se marcan `fallido` con la causa en `encabezados`, según el
   diseño de `emails.ts` (TASK-0007).
3. La creación de credenciales sigue requiriendo la Edge Function
   `crear-usuario-admin` con clave de servicio (no se puede hacer desde el
   navegador; ver `autenticacionService.crearCredencial`).
4. Si el usuario refresca la página, el `idSesion` de la fila anterior queda
   activo en la tabla `sesiones`; la restauración registra una nueva fila
   y `sesion_cerrar` solo cierra la actual (limpieza pendiente vía Cron de
   Supabase).
