# Security Test Results — Sistema Taller

Pruebas:
- Aislamiento entre clientes: portalService.detalleOrden(c-1, o-2) → null.
- Acceso propio: portalService.detalleOrden(c-2, o-2) → OK.
- Suite completa: 153/153 passed (incluye permisos y alineación con prompt).

Limitaciones:
- Sin instancia Supabase real; RLS no validado en vivo.
- Portal usa anon; aislamiento validado a nivel de servicio.
