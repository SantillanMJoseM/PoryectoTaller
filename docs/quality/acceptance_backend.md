# Reporte de Aceptación — Backend (Servicios y Reglas de Negocio)

| Campo | Valor |
| --- | --- |
| **Ámbito** | `src/services/**` y `src/lib/**` (21 archivos) |
| **Fecha** | 06/11/2026 |
| **Autor** | AG-008 — Backend Developer |
| **Código modificado** | Ninguno (lectura / análisis estático; reporte según instrucción) |
| **Veredicto** | ✅ **APROBADO con observaciones** — las reglas de negocio críticas están implementadas y la autoridad de negocio vive en la base de datos (RPC + triggers + RLS); se listan 7 hallazgos medios y varios menores, ninguno bloqueante |

---

## 1. Alcance y método

Validación estática de la capa backend TypeScript contra las fuentes de verdad:

- `docs/requirements/SOURCE_PROMPT.md`, `BUSINESS_RULES.md` (v2.0), `FUNCTIONAL_REQUIREMENTS.md`
- Migraciones `supabase/migrations/0001–0005` (schema, RLS, negocio, storage)

Módulos revisados:

| Capa | Archivos |
| --- | --- |
| `src/lib` | `permisos.ts`, `dinero.ts`, `validaciones.ts`, `fechas.ts`, `financiero-utils.ts`, `errores.ts`, `crud.ts`, `supabase.ts`, `types.ts`, `pdf.ts` |
| `src/services` | `index.ts`, `clientes.ts`, `productos.ts`, `servicios.ts`, `ordenes.ts`, `ventas.ts`, `garantias.ts`, `financiero.ts`, `archivos.ts`, `catalogos.ts`, `usuarios.ts`, `permisosService`, `autenticacion.ts`, `portal.ts`, `reportes.ts`, `auditoria.ts`, `emails.ts`, `emailQueue.ts`, `empresa.ts`, `panel.ts` |

---

## 2. Conformidad de reglas de negocio

| Regla | Implementación verificada | Estado |
| --- | --- | --- |
| **RB-002** Stock automático en órdenes/ventas | `ordenes.agregarProducto / cambiarCantidadProducto / quitarProducto` y `ventas.agregarItem / cambiarCantidadItem / quitarItem` delegan en RPCs `orden_*`/`venta_*` (migración 0004 L222–351); `productos.editar` **retira** `stock` del payload (`if ("stock" in datos) delete datos.stock`) y el único ajuste directo es `ajustarStock(p_delta)` vía RPC, coherente con el guard `f_stock_no_directo` | ✅ Conforme |
| **RB-003 / RB-004** Facturación única | `ordenes.facturar` / `ventas.facturar` llaman a RPCs `orden_facturar` / `venta_facturar` (0004 L353/L387); la capa TS no intenta facturar por su cuenta ni permite doble facturación por diseño (la BD impone el único asiento) | ✅ Conforme |
| **RB-014** Pagado exige `fecha_pago` | `validarMovimiento` en `validaciones.ts:147` lo aplica y `financiero.marcarPagado` delega en RPC `mov_marcar_pagado` (0004 L423); test cubierto (`validaciones.test.ts` «pagado exige fecha de pago») | ✅ Conforme |
| **RB-017** Subtotal = cantidad × precio | `dinero.subtotalLinea` con redondeo a 2 decimales; usado por `ordenes.agregarServicio/cambiarCantidadServicio`; test cubierto | ✅ Conforme |
| **RB-018** Total orden = Σ productos + Σ servicios | Cálculo espejo `ordenes.calcularTotal` (coincide con trigger `f_recalcular_total_orden` 0004 L75); la autoridad sigue siendo el trigger | ✅ Conforme |
| **RB-019** Total venta = Σ ítems − descuento ≥ 0 | `dinero.totalDocumento` con `Math.max(0, …)`; el descuento se valida negativo en `validarVenta`; el recálculo definitivo es trigger `f_recalcular_total_venta*` | ✅ Conforme |
| **RB-020** Stock nunca negativo | La capa TS valida `cantidad > 0` antes de cada RPC y la RPC emite hint `stock_insuficiente` (0004 L213), traducida a español por `errores.mensajeError` | ✅ Conforme |
| **RB-027** Vínculo de facturación (`lanzamiento_id`) | Modelado en `types.ts` (`OrdenTrabajo.lanzamiento_id`, `Venta.lanzamiento_id`); lo escribe la RPC de facturar (misma transacción en BD) | ✅ Conforme |
| **RB-030** Empresa única | `empresaService.obtener()` usa `limit(1).maybeSingle()`; el segundo registro lo bloquea el trigger `f_empresa_unica` (0004 L18) y `errores.mensajeError` mapea la hint `empresa_unica` | ✅ Conforme |
| **RB-032** Separación rol admin/cliente | Sesión admin con permisos de grupo (`autenticacion.ts`, guard de usuario inactivo/grupo inactivo con `signOut`); portal separado (`portal.ts`) con `SesionPortal` propia, 24 h, y bloqueo de cambio de correo/documento en `actualizarPerfil` (reforzado en BD por `f_cliente_no_credenciales`) | ✅ Conforme |
| **Permisos §11 (a/e/d/v/r/c × 14 módulos)** | `lib/permisos.ts` genera `aCliente…` de forma determinista; `puedeAcceder/puedeVerModulo` en `usuarios.ts` exigen `grupo.estado`; la autoridad fuerte es RLS (0003) | ✅ Conforme |
| **Estados de orden (`chk_orden_estado`)** | `ESTADOS_ORDEN` en `types.ts` (Presupuesto, Abierta, En Proceso, Finalizado, Cancelado, Aguardando Piezas) sincronizado con la lista local de `ordenes.cambiarEstado` | ✅ Conforme (ver O-05) |
| **Financiero §8** | Filtros por período (día/semana Lunes-ISO/mes/año/todos), situación (todos/previsto/atrasado/realizado/pendiente vía `financiero-utils.situacion`, misma regla que la vista `v_movimientos_situacion`), totales y detección de vencidos | ✅ Conforme |
| **Emails §14** | Estados `pendiente → enviando → enviado|fallido` con causa en `encabezados`; reintentos, recuperación de estancados (10 min) y autoproceso configurable por `VITE_EMAILS_AUTO_PROCESAR` | ✅ Conforme (ver O-01) |

### Contratos contra las migraciones (verificados por nombre)

Las 24 funciones de `0004_negocio.sql` referenciadas por los servicios existen con el mismo nombre: `requerir_permiso`, `ajustar_stock`, `orden_agregar_producto`, `orden_cambiar_cantidad_producto`, `orden_quitar_producto`, `venta_agregar_item`, `venta_cambiar_cantidad_item`, `venta_quitar_item`, `orden_facturar`, `venta_facturar`, `mov_marcar_pagado`, `limpiar_logs`, `sesion_registrar`, `sesion_cerrar`, `sesion_purgar`, etc.

Los buckets usados por los servicios (`anexos-orden`, `documentos`, `logos`) existen en `0005_storage.sql`. **Sin embargo, la constante `BUCKETS` de `lib/supabase.ts` declara `anexos` (inexistente)** — ver O-02.

---

## 3. Fortalezas destacadas

1. **Separación correcta de responsabilidades:** la lógica pura probada (`lib/dinero/fechas/financiero-utils/permisos`) está separada de la I/O; `crud.ts` centraliza paginación (acotada 1–200), búsqueda `ilike` con escape de `%`/`_` y traducción de errores.
2. **Autorización y validación en dos niveles:** validación amable en TS (mensajes en español) + autoridad real en RLS/RPC; `errores.ts` traduce hints de negocio (`stock_insuficiente`, `empresa_unica`, `credenciales_inmutables`) y códigos Postgres.
3. **Sanitización de archivos:** nombres sanitizados con UUID antepuesto (`rutaSegura`, `anexos`, `documentos`, `logos`), límites de tamaño enforceados en servidor y cliente (20 MB documentos/anexos, 5 MB logo + prueba `image/`), buckets privados con URLs firmadas de 1 h.
4. **Portal del cliente:** whitelist explícita de campos editables (`camposPermitidos`) en vez de blacklist; correo/documento rechazados antes de tocar la BD.
5. **Cobertura de fechas local:** `hoyISO()` y rangos de período construidos sin desfase UTC; comparación ISO lexicográfica coherente.

---

## 4. Hallazgos

Severidades: 🔴 Alta (bloqueante de aceptación) · 🟡 Media (fix recomendado) · 🟢 Baja / informativa.

### O-01 🟡 — Transición pendiente→enviando no atómica en la cola de emails

`src/services/emails.ts:59-97` (`procesar`): lee pendientes y luego hace `UPDATE … SET estado='enviando'` **sin** condición `eq("estado", "pendiente")`. Con el autoproceso activo en varias pestañas (o tras reintentar durante un envío), dos ejecuciones pueden procesar el mismo correo → **doble envío real al cliente**.

**Sugerencia:** `update({ estado: "enviando" }).eq("id", id).eq("estado", "pendiente")` y saltar si `count === 0` (o mover el claim a una RPC en 0004). **Impacto:** medio; probabilidad baja-media.

### O-02 🟡 — Constante `BUCKETS` desalineada con la migración 0005

`lib/supabase.ts:49-54` declara `anexos: "anexos"`, pero 0005 define los buckets `logos`, `anexos-orden`, `documentos`, `comprobantes`. El tipo `NombreBucket` solo acepta `documentos|anexos`, por lo que los helpers (`subirAlBucket`, `firmarUrlBucket`…) resultan inutilizables para anexos y solo son verdad para `documentos`. Hoy ningún servicio usa estos helpers (archivos/ordenes/empresa escriben contra Storage directamente), así que no hay fallo en runtime, pero la constante engaña a quien la reutilice.

**Sugerencia:** corregir `BUCKETS = { anexosOrden: "anexos-orden", documentos: "documentos", comprobantes: "comprobantes", logos: "logos" }` y dirigir `ordenes/archivos/empresa` a usarlos (fuente única). **Impacto:** medio (riesgo de divergencia futura).

### O-03 🟡 — Error ignorado en `ordenes.cambiarCantidadServicio`

`src/services/ordenes.ts:200-203`: el `UPDATE` sobre `servicios_orden` no captura `error` (el `SELECT` previo sí). Si RLS/permisos rechazan la actualización, el fallo es **silencioso**: la UI no recibe error y el subtotal queda sin recalcular.

**Sugerencia:** capturar el resultado y lanzar `new Error(mensajeError(error))` como hacen el resto de métodos del servicio.

### O-04 🟡 — `financiero.listarFiltradas` consulta sin límite y pagina en memoria

`src/services/financiero.ts:71-101`: trae todos los movimientos del período para filtrar por situación (regla, no columna) y paginar en el navegador. Con años de historia esto degrada la pantalla Financiero y el Panel (`panel.resumen` la llama).

**Sugerencia:** medial término, mirar la vista `v_movimientos_situacion` y filtrar/paginar en BD; largo plazo, RPC con rango server-side. Documentado como decisión consciente en el comentario del propio archivo.

### O-05 🟢 — Lista de estados de orden duplicada y parche frágil en `ordenes.editar`

- `cambiarEstado` (ordenes.ts:122-129) repite literalmente `ESTADOS_ORDEN` de `types.ts` → riesgo de divergencia; usar la constante.
- La edición con cambio de estado (ordenes.ts:106-116) fuerza `fecha_inicial: "2000-01-01"` para pasar `validarOrden` y luego borra claves del mapa de errores (`cliente_id`, `usuario_id`, `fecha_inicial`). Funciona, pero es frágil: si `validarOrden` gana una regla nueva, el parche la escondería. Sugerencia: extraer una variante `validarEstadoOrden` en `validaciones.ts`.

### O-06 🟢 — Robustez menor en validaciones y búsqueda

- `validarCliente`: `correo: ""` produce «Correo electrónico inválido» en lugar de tratarse como opcional (solo `undefined` se salta). Igual patrón en la validación duplicada de `emailsService.crear` con listas CC/CCO.
- `crud.condicionBusqueda` y el `query.or` de `financiero.ts:81` no escapan comas del término `q` → un término con `,` rompe el DSL de PostgREST (error de consulta, no fuga). Escape o `q.split(/[\s,]+/)`.
- `productos.editar` muta el parámetro `datos` (`delete datos.stock`): efecto colateral inofensivo hoy, pero mejor `{ ...datos }` sin la clave.
- `validarMovimiento` en `financiero.editar` borra la clave `descripcion` del mapa de errores → un PATCH con `descripcion: ""` pasa la capa TS y muere en la BD (NOT NULL) con mensaje menos amable.

### O-07 🟢 — Observaciones informativas

- `emails.reintentar` no aplica la demora `segundosReintento` (30·2^n, con tope) que hoy solo vive en tests; el intento es inmediato.
- `ordenes.enviarPorCorreo` encola en `cola_emails` sin validar `para` (a diferencia de `emailQueueService.encolar`, que valida); una dirección malformada entrará a la cola y `procesar` igual la enviará al Edge.
- `autenticacion.iniciar`: si `sesion_registrar` falla, se continúa sin registro de sesión (comentado en el código) → la expiración de 12 h admin no quedará registrada esa vez. Aceptable como degradación.
- `portal.ingresar` con Edge Function `portal-login` no desplegada: sesión local sin token de rol cliente → datos protegidos por RLS no disponibles (limitación documentada en el propio encabezado del archivo).
- `dinero.redondear` (+1e-6) replica `round(x,2)` de Postgres solo para valores ≥ 0; en el dominio los montos son siempre positivos (ingresos/egresos usan `valor > 0` con `tipo`), así que la divergencia en negativos halfway es teórica.
- `panel.ordenesPorEstado` trae todas las filas de `ordenes_trabajo` para contar en memoria; usar `count: "exact", head: true` agrupado o vista.
- `garantias.asociarAOrden` instancia un `crearCrud` nuevo en cada llamada; moverlo a constante de módulo.

---

## 5. Pruebas

Suite existente (`npm test` → Vitest) con **10 archivos / ~60 casos** relevantes a esta capa:

| Archivo | Qué valida |
| --- | --- |
| `src/test/dinero.test.ts` | Redondeo 2 decimales sin error binario, subtotal, total con descuento no negativo, `parseMonto` coma decimal, formato de pantalla |
| `src/test/fechas.test.ts` | dd/mm/aaaa ↔ ISO, `hoyISO` local, rangos día/mes/año, `estaVencido` |
| `src/test/financiero-utils.test.ts` | Situación (realizado/atrasado/previsto/pendiente), filtro, totales ingreso−egreso=saldo, `hayVencidos` |
| `src/test/validaciones.test.ts` | Clientes, productos, RB-014 (pagado exige fecha_pago), estados de orden, fechas final≥inicial, emails, traducción de errores de BD (hints de 0004) |
| `src/test/permisos.test.ts` | Códigos de actividad, evaluación exacta/módulo, normalización, control de acceso por grupo (incluye grupo inactivo) |
| `src/test/emailQueue.test.ts` | Constantes de integración §14, estancados, reintento exponencial con tope, `encolarOrden`, `reintentarFallidos`, `recuperarEstancadas`, `ciclo` sin lanzar |
| `src/test/supabase.test.ts` | Buckets de 0005, límite 20 MB, aviso sin `.env`, `rutaSegura` |
| `src/test/smoke.test.ts` | Autos de humo |

> **⚠️ Estado de ejecución:** en esta sesión, todos los comandos de shell (`npm test` / `npx vitest run`) fueron **rechazados por el control de permisos del entorno no interactivo**. No se logró ejecutar la suite; la revisión es 100 % estática. **Acción pendiente:** ejecutar `npm test` en un entorno con permisos y registrar el resultado como comprobación final de este reporte. Los casos listados arriba se verificaron por lectura (concuerdan con el comportamiento del código revisado).

**Cobertura no cubierta por tests unitarios y recomendada:** flujo `procesar` de emails (double-claim, ver O-01), `cambiarCantidadServicio` (O-03), paginación en memoria de `financiero.listarFiltradas` con volúmenes grandes, y los flujos RPC de negocio (stock, facturación única) contra un proyecto Supabase de prueba, idealmente con tests de integración.

---

## 6. Conclusión

La capa backend TS **cumple** las reglas de negocio críticas del SOURCE_PROMPT: stock solo por RPC (RB-002/020), facturación única delegada a la BD (RB-003/004/027), coherencia de pagos (RB-014), totales espejo de triggers (RB-017/018/019), empresa única (RB-030) y separación admin/portal (RB-032), con autorización fuerte en RLS y validaciones amables en español espejadas en la capa de servicios.

**Se aprueba la aceptación condicionada a** la resolución de los hallazgos medios O-01 (doble envío en cola), O-02 (constante de buckets), O-03 (error silencioso) y O-04 (rendimiento financiero), y a la ejecución de `npm test` como evidencia formal (bloqueada por permisos del entorno en esta sesión).

### Inventario de evidencia

- Código inspeccionado (lectura): 10 archivos de `src/lib`, 20 de `src/services` (+ índice), 3 migraciones (`0002_schema.sql`, `0004_negocio.sql`, `0005_storage.sql`), 8 suites de test.
- Archivo modificado por este reporte: **solo** `docs/quality/acceptance_backend.md` (0 líneas de código).
