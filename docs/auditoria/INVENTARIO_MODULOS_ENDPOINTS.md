# Inventario de módulos y endpoints — Sistema Taller (PostgreSQL)

## Módulos backend (crudFactory + rutas específicas)

| Módulo | Base path | Operaciones |
|---|---|---|
| Empresa | /api/empresa | GET list, GET :id, POST, PUT :id, DELETE :id |
| Permisos | /api/permisos | CRUD completo |
| Usuarios | /api/usuarios | CRUD completo |
| Clientes | /api/clientes | CRUD completo |
| Marcas | /api/marcas | CRUD completo |
| Equipos | /api/equipos | CRUD completo |
| Productos | /api/productos | CRUD completo |
| Servicios | /api/servicios | CRUD completo |
| Garantías | /api/garantias | CRUD completo |
| Categorías | /api/categorias | CRUD completo |
| Cuentas | /api/cuentas | CRUD completo |
| Órdenes de trabajo | /api/ordenes | CRUD completo |
| Productos de orden | /api/productos-orden | CRUD completo |
| Servicios de orden | /api/servicios-orden | CRUD completo |
| Equipos de orden | /api/equipos-orden | CRUD completo |
| Anexos | /api/anexos | CRUD completo |
| Ventas | /api/ventas | CRUD completo (inmutable si facturada) |
| Items de venta | /api/items-venta | CRUD completo (inmutable si facturada) |
| Movimientos financieros | /api/movimientos | CRUD completo |
| Documentos | /api/documentos | CRUD completo |
| Logs de auditoría | /api/logs | CRUD (delete con permiso dAuditoria) |
| Cola de emails | /api/emails | CRUD |
| Sesiones | /api/sesiones | CRUD |

## Rutas de negocio (/api)
- POST /api/auth/login, /portal-login, /refresh, /logout, /me, /change-password, /force-change-password, /finalizar-cambio-contrasena, /crear-credencial, /forgot-password, /reset-password
- POST /api/orden/agregar-producto, cambiar-cantidad-producto, quitar-producto, agregar-servicio, cambiar-cantidad-servicio, quitar-servicio, agregar-equipo, facturar
- POST /api/venta/agregar-item, cambiar-cantidad-item, quitar-item, facturar
- POST /api/mov/marcar-pagado, ajustar-stock
- POST /api/sesion/registrar, cerrar, purgar
- POST /api/auditoria/log
- POST /api/logs/limpiar
- POST /api/storage/upload, GET /api/storage/download, DELETE /api/storage/file
- GET /api/docs (Swagger)

## Frontend pages
Dashboard, Login, CambiarPassword, Clientes, Productos, Servicios, Ordenes, Ventas, Garantias, Financiero, Equipos, Empresa, Documentos, Auditoria, Permisos, Usuarios, Emails, Reportes, Portal.

## Total endpoints: ~30 recursos CRUD + 30 rutas de negocio + auth.
