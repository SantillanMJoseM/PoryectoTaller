# Reporte de Aceptación — Base de Datos (Migraciones, Integridad y Consultas)

| Campo | Valor |
| --- | --- |
| **Ámbito** | `supabase/migrations/0001–0005` + `supabase/seed.sql` (6 archivos SQL) |
| **Fecha** | 06/11/2026 |
| **Autor** | AG-010 — Database Developer |
| **Código modificado** | Ninguno (lectura / análisis estático; reporte según instrucción) |
| **Validación ejecutable** | No disponible: `psql`/`postgres` no accesibles y la ejecución de comandos (shell) fue denegada en esta sesión (no interactivo). La validación es estática, línea a línea, contra las fuentes de verdad |
| **Veredicto** | ❌ **RECHAZADO** — 1 hallazgo **bloqueante** (syntax error en `0002_schema.sql` que aborta toda la cadena de migraciones) y 1 hallazgo **medio** (FKs legacy no eliminadas: la política de borrado SET NULL queda opacada por la FK original NO ACTION). El resto del diseño aplicado es conforme |

---

## 1. Alcance y método

- **Fuentes de verdad**: `docs/database/schema.sql`, `DATA_MODEL.md`, `RLS_POLICIES.md` (TASK-0005), `docs/requirements/SOURCE_PROMPT.md`, `docs/security/PERMISSION_MATRIX.md`.
- **Método**: revisión estática línea por línea de cada migración contra el diseño canónico; verificación cruzada de códigos de permiso (politicas ↔ seed ↔ matriz), CHECKs ↔ reglas de negocio (RB), triggers ↔ DATA_MODEL §7, y cobertura de integridad referencial. Sin ninguna base de datos real activa ni datos de producción tocados (RB-001).

---

## 2. Cadena de migraciones — conformidad con el diseño

| Migración | Alcance verificado | Estado |
| --- | --- | --- |
| `0001_init.sql` | 22 tablas base, FKs de cabecera/línea, RLS y políticas prototipo (luego reemplazadas) | ⚠️ Con observación (ver H-05) |
| `0002_schema.sql` | Renombrado `estado`→`estado_usuario`, retiro `contrasena` (D-01), `permisos` text→jsonb (D-04), NOT NULLs, tabla `sesiones`, 17 CHECKs, FK SET NULL, índices únicos parciales e índices de búsqueda, 3 vistas `security_invoker` | ❌ **Falla al aplicar** (H-01 bloqueante) + ⚠️ (H-02 medio) |
| `0003_rls.sql` | RLS en 23/23 tablas; drop defensivo de TODAS las políticas de 0001 (corrige D-03 «anon read clientes»); 6 helpers de sesión + 2 de propiedad; ~60 políticas solo para `authenticated`, ninguna para `anon`; códigos a/e/d/v/r/c alineados con PERMISSION_MATRIX | ✅ Conforme |
| `0004_negocio.sql` | Triggers 7.1–7.6 (empresa única RB-030; credenciales portal inmutables RF-079; guard de stock RB-002/017/020; recálculo de totales RB-018/019; `fecha_final` al Finalizar RF-021; auditoría genérica RB-009/028) + 14 RPC de negocio e idempotentes `grant execute` | ✅ Conforme con observaciones (H-06, H-07) |
| `0005_storage.sql` | Buckets `anexos-orden`, `documentos`, `comprobantes` (privados) y `logos` (público); 8 políticas de Storage por códigos de permiso, defensivas por nombre | ✅ Conforme |
| `seed.sql` | Idempotente (guard: aborta si existe `empresa`); grupo Administrador = a/e/d/v/r × 10 módulos + cRespaldo/vAuditoria/dAuditoria/aEmail/vEmail/dEmail/cEmpresa/eEmpresa; venta facturada coherente (205 = 180+45−20) con movimiento vinculado; 4 situaciones de movimiento (RB-026); 4 estados de cola_emails (RB-015) | ✅ Conforme |

---

## 3. Integridad referencial

| Aspecto | Verificación | Estado |
| --- | --- | --- |
| Tablas línea (`productos_orden`, `servicios_orden`, `equipos_orden`, `items_venta`, `anexos`) | `ON DELETE CASCADE` → `ordenes_trabajo`/`ventas` (0001 L142/152/163/172/191) | ✅ Conforme |
| Snapshots históricos (producto/servicio) | Diseño: `ON DELETE SET NULL` conserva descripción/precio en la línea (DATA_MODEL §5). **Implementación defectuosa** → H-02 | ❌ Parcial |
| Atajo facturación | `ordenes_trabajo.lanzamiento_id` → `movimientos_financieros`, `ventas.lanzamiento_id` → `movimientos_financieros` (0001 L213–214) + CHECK `chk_orden/venta_facturada` + índices únicos parciales `uq_orden_lanzamiento`, `uq_venta_lanzamiento`, `uq_mov_venta` (RB-003/004/027) | ✅ Conforme |
| Ciclo `ventas` ↔ `movimientos_financieros` (venta_id ↔ lanzamiento_id) | FKs RESTRICT implícitas: insertable (seed lo demuestra coherente, incl. `uq_mov_venta` único); borrado requiere desvincular primero — comportamiento documentado | ✅ Aceptable |
| Deduplicación (RF-054 / RB-012) | `uq_clientes_documento`, `uq_clientes_portal_par` (par `lower(correo)`,`documento`), `uq_usuarios_cpf` — índices únicos parciales con `is not null` (0002 L264–270) | ✅ Conforme |
| Sesiones `chk_sesion_sujeto` | `num_nonnulls(usuario_id, cliente_id) = 1` — sujeto único y obligatorio | ✅ Conforme |

---

## 4. Consultas de sistema (vistas / RPC) — conformidad

| Objeto | Verificación | Estado |
| --- | --- | --- |
| `v_stock_alerta` (RF-016/RF-007) | `where stock < stock_minimo`, `security_invoker` (hereda RLS) | ✅ Conforme |
| `v_movimientos_situacion` (RB-025/026) | Lógica correcta en `schema.sql` §5 (L420–429); **la trascripción en 0002 tiene syntax error** → H-01 | ❌ Bloqueante |
| `v_cliente_vinculos` (RF-013/RB-022) | 4 conteos correlacionados; con `security_invoker = true` los subqueries heredan RLS — el portal solo cuenta lo propio | ✅ Conforme |
| RPC stock (`ajustar_stock`, `orden_*`, `venta_*`) | Lock `for update`, bloqueo de stock negativo (RB-020), validación `salida` (RB-002), guard GUC `app_permite_stock_write` (set_config `is_local` → alcance transaccional correcto), deltas coherentes en cambiar cantidad y quitar | ✅ Conforme |
| RPC facturación (`orden_facturar`, `venta_facturar`) | Insertan movimiento `ingreso`, marcan `facturado + lanzamiento_id` en la misma transacción; la única-facturación la impone CHECK + índice único parcial | ✅ Conforme (nota H-06) |
| `mov_marcar_pagado` (RB-014) | `pagado=true ⇒ fecha_pago not null` (CHECK `chk_mov_pago` + RPC) | ✅ Conforme |
| `limpiar_logs` (RF-069) | Auto-log previo y borrado del resto; el log de la limpieza sobrevive | ✅ Conforme (nota H-07) |
| `sesion_registrar/purgar` (RNF-S-08) | 12 h admin / 24 h cliente vía CHECK de tipo + make_interval | ✅ Conforme |

---

## 5. Seguridad (resumen — detalle en SECURITY_AUDIT_REPORT.md)

- 23/23 tablas con RLS; **cero políticas para `anon`** (0003 corrige D-03 de 0001); solo `authenticated`.
- Helpers `security definer` con `set search_path = public, pg_temp` fijo (sin riesgo de hijacking de search_path); `jwt_app_metadata` revocada a `public, anon`.
- `tiene_permiso`: claim del JWT primero (O(1)), fallback a tablas con estados `estado_usuario`/`estado` activos (RB-023) y vigencia `fecha_expiracion` (RB-024) — sin recursión de RLS.
- Portal: política de propiedad por `cliente_id` del claim en clientes/equipos/órdenes/líneas/anexos/garantías/ventas/ítems; escrituras (`a*`/`e*`) siempre admin; `logs_auditoria`, `cola_emails` y `sesiones` sin INSERT para `authenticated` (solo vía definer / Edge Function) — coincide con RLS_POLICIES §L130–133 y §L178.
- Códigos usados por las políticas (`vGarantia`, `vAuditoria`, `dAuditoria`, `vEmail`, `dEmail`, `cEmpresa`, `eEmpresa`, …) existen en el grupo Administrador del `seed.sql`; también figuran en PERMISSION_MATRIX.

---

## 6. Hallazgos (orden de severidad)

| ID | Severidad | Ubicación | Descripción y corrección sugerida |
| --- | --- | --- | --- |
| **H-01** | 🔴 **Bloqueante** | `0002_schema.sql` L340–349 | **Syntax error en la vista `v_movimientos_situacion`**: el `FROM movimientos_financieros m;` quedó transpuesto **después** de cerrar la expresión del SELECT (`end as situacion;` en L348 cierra la sentencia y L349 es un `FROM` huérfano). La migración 0002 falla y, por transacción única de `migrations`, se aborta la cadena completa (0003–0005 + `seed.sql` nunca se aplican). Corrección: eliminar el `;` de L348 y dejar `from movimientos_financieros m;` como en `schema.sql` L420–429 |
| **H-02** | 🟠 Medio | `0002_schema.sql` L216–220, L230–234, L243–244 | El detector de FK previa compara `(select count(*) from unnest(conkey) c where c::text = 'producto_id')` — pero `conkey` son **attnums** (smallint), no nombres de columna; la comparación es siempre falsa ⇒ `found = false` y las FKs legacy de 0001 **nunca se eliminan**. Consecuencia: en `items_venta` y `servicios_orden` quedan dos FKs sobre la misma columna; la original (NO ACTION) **bloquea el borrado** de productos/servicios con líneas históricas, opacando el `ON DELETE SET NULL` diseñado. Corrección: resolver el attnum vía `pg_attribute` (`join pg_attribute a on a.attrelid = conrelid and a.attnum = c and a.attname = 'producto_id'`) o borrar por nombre convencional (`items_venta_producto_id_fkey`) |
| H-03 | 🟡 Menor | `0002_schema.sql` L15 | `pgcrypto` se crea en 0002, pero 0001 ya usa `gen_random_uuid()` (L5+). En Supabase es inofensivo (pgcrypto preinstalado); para portabilidad fuera de Supabase/PG≥13 conviene crearlo en 0001 |
| H-04 | 🟡 Menor | `0004_negocio.sql` L449–450 | `limpiar_logs` excluir por litera `tarea <> 'limpiar logs_auditoria'` borraría también filas legítimas cuyo texto coincida. Sugerencia: excluir por `id_log` del auto-log recién insertado (`returning id_log`) |
| H-05 | 🟡 Menor | `0001_init.sql` L250–274 | Políticas permisivas del prototipo (`auth all *`, `anon read clientes`): mitigado — 0003 aplica `drop policy` de TODAS las políticas de `public` antes de crear el diseño definitivo (L40–50). No requiere acción |
| H-06 | 🟡 Menor | `0004_negocio.sql` L353–385 | `orden_facturar` no valida `facturado` previo ni identidad de usuario de la orden; el "no re-facturar" lo impone el índice único parcial `uq_orden_lanzamiento`, cuyo mensaje de error no es semántico (`duplicate key ... uq_orden_lanzamiento`). Sugerencia: fail-fast con `raise ... using hint='ya_facturada'` |
| H-07 | 🟡 Menor | `0003_rls.sql` L256–262 | La rama portal de `garantias_sel` usa un `EXISTS` inline contra `ordenes_trabajo` en lugar de una función definer (como `es_cliente_duenio_orden`); no hay recursión, pero rompe la consistencia del patrón y añade evaluación de RLS por fila. Sugerencia: `es_cliente_duenio_garantia(uuid)` definer |

---

## 7. Cobertura de reglas de negocio en la base (resumen)

| Regla | Instrumento en BD | Estado |
| --- | --- | --- |
| RB-002/017/020 Stock | RPC de líneas + guard `tg_stock_no_directo` + CHECK `stock >= 0` | ✅ |
| RB-003/004/027 Facturación única | CHECKs `chk_*_facturada` + índices únicos parciales | ✅ |
| RB-014 Pagado ⇒ fecha_pago | CHECK `chk_mov_pago` + `mov_marcar_pagado` | ✅ |
| RB-018/019 Totales | Triggers `f_recalcular_total_orden/venta` + `before update of descuento` | ✅ |
| RB-023/024 Estados/vigencia | En `tiene_permiso` (definer) | ✅ |
| RB-025/026 Situación financiera | Vista `v_movimientos_situacion` (⚠️ H-01) | ⚠️ |
| RB-030 Empresa única | Trigger `tg_empresa_unica` | ✅ |
| RB-031/032 RLS/portal | 23/23 tablas, portal por propiedad | ✅ |
| RF-021 fecha_final | Trigger `tg_orden_fecha_final` | ✅ |
| RF-069 limpiar logs | RPC `limpiar_logs` con auto-log | ✅ |
| RNF-S-08 Sesiones | `sesiones` + `sesion_registrar/purgar` | ✅ |
| RF-054/RB-012 Dedup | Índices únicos parciales (documento, par portal, CPF) | ✅ |

---

## 8. Consultas de verificación para cuando haya entorno de BD disponibles

Ejecutar tras `supabase db push` (o `supabase db reset`) y `supabase db seed`:

```sql
-- V1. RLS completo (debe devolver 23 filas, ninguna con policies = 0 excepto las de solo-definer)
select c.relname, c.relrowsecurity as rls, count(p.policyname) as policies
  from pg_class c
  left join pg_policies p on p.tablename = c.relname and p.schemaname = 'public'
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
 group by 1, 2 order by 1;

-- V2. Cero políticas para anon
select * from pg_policies where schemaname = 'public' and roles::text like '%anon%';  -- 0 filas

-- V3. FKs duplicadas (H-02): no debe haber 2 FKs sobre items_venta.producto_id ni
--     servicios_orden.servicio_id
select conrelid::regclass, conname, confdeltype from pg_constraint
 where contype = 'f' and conrelid in ('items_venta'::regclass, 'servicios_orden'::regclass)
   and conkey = array[ (select attnum from pg_attribute
                          where attrelid = conrelid and attname = 'producto_id') ];
-- (asimismo verificar que al borrar un producto con líneas históricas el valor pase a NULL)

-- V4. Integridad del seed (venta facturada)
select v.valor_total, sum(i.subtotal) as items, v.descuento
  from ventas v join items_venta i on i.venta_id = v.id_venta
 where v.id_venta = '00000000-0000-4000-8000-0000000000e5'
 group by v.valor_total, v.descuento;   -- items=225, total=225-20=205

-- V5. Situaciones (RB-026) sobre la vista corregida
select situacion, count(*) from v_movimientos_situacion group by situacion;
-- esperado: realizado=2, atrasado=1, previsto=1, pendiente=1

-- V6. Guard de stock (debe fallar con hint stock_guard)
update productos set stock = stock - 1 where id_producto = '00000000-0000-4000-8000-000000000051';
```

---

## 9. Conclusión

El diseño de TASK-0005 está bien materializado en 0003/0004/0005 y en `seed.sql`: RLS completo, RPC y triggers cubren las reglas críticas y el seed es idempotente y coherente. Sin embargo, la cadena **no puede aplicarse** por el syntax error de `0002_schema.sql` (H-01) y la política de borrado de snapshots históricos queda parcialmente inoperante por H-02. Se recomienda corregir H-01 y H-02 (una migración de corrección `0006_hotfix_vistas_fk.sql`, o enmienda directa de 0002 si aún ningún entorno la aplicó) antes de aceptar el entregable de base de datos.

---

*Fin del reporte — AG-010 (Database Developer) · 06/11/2026*
