# Integration Tests — PostgreSQL Puro

Pruebas manuales ejecutadas contra PostgreSQL 17 real (contenedor taller-postgres-postgres-1):

- Login admin + cambio obligatorio de contraseña: OK
- Refresh token: OK
- CRUD clientes: OK (creación verificada)
- Productos y stock: endpoints disponibles, validación de stock en backend
- Órdenes: creación, líneas, totales
- Ventas y facturación: transacción atómica, bloqueo de edición post-facturación
- Inmutabilidad de facturas: guardUpdate/guardDelete rechazan cambios
- Movimientos financieros: creación al facturar
- Archivos/Storage: upload/download con auth
- Reportes PDF: frontend genera
- RBAC: middleware requirePermission por código
- Auditoría: logs registrados
- Portal de clientes: endpoint portal-login emite JWT cliente
- Persistencia: volúmenes pgdata + storage

Nota: suite legacy basada en supabaseFalso no aplica; se requiere reescribir suite automatizada (pendiente).
