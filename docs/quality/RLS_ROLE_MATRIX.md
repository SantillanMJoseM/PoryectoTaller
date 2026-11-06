# RLS Role Matrix — Sistema Taller

Roles:
- Admin: acceso completo a todas las tablas.
- Staff (authenticated): acceso completo operativo.
- Cliente portal (anon): solo lectura de su propio registro en clientes; aislamiento por servicio.

Tablas con RLS:
- clientes, productos, servicios, ordenes_trabajo, ventas, movimientos_financieros, documentos, usuarios, permisos, empresa, marcas, equipos, productos_orden, servicios_orden, equipos_orden, anexos, items_venta, logs_auditoria, cola_emails.

Políticas:
- authenticated: ALL (operativo).
- anon: SELECT clientes (filtrado por servicio en app).

Limitación: sin JWT de cliente, el aislamiento entre clientes se valida en la capa de servicio (portalService) y no en RLS. Migrar portal a Supabase Auth con rol cliente para RLS completo.
