# Informe final de auditoría — Sistema Taller (PostgreSQL)

## Fecha: 2026-11-09

## Resumen ejecutivo
Se realizó una auditoría integral de todos los módulos y endpoints del Sistema Taller tras la migración de Supabase a PostgreSQL puro. Se identificaron y corrigieron defectos en autenticación (nombres de campos), ordenamiento (snake_case→camelCase), estabilidad (asyncHandler) y configuración de producción (localhost). Todos los módulos fueron probados contra PostgreSQL real.

## Hallazgos y correcciones

### 1. Autenticación JWT
- **Problema**: frontend leía `data.accessToken` pero backend devolvía `access_token` → tokens no se guardaban → 401 en todos los módulos.
- **Corrección**: `setTokens(data.access_token, data.refresh_token)` en autenticacionService y portalService.
- **Adicional**: `permiso_id`, `estado_usuario`, `id_usuario` corregidos en frontend.

### 2. Ordenamiento Prisma (502)
- **Problema**: `crudFactory` usaba nombres snake_case directamente en `orderBy` de Prisma → crash del proceso.
- **Corrección**: conversión snake→camel + validación contra `sortableFields` → HTTP 400 para columnas inválidas, sin crash.

### 3. Estabilidad del backend
- **Problema**: handlers async sin `asyncHandler` → unhandled rejections → crash.
- **Corrección**: todos los handlers envueltos en `asyncHandler`; handlers globales de error.

### 4. Configuración de producción
- **Problema**: `localhost:4000` en bundle de producción.
- **Corrección**: same-origin `/api` + proxy Nginx; `VITE_API_URL=""` en producción; instalador con `--no-cache`.

## Módulos auditados: 23
Todos con estado **APROBADO**.

## Pruebas ejecutadas
- Login, refresh, logout, cambio de contraseña: OK.
- CRUD de 23 módulos: OK.
- Ordenamiento, filtros, paginación: OK.
- Parámetros inválidos → 400 sin crash: OK.
- RBAC (401/403): OK.
- Build frontend/backend: OK.
- Bundle sin localhost: OK.

## Limitaciones pendientes
- Suite de tests automatizados (unitarios/integración) requiere reescritura para la nueva arquitectura.
- Worker de envío de emails no implementado (cola_emails existe).
- Validación MIME/extensiones en storage (límite de tamaño implementado).

## Publicación
- Rama: `migration/postgres-puro`
- Último commit: `bbc8e00` (corrección 502) + commits posteriores de auditoría
- `main` intacta.

## Conclusión
El sistema funciona de extremo a extremo: login, JWT, refresh, RBAC, CRUD de todos los módulos, ordenamiento, paginación, inmutabilidad de facturas, storage, auditoría. Sin errores 502 ni crashes. Listo para despliegue en producción.
