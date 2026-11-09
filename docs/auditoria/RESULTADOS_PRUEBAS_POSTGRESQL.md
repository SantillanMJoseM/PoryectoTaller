# Resultados de pruebas contra PostgreSQL — Sistema Taller

## Entorno de prueba
- PostgreSQL 17 (contenedor Docker)
- Backend Node.js + Express + Prisma
- Frontend React (Vite build)
- Autenticación: JWT access + refresh

## Pruebas ejecutadas

### Autenticación (14 casos)
1. Login válido (admin@taller.com) → 200 + access_token + refresh_token ✅
2. Login con contraseña incorrecta → 401 ✅
3. Usuario inexistente → 401 ✅
4. Token válido en endpoint protegido → 200 ✅
5. Sin token → 401 ✅
6. Token inválido → 401 ✅
7. Refresh correcto → 200 + nuevo access_token ✅
8. Refresh inválido → 401 ✅
9. Recuperación de sesión tras recarga → OK ✅
10. Cambio obligatorio de contraseña → OK ✅
11. Finalización del cambio → OK ✅
12. Redirección al dashboard → OK ✅
13. Persistencia de sesión post-redirección → OK ✅
14. Logout → OK ✅

### CRUD por módulo (23 módulos)
Todos los endpoints GET/POST/PUT/DELETE probados y retornan códigos HTTP correctos (200/201/204/400/401/404).

### Ordenamiento y paginación
- `columna=nombre_cliente&ascendente=true` → 200 (orden correcto) ✅
- `columna=foo_bar` (inválida) → 400 (sin caída) ✅
- `tamPagina=200`, `pagina=1` → OK ✅
- `estado=true` filtro boolean → OK ✅

### Estabilidad
- Parámetros inválidos en cada familia de endpoints → 400/500 controlado, sin crash ✅
- Backend permanece operativo tras errores → verificado ✅
- Sin errores no controlados en logs → verificado ✅

### Build y calidad
- Frontend `npm run build` → OK ✅
- Frontend `npx tsc --noEmit` → OK ✅
- Backend `npx tsc -p tsconfig.json` → OK ✅
- Bundle sin `localhost:4000` → verificado ✅

### RBAC
- Admin con todos los permisos → acceso a todos los módulos ✅
- Sin token → 401 ✅
- Token inválido → 401 ✅

## Resumen
- Total módulos auditados: 23
- Total endpoints probados: ~80+
- Pruebas pasadas: 100%
- Errores 502: 0
- Crashes: 0
