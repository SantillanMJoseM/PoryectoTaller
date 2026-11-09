# Matriz de auditoría funcional — Sistema Taller (PostgreSQL)

| Módulo | Listado | Filtro | Orden | Paginación | Alta | Modif. | Baja | Relaciones | Validación | Auth/RBAC | Errores | Estado |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Empresa | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | APROBADO |
| Permisos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | APROBADO |
| Usuarios | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Permiso | ✅ | ✅ | ✅ | APROBADO |
| Clientes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | APROBADO |
| Marcas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | APROBADO |
| Equipos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Marca/Cliente | ✅ | ✅ | ✅ | APROBADO |
| Productos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | APROBADO |
| Servicios | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | APROBADO |
| Garantías | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Usuario | ✅ | ✅ | ✅ | APROBADO |
| Categorías | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | APROBADO |
| Cuentas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | APROBADO |
| Órdenes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Cliente/Usuario/Garantía | ✅ | ✅ | ✅ | APROBADO |
| Productos de orden | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Orden/Producto | ✅ | ✅ | ✅ | APROBADO |
| Servicios de orden | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Orden/Servicio | ✅ | ✅ | ✅ | APROBADO |
| Equipos de orden | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Orden/Equipo | ✅ | ✅ | ✅ | APROBADO |
| Anexos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Orden | ✅ | ✅ | ✅ | APROBADO |
| Ventas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* | ✅* | Cliente/Usuario | ✅ | ✅ | ✅ | APROBADO |
| Items de venta | ✅ | ✅ | ✅ | ✅ | ✅ | ✅* | ✅* | Venta/Producto | ✅ | ✅ | ✅ | APROBADO |
| Movimientos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Cliente/Categoría/Cuenta | ✅ | ✅ | ✅ | APROBADO |
| Documentos | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | APROBADO |
| Logs auditoría | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | — | ✅ | ✅ | ✅ | APROBADO |
| Cola emails | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | APROBADO |
| Sesiones | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Usuario/Cliente | ✅ | ✅ | ✅ | APROBADO |
| Auth (login/refresh/logout/me) | ✅ | — | — | — | — | — | — | — | ✅ | ✅ | ✅ | APROBADO |
| Storage (upload/download/delete) | ✅ | — | — | — | ✅ | — | ✅ | — | ✅ | ✅ | ✅ | APROBADO |

\* Ventas e items son inmutables cuando `facturado=true` (guardUpdate/guardDelete en backend).

## Verificaciones transversales
- Conversión snake_case→camelCase en middleware: OK.
- Validación de columnas de ordenamiento (sortableFields): OK.
- asyncHandler en todos los handlers: OK.
- Manejo de errores HTTP (400/401/403/404/500): OK.
- Sin crash ante parámetros inválidos: OK.
- Sin localhost en bundle de producción: OK.
- Same-origin /api vía Nginx: OK.
