# Implementación de Base de Datos — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0006 — Database Implementation |
| Autor | AG-010 Database Developer |
| Fecha | 2026-11-05 |
| Fuente de verdad | `docs/requirements/SOURCE_PROMPT.md` |
| Diseño aplicado | `docs/database/DATA_MODEL.md`, `schema.sql`, `RLS_POLICIES.md` (TASK-0005) |
| Entregables | `supabase/migrations/` · `supabase/seed.sql` |

---

## 1. Cadena de migraciones

| Archivo | Alcance | Origen del diseño |
|---|---|---|
| `0001_init.sql` | (preexistente, prototipo — se corrige por delta, no se reescribe) | — |
| `0002_schema.sql` | Correcciones de 0001: `usuarios` (doble `estado` → `estado` región + `estado_usuario` bool, retiro de `contrasena`), `permisos.permisos` text→jsonb con conversión CSV, NOT NULLs, tabla `sesiones`, 17 CHECKs, FK `ON DELETE SET NULL` para productos/servicios históricos, índices únicos parciales (RB-003/004/027, dedup RF-054, portal RB-012), índices de búsqueda/paginación y vistas `v_stock_alerta`, `v_movimientos_situacion`, `v_cliente_vinculos` | `schema.sql` §2–§5, DATA_MODEL §2/§4/§5/§6 |
| `0003_rls.sql` | RLS en 23/23 tablas; drop defensivo de TODAS las políticas previas (corrige D-03 «anon read clientes»); helpers `rol_sesion`, `usuario_actual`, `cliente_actual`, `es_administrador`, `es_cliente`, `tiene_permiso`, `es_cliente_duenio_orden/venta`; políticas completas por código de permiso (a/e/d/v/r/c + módulo) con rama de portal | `schema.sql` §6/§8, RLS_POLICIES |
| `0004_negocio.sql` | Triggers de modelo: empresa única (RB-030), credenciales del portal inmutables (RF-079), guard de stock (RB-002/017/020), recálculo de `valor_total` (RB-018/019), `fecha_final` al Finalizar (RF-021), auditoría genérica (RB-009/028). RPC: `requerir_permiso`, `ajustar_stock`, `orden_agregar/quitar_producto`, `orden_cambiar_cantidad_producto`, `venta_agregar/quitar_item`, `venta_cambiar_cantidad_item`, `orden_facturar`, `venta_facturar` (facturación única RB-003/004), `mov_marcar_pagado` (RB-014), `limpiar_logs` (RF-069), `sesion_registrar/cerrar/purgar` (RNF-S-08) | `schema.sql` §7, ARCHITECTURE §11 |
| `0005_storage.sql` | Buckets `anexos-orden`, `documentos`, `comprobantes`, `logos` + políticas por códigos de permiso | `schema.sql` §9, ADR-013 |

## 2. Datos de ejemplo (`seed.sql`)

Idempotente (RB-001): guard único — si existe la fila de `empresa` no resiembra nada; nunca
actualiza ni elimina datos previos. Contenido:

- `empresa` de demostración (registro único).
- Grupos de permisos **Administrador** (todos los códigos a/e/d/v/r × 10 módulos + `cRespaldo`, `vAuditoria`, `dAuditoria`, `aEmail`, `vEmail`, `dEmail`, `cEmpresa`, `eEmpresa`) y **Técnico** (solo `v*`/`r*` + `aOrden`, `eOrden`).
- 2 usuarios (identidad + contraseña bcrypt vía Supabase `auth.users`, DATA_MODEL §2.6).
- 3 clientes (2 con par correo+documento para el portal), 1 marca, 2 equipos.
- 6 productos (2 con stock bajo → `v_stock_alerta`), 3 servicios, 1 garantía.
- 4 categorías + 2 cuentas financieras.
- 2 órdenes (`En Proceso`, `Presupuesto`) con líneas de productos/servicios, equipo intervenido y anexo.
- 1 venta **facturada** (RB-004) con su movimiento financiero vinculado (`lanzamiento_id`).
- 3 movimientos con las situaciones atrasado/previsto/pendiente (RB-026) + 1 realizado.
- 1 documento, logs (incl. los generados por `tg_auditar` durante el seed) y 4 emails en cola, uno por cada estado (RB-015).

## 3. Supuestos y notas para la integración (frontend / Edge Functions)

1. **Sesión (JWT)**: las políticas leen `app_metadata` del JWT con
   `{ rol: 'administrador'|'cliente', usuario_id | cliente_id, permisos?: string[] }`.
   Tras el login (admin) y el ingreso al portal (correo + documento), el backend debe firmar
   esas claims y registrar la fila en `sesiones` vía `sesion_registrar` (12 h admin / 24 h cliente).
2. **Stock**: nunca actualizar `productos.stock` directamente — solo con las RPC de líneas
   (`orden_agregar_producto`, `venta_agregar_item`, …). El guard rechaza updates directos.
3. **Facturación**: usar `orden_facturar` / `venta_facturar`; la UI debe deshabilitar el botón
   cuando `facturado = true` (la base también lo impone con CHECK + índice único parcial).
4. **Primer usuario administrador**: crearlo en Supabase Auth (dashboard) y dar de alta su
   ficha en `public.usuarios` con el mismo `id` (o correo coincidente) + grupo «Administrador».
5. La zona horaria recomendada de la base es `America/Sao_Paulo` (E-06); los formatos
   `dd/mm/aaaa` y 2 decimales son responsabilidad de la UI (RB-005/RB-008).

## 4. Validación ejecutada

- Revisión cruzada línea a línea contra `docs/database/schema.sql` (D-01, D-03, D-04 cerrados).
- `npm test` (vitest) **no pudo ejecutarse** en este entorno: la ejecución de comandos
  (shell) no está disponible en la sesión de la tarea; no hay pruebas pgTAP locales.
- No se conectó a ninguna base real: no se ejecutaron migraciones contra producción (RB-001).

## 5. Problemas conocidos / pendientes

- **TABLA 23.1**: `sesiones` se materializa pero la escritura depende de la Edge Function de
  login de TASK-0004 ("auth/sesiones"); sin ella, la tabla queda vacía (la política de lectura ya está lista).
- La conversión text→jsonb de `permisos` convierte CSV legacy si hubiera filas previas al despliegue;
  en un despliegue nuevo la tabla está vacía.
- `movimientos_financieros.venta_id` conserva la FK canónica `fk_mov_venta`; si un entorno ya
  aplicó 0001 con datos, el nombre del constraint anterior se reemplaza sin pérdida de datos.
- Verificación automática pgTAP de stock/facturación (RNF-S-02) queda como trabajo posterior
  recomendable para TASK-0004/0007.
