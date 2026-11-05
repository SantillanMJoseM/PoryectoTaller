# Reglas de Negocio — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0001 — Requirements Analysis |
| Autor | AG-004 Business Analyst |
| Fecha | 2026-11-05 |
| Versión | **2.0** — Rebasing contra la fuente de verdad (sustituye RB-001…RB-020 + RB-PARAM de v1.x, que pertenecían a un dominio automotriz no presente en SP; ver `FUNCTIONAL_REQUIREMENTS.md` §9) |
| Fuente de verdad | `docs/requirements/SOURCE_PROMPT.md` (SP) |
| Trazabilidad | RF-xxx en `FUNCTIONAL_REQUIREMENTS.md`; RNF-xxx en `NON_FUNCTIONAL_REQUIREMENTS.md`; HU-xxx en `USER_STORIES.md` |

---

## 1. Notación y clasificación

- `[CONFIRMADA]` — texto o regla explícita de SP. **Obligatoria tal cual**; no se renombra ni se reinterpretan sus términos de negocio. RB-001…RB-009 corresponden **una a una** a las 8 viñetas de SP §REGLAS DE NEGOCIO IMPORTANTES (más la separación explícita formato-fecha/formato-monedas) y deben conservarse íntegras.
- `[DERIVADA]` — regla necesaria para hacer determinista/coherente una instrucción o el modelo de datos de SP (p. ej. fórmulas de totales implícitas en columnas del esquema). No agrega procesos nuevos: solo fija la interpretación más simple y consistente (cláusula final de SP).
- `[RECOMENDADA]` — propuesta del analista, descartable sin violar SP.
- `[PENDIENTE OQ-xx]` — detalle reservado a decisión de AG-001/AG-003 (lista en `FUNCTIONAL_REQUIREMENTS.md` §8).

Capas de aplicación (para verificabilidad):

| Capa | Mecanismo en este proyecto |
|---|---|
| **L1** UI | Validación React + shadcn/ui, mensajes en español |
| **L2** Postgres | `CHECK`, `UNIQUE`, FK, triggers/funciones SQL |
| **L3** RLS | Políticas Row Level Security de Supabase por sesión administrativa/cliente |
| **L4** RPC/transacción | Función Postgres atómica para operaciones compuestas (facturar, ajustar stock, procesar cola) |
| **L5** Job/Edge Function | Procesamiento de cola de emails, detección de vencidos, expiración de sesiones |

Principio: toda regla dura vive en L2/L3/L4; L1 es comodidad. La verificación de cada RB es un test automatizado o un paso de QA con datos semilla (RNF-M-02).

---

## 2. Índice de reglas

| ID | Nombre | Clasificación |
|---|---|---|
| RB-001 | No eliminar datos de producción durante pruebas | CONFIRMADA |
| RB-002 | Stock se actualiza automáticamente al agregar/eliminar productos en órdenes o ventas | CONFIRMADA |
| RB-003 | Una orden se factura una sola vez (movimiento + facturado=true) | CONFIRMADA |
| RB-004 | Una venta se factura una sola vez (movimiento + facturado=true) | CONFIRMADA |
| RB-005 | Los reportes PDF usan los datos de la empresa | CONFIRMADA |
| RB-006 | Los permisos controlan acceso a cada módulo y acción | CONFIRMADA |
| RB-007 | Fechas en formato dd/mm/aaaa | CONFIRMADA |
| RB-008 | Valores monetarios con 2 decimales | CONFIRMADA |
| RB-009 | La auditoría registra acciones relevantes | CONFIRMADA |
| RB-010 | Estados de orden: exactamente los 6 de SP | CONFIRMADA |
| RB-011 | Login administrativo = correo + contraseña; hash bcrypt/argon2 | CONFIRMADA |
| RB-012 | Ingreso al portal = correo + documento coincidentes con un cliente | CONFIRMADA |
| RB-013 | Sesiones persistentes con expiración | CONFIRMADA |
| RB-014 | `pagado` con `fecha_pago`; tipo ingreso/egreso obligatorio | DERIVADA |
| RB-015 | Estados de email: pendiente/enviando/enviado/fallido, con transiciones | CONFIRMADA+DERIVADA |
| RB-016 | Categoría/cuenta de un movimiento deben coincidir en `tipo` | DERIVADA |
| RB-017 | `subtotal = cantidad × precio` en toda línea | DERIVADA |
| RB-018 | `valor_total` de orden = Σ productos + Σ servicios | DERIVADA |
| RB-019 | `valor_total` de venta = Σ ítems − descuento, ≥ 0 | DERIVADA |
| RB-020 | Stock nunca negativo por acción de usuario directo | DERIVADA `[PENDIENTE OQ-01]` |
| RB-021 | Líneas guardan snapshot de descripción/precio del catálogo | DERIVADA |
| RB-022 | No se elimina un registro referenciado por FK | DERIVADA `[PENDIENTE OQ-03]` |
| RB-023 | Grupo de permisos inactivo no otorga acceso; usuario sin grupo activo no entra | DERIVADA |
| RB-024 | `fecha_expiracion` del usuario limita el login | DERIVADA |
| RB-025 | Detección de vencidos: no pagado y `fecha_vencimiento` < hoy | DERIVADA |
| RB-026 | Mapeo de la Situación del filtro financiero | DERIVADA |
| RB-027 | Facturar enlaza `lanzamiento_id` (y `venta_id`) con el movimiento creado | CONFIRMADA (modelo) |
| RB-028 | Registro de auditoría: usuario, tarea, fecha, hora, IP | CONFIRMADA |
| RB-029 | Códigos de permiso: formato `<act><Módulo>` con 6×14 vocabulario | CONFIRMADA |
| RB-030 | Una sola empresa (registro único) | DERIVADA |
| RB-031 | RLS en Supabase sobre todas las tablas | CONFIRMADA (seguridad) |
| RB-032 | Separación estricta de rol administrador / rol cliente | CONFIRMADA (seguridad) |
| RB-033 | Validación de formularios en frontend **y** backend | CONFIRMADA (seguridad) |
| RB-034 | Sanitización de entradas | CONFIRMADA (seguridad) |
| RB-035 | Rutas privadas protegidas | CONFIRMADA (seguridad) |
| RB-036 | No exponer credenciales en el frontend | CONFIRMADA (seguridad) |

> SP, frase final, obliga: “No omitas ningún módulo, tabla, relación, filtro, reporte ni flujo descrito”. Las RB-001…RB-009 y RB-031…RB-036 son la transcripción operativa de las secciones §REGLAS DE NEGOCIO y §SEGURIDAD de SP; ninguna fue modificada ni eliminada.

---

## 3. Reglas confirmadas de SP (núcleo) 

### RB-001 — No eliminar datos de producción durante pruebas `[CONFIRMADA]`
- **Enunciado (SP textual):** “No eliminar datos de producción durante pruebas.”
- **Aplicación:** L2/L5: los scripts/seed de prueba crean datos en aislamiento (base/schema de test o prefijo identificable + limpieza solo de datos de test); está prohibido `TRUNCATE`/`DELETE` masivo sobre datos reales. Las pruebas de QA usan datos de ejemplo mínimos (SP §ENTREGABLE), no la producción.
- **Verificación:** revisión del pipeline de test (no toca instancia de producción); job de seed testeado idempotente sobre schema vacío.
- **Trazabilidad:** RNF-M-02, §ENTREGABLE SP.

### RB-002 — Actualización automática de stock `[CONFIRMADA]`
- **Enunciado (SP textual):** “El stock se actualiza automáticamente al agregar/eliminar productos en órdenes o ventas.”
- **Enunciado ampliado operativo `[DERIVADA]`:** en la misma transacción que la línea: alta de una línea en `productos_orden` (orden) o `items_venta` (venta) ⇒ `stock -= cantidad`; retiro de línea ⇒ `stock += cantidad` previamente descontada; cambio de cantidad ajusta la diferencia. Invariante: `stock` = valor inicial + Σ(devoluciones por retiro) − Σ(cantidades vigentes en líneas de órdenes y ventas).
- **Aplicación:** L4 (RPC `agregar_linea/quitar_linea` o trigger sobre insert/delete de las tablas línea) — prohibida la escritura directa de `productos.stock` desde el cliente (L3 RLS restringe UPDATE).
- **Mensaje UI:** al exceder stock, aviso según política OQ-01 («Stock disponible: X» y sugerencia de estado “Aguardando Piezas”).
- **Verificación:** test de propiedad: secuencias arbitrarias alta/edición/baja de líneas ⇒ invariante 0 desviación.
- **Trazabilidad:** RF-017, RF-018, RF-030, RF-037.

### RB-003 — Facturación única de orden `[CONFIRMADA]`
- **Enunciado (SP textual):** “Una orden puede facturarse una sola vez; al facturar se crea un movimiento financiero y se marca `facturado=true`.”
- **Aplicación:** L4 `facturar_orden(id)` verifica `facturado = false` (y `lanzamiento_id IS NULL`) en la transacción; L2 `CHECK` de apoyo no posible entre tablas ⇒ constraint parcial: `CREATE UNIQUE INDEX ... ON ordenes_trabajo(lanzamiento_id) WHERE lanzamiento_id IS NOT NULL` refuerza vínculo 1:1. L1 oculta el botón si `facturado=true`.
- **Mensaje UI:** «La orden ya fue facturada.»
- **Efecto:** inserción en `movimientos_financieros` (`tipo='ingreso'`, `valor=valor_total`, cliente, forma de pago del diálogo de facturación `[DERIVADA]`), update `ordenes_trabajo.lanzamiento_id`, `facturado=true`. Sin función de “desfacturar” (SP no la define — no inventar procesos).
- **Verificación:** test: doble llamada concurrente ⇒ un movimiento creado; `facturado` y `lanzamiento_id` coherentes; auditoría registra la acción.
- **Trazabilidad:** RF-028, RB-027, RB-009.

### RB-004 — Facturación única de venta `[CONFIRMADA]`
- **Enunciado (SP textual):** “Una venta puede facturarse una sola vez; al facturar se crea un movimiento financiero y se marca `facturado=true`.”
- **Aplicación:** como RB-003; además `movimientos_financieros.venta_id` se rellena con la venta (vínculo bidireccional del modelo SP). Índices parciales análogos.
- **Verificación:** como RB-003 + comprobación del doble vínculo (`ventas.lanzamiento_id` ↔ `movimientos_financieros.venta_id`).
- **Trazabilidad:** RF-035, RB-027.

### RB-005 — PDF con datos de la empresa `[CONFIRMADA]`
- **Enunciado (SP textual):** “Los reportes PDF deben usar los datos de la empresa.”
- **Operacionalización `[DERIVADA]`:** encabezado de todo PDF (reportes e impresiones de orden/venta/garantía) contiene: nombre, CNPJ/IE, dirección, teléfono/correo de `empresa` y logo (`url_logo`) (SP §FUNCIONALIDADES 12: “encabezado de empresa, datos tabulados y paginación”; §FUNCIONALIDADES 16: “Logo para reportes PDF”).
- **Aplicación:** L1/L4: el generador lee `empresa` en cada ejecución (sin hardcode).
- **Verificación:** QA visual + test del generador con empresa semilla modificada: el PDF cambia.
- **Trazabilidad:** RF-027, RF-036, RF-040, RF-065, RF-078, RF-082.

### RB-006 — Permisos controlan módulo + acción `[CONFIRMADA]`
- **Enunciado (SP textual):** “Los permisos controlan acceso a cada módulo y acción.”
- **Operacionalización:** para cada módulo cubierto (RB-029) y cada código `a/e/d/v/r/c`, la presencia del código en el grupo del usuario habilita o deniega: menú (UI), endpoint/RPC (L4) y datos (L3 RLS). La denegación ocurre **aunque se invoque la API directamente**.
- **Verificación:** matriz de pruebas RLS×código: por cada (módulo, acción, permiso presente/ausente) → 200/403-oculto. Suite automatizada por tabla.
- **Trazabilidad:** RF-006, RF-009, RF-059…061, RNF-S-02.

### RB-007 — Formato de fechas dd/mm/aaaa `[CONFIRMADA]`
- **Enunciado (SP textual):** “Las fechas deben mostrarse en formato dd/mm/aaaa.”
- **Aplicación:** L1 (formateo centralizado en UI) **y** en documentos impresos/PDF. Almacenamiento interno en tipos fecha/hora nativos (Postgres) — la regla es de **visualización** `[DERIVADA]`.
- **Verificación:** test unitario del formateador + revisión QA de cada pantalla y PDF.
- **Trazabilidad:** RNF-U-01, RNF-U-05.

### RB-008 — Moneda con 2 decimales `[CONFIRMADA]`
- **Enunciado (SP textual):** “Los valores monetarios deben mostrarse con 2 decimales.”
- **Operacionalización `[DERIVADA]`:** tipos `numeric(12,2)` (o superior) para importes; redondeo a 2 decimales en totales; formato de visualización con separadores locales. Moneda/símbolo no especificado por SP → `[PENDIENTE]`: por los campos brasileños del modelo (CNPJ, IE, CPF, RG) se infiere entorno BRL (R$) como default visual, configurable en diseño; OQ no bloqueante.
- **Verificación:** test del formateador monetario; `CHECK (valor >= 0)` en movimientos (el signo viene de `tipo`) `[DERIVADA]`.
- **Trazabilidad:** RNF-U-05, RF-015, RF-024, RF-034.

### RB-009 — Auditoría de acciones relevantes `[CONFIRMADA]`
- **Enunciado (SP textual):** “La auditoría debe registrar acciones relevantes.” + §FUNCIONALIDADES 13: registrar usuario, tarea, fecha, hora, IP.
- **Conjunto mínimo de “relevantes” `[DERIVADA]` (verificable):** login/logout (admin y portal), crear/editar/eliminar en clientes, productos, servicios, órdenes, ventas, garantías, movimientos, documentos, usuarios, permisos, empresa; facturar orden/venta; cambiar estado de orden; actualizar stock vía líneas; enviar/reintentar/eliminar email; limpiar logs. Lista cerrada se aprueba en diseño.
- **Aplicación:** L2/L4 (trigger/función común o helper en RPC — nunca solo desde la UI).
- **Verificación:** test por acción: tras ejecutarla existe fila en `logs_auditoria` con los 5 campos.
- **Trazabilidad:** RF-067…RF-069.

---

## 4. Reglas confirmadas de SP (modelo y flujos) 

### RB-010 — Estados de la orden `[CONFIRMADA]`
Solo estos 6 valores, con nombres exactos: `Presupuesto, Abierta, En Proceso, Finalizado, Cancelado, Aguardando Piezas`. L2 `CHECK (estado IN (...))`. No se añaden (p. ej. “Lista_entrega”) ni renombran. Las transiciones entre ellos no están restringidas por SP → `[DERIVADA]` que permite cualquier cambio explícito con auditoría (RB-009); el diseño no debe inventar máquina de estados sin autorización AG-001. **Trazabilidad:** RF-021.

### RB-011 — Credenciales administrativas `[CONFIRMADA]`
Login por correo + contraseña; hash bcrypt/argon2 (o Supabase Auth, que aplica hash seguro equivalente — decisión de diseño `[INFERIDA]`, el requisito de negocio es “hash seguro, nunca texto plano”). **Trazabilidad:** RF-001, RF-002, RF-055.

### RB-012 — Acceso al portal por correo + documento `[CONFIRMADA]`
“Si coinciden con un cliente registrado, crear sesión de cliente” (SP §AUTENTICACIÓN). Coincidencia sobre `clientes.correo` + `clientes.documento` (par exacto; normalización de espacios/mayúsculas `[RECOMENDADA]`). Sin coincidencia → sin sesión. Un solo cliente coincidente esperado; si el seed/operador creara duplicados, `[DERIVADA]` L2 `UNIQUE(correo, documento)` no exigible por SP → comportamiento: primer registro + alerta al admin `[RECOMENDADA]` — validar. **Trazabilidad:** RF-075.

### RB-013 — Sesión con expiración `[CONFIRMADA]`
Sesión persistente con expiración para ambos tipos de sesión (admin y cliente, SP §AUTENTICACIÓN). Vigencias concretas: `[DERIVADA]` default sugerido 24 h admin (refresh silencioso), 8 h portal `[RECOMENDADA]`; decisión final diseño. **Trazabilidad:** RF-003, RF-005, RNF-S-08.

### RB-015 — Ciclo de estados de email `[CONFIRMADA]`
Valores exactos: `pendiente, enviando, enviado, fallido`. Transiciones válidas `[DERIVADA]`: pendiente→enviando→enviado | fallido; fallido→pendiente (reintento, RF-073) o →enviando directo; ningún estado regresa a “enviado→pendiente”. L2 `CHECK`. Procesamiento en L5. **Trazabilidad:** RF-070…RF-073.

### RB-027 — Vínculo de facturación `[CONFIRMADA — modelo]`
La columna `lanzamiento_id` (inglés de “lanzamiento” = asiento contable) de órdenes y ventas referencia `movimientos_financieros.id_movimiento`; `movimientos_financieros.venta_id` referencia la venta. Ambos lados se escriben en la misma transacción del facturar (RB-003/RB-004). **Trazabilidad:** RF-028, RF-035, RF-042.

### RB-028 — Campos de auditoría `[CONFIRMADA]`
`logs_auditoria` registra `usuario, tarea, fecha, hora, ip` (5 campos exactos de SP; sin campos extra de negocio — detalle técnico como `id_log` ya está en el modelo). `[DERIVADA]` `ip` obtenida del contexto de request, no de la UI. **Trazabilidad:** RF-067.

### RB-029 — Vocabulario de códigos de permiso `[CONFIRMADA]`
Actividades: `a`=agregar, `e`=editar, `d`=eliminar, `v`=visualizar, `r`=reporte, `c`=configuración. Módulos cubiertos (14, nombres SP): Cliente, Producto, Servicio, Orden, Venta, Garantía, Movimiento, Archivo, Usuario, Permiso, Respaldo, Auditoría, Email, Empresa. Ejemplos SP: `aCliente, eCliente, dCliente, vCliente, rCliente; aProducto, …`. Almacenamiento: texto separado por coma **o** JSON (SP da ambas opciones). `[PENDIENTE]` efecto de códigos de “Respaldo” sin módulo funcional en SP → RF-060 CA3 (no inventar pantalla). **Trazabilidad:** RF-059…RF-061, RB-006.

### RB-031…RB-036 — Reglas de seguridad de SP `[CONFIRMADA]`
Transcripción operativa de SP §SEGURIDAD:
- **RB-031 RLS:** todas las tablas del modelo tienen políticas Row Level Security activas. Nadie consulta sin sesión administrativa o de cliente válida; la visibilidad se deriva del grupo de permisos (RB-006) para admin y del propio `id_cliente` para portal.
- **RB-032 Roles separados:** sesión “administrador” (usuarios + permisos) y sesión “cliente” (clientes vía portal) son tipos incompatibles: una sesión de cliente jamás accede tablas/acciones administrativas (RLS por tipo de token/claim).
- **RB-033 Validación doble:** cada formulario valida en frontend (reglas de este documento) **y** en backend (constraints L2 + checks L4); ninguna regla dura depende de la validación de L1.
- **RB-034 Sanitización:** entradas se sanitizan/escapan (texto libre en descripciones, mensajes de email, URLs de documentos); salida codificada en la UI; sin `dangerouslySetInnerHTML` sin saneado `[DERIVADA]`; parámetros por bind (PostgREST/SQL parametrizado).
- **RB-035 Rutas privadas:** toda ruta de panel y portal exige sesión válida del tipo correcto; rutas no públicas inaccesibles sin credenciales (redirección a login).
- **RB-036 Sin credenciales en el frontend:** solo la `anon key` pública de Supabase en el bundle; `service_role`/secretos SMTP únicamente server-side (Edge Functions/vars); 0 claves privadas en repo/bundle.
- **Verificación:** suite de pruebas RLS por tabla/rol; escaneo del bundle (grep gitleaks); prueba de ruta directa sin sesión → login; fuzzing de formularios. **Trazabilidad:** RNF-S-01…S-07.

---

## 5. Reglas derivadas del modelo (interpretación mínima) 

### RB-014 — Coherencia pago/tipo de movimiento `[DERIVADA]`
`tipo ∈ {ingreso, egreso}` (L2 CHECK). `pagado=true` implica `fecha_pago NOT NULL` (L4/L2 con CASE-check `[INFERIDA]` — SP no lo enlaza; es la invariante mínima que hace significativa la columna). Valores de movimiento positivos; la dirección la da `tipo` (RB-008).

### RB-016 — Concordancia de tipo en categoría/cuenta `[DERIVADA]`
Al crear/editar un movimiento, `categoria_id.tipo` y `cuenta_id.tipo` deben coincidir con `movimientos_financieros.tipo`; solo registros `estado=true` seleccionables. SP define los campos `tipo/estado` de esas tablas y su uso (filtros); esta es su consecuencia de integridad mínima. Mensaje: «La categoría seleccionada es de egresos.»

### RB-017 — Subtotal de línea `[DERIVADA]`
`subtotal = cantidad × precio` (redondeo RB-008) en `productos_orden`, `servicios_orden`, `items_venta`. Recalculado por L4 en insert/update de línea (no confiado a la UI). `cantidad > 0`, `precio ≥ 0`.

### RB-018 — Total de orden `[DERIVADA]`
`ordenes_trabajo.valor_total = Σ productos_orden.subtotal + Σ servicios_orden.subtotal`. Sin descuento/impuesto en orden (SP no los define para órdenes — no agregar). Recalculado L4 en cada cambio de líneas y al facturar (RB-003 usa este valor).

### RB-019 — Total de venta `[DERIVADA]`
`ventas.valor_total = Σ items_venta.subtotal − descuento`, con `descuento ≥ 0` y `valor_total ≥ 0` (L2 CHECK). Descuento en venta, no en orden (SP).

### RB-020 — Stock no negativo `[DERIVADA]` `[PENDIENTE OQ-01]`
`CHECK (stock >= 0)` como última defensa L2. Comportamiento al agregar línea con cantidad > stock disponible es la decisión OQ-01 (advertir+permitir vs bloquear). Ambas opciones conservan la invariante: el stock físico real nunca se fuerza a negativo en el dato (si se permite la línea con faltante, la orden se orienta al estado “Aguardando Piezas” — lectura `[INFERIDA]`).

### RB-021 — Snapshot de líneas `[DERIVADA]`
Las tablas línea duplican `descripcion`/`precio`/`servicio` del catálogo al crear la línea; editar el catálogo (producto/servicio) **no** reescribe líneas existentes (columnas propias en SP §productos_orden/servicios_orden/items_venta lo exigen). Los totales de documentos históricos permanecen estables.

### RB-022 — Integridad referencial en eliminaciones `[DERIVADA]` `[PENDIENTE OQ-03]`
CRUD con “eliminar” convive con FKs: eliminar un padre con hijos referenciados se rechaza (L2 `ON DELETE RESTRICT`) con mensaje en español («El registro tiene órdenes asociadas; no puede eliminarse.»). Alternativa en validación: borrado lógico. Sin inventar: SP no define “desactivar” en clientes/productos → no se agrega UI de desactivado salvo que AG-001 lo apruebe.

### RB-023 — Efecto del estado del grupo de permisos `[DERIVADA]`
Grupo `estado=false`: los usuarios asignados a él pierden todo acceso (menú vacío/denegado) pero mantienen sesión de solo-reinicio o quedan bloqueados — interpretación más simple: **login denegado** al usuario cuyo grupo esté inactivo, hasta reasignación por otro administrador con permisos. SP define `estado` en `permisos` (§FUNCIONALIDADES 11 “desactivar”) sin detalle → `[INFERIDA]` y validable.

### RB-024 — Expiración de usuario `[DERIVADA]`
`usuarios.fecha_expiracion` superada → login denegado («Su usuario ha expirado; contacte al administrador.»). SP incluye el campo y la pantalla (fecha de expiración) sin efecto explícito; la inferencia más simple y consistente con un sistema de accesos es ese bloqueo. `[INFERIDA]`.

### RB-025 — Vencidos `[DERIVADA]`
“Detección de vencidos” (SP §Financiero): `pagado=false AND fecha_vencimiento < CURRENT_DATE` (en zona local del taller `[INFERIDA]`) ⇒ movimiento vencido; visible en listado (marca), en filtro (RB-026 “atrasado”) y en Panel (RF-007 “movimientos pendientes” incluye vencidos).

### RB-026 — Situaciones del filtro financiero `[DERIVADA]`
Mapeo propuesto para los 5 filtros SP (todos/previsto/atrasado/realizado/pendiente):
| Situación SP | Definición inferida |
|---|---|
| realizado | `pagado = true` |
| atrasado | `pagado = false` y `fecha_vencimiento < hoy` |
| previsto | `pagado = false` y `fecha_vencimiento > hoy` |
| pendiente | `pagado = false` (todas las vencidas/vigentes/futuras — vista consolidada) |
| todos | sin filtro |
Nota: “pendiente” como superconjunto es la lectura más simple; si AG-001 prefiere partición excluyente (p. ej. pendiente = vence hoy), ajustar solo la definición SQL. **Trazabilidad:** RF-044, RF-046.

### RB-030 — Empresa única `[DERIVADA]`
`empresa` con registro único (L2: `CHECK (id = 1)` o constraint equivalente; UI sin alta múltiple: solo “crear” la primera vez y “editar” después — SP §FUNCIONALIDADES 16 “Crear, editar datos”). Si existiera fila extra por error, la UI/impresión usa la única válida. **Trazabilidad:** RF-081, RB-005.

---

## 6. Matriz RB → RF → capa dura → prueba

| RB | Capa | RF relacionadas | Prueba mínima |
|---|---|---|---|
| RB-001 | L5/proceso | — | Revisión de pipeline de test/seed |
| RB-002 | L4 | RF-017/018/030/037 | Propiedad: invariante de stock |
| RB-003 | L4 + índice parcial | RF-028 | Int: doble factura concurrente |
| RB-004 | L4 + índice parcial | RF-035 | Int: doble factura + doble vínculo |
| RB-005 | L1/L4 | RF-065/027/036/040 | QA PDF con empresa semilla |
| RB-006 | L3+L4 | RF-006/009/059–061 | Matriz RLS × código (auto) |
| RB-007 | L1 | todas las vistas | Unit formateador + QA |
| RB-008 | L2+L1 | RF-015/024/034 | Unit formateador + CHECK |
| RB-009 | L2/L4 | RF-067 | Por acción: fila de log presente |
| RB-010 | L2 CHECK | RF-021 | Unit: valor inválido rechazado |
| RB-011 | L1/L3 | RF-001/002/055 | No hash en claro; login OK/fallido |
| RB-012 | L3/L4 | RF-075 | Int: par coincidente/no coincidente |
| RB-013 | L3 | RF-003/004 | Expiración simulada |
| RB-014 | L2 | RF-041 | Unit: pagado sin fecha → rechaza |
| RB-015 | L2 CHECK | RF-071/072/073 | Transiciones válidas/inválidas |
| RB-016 | L4 | RF-041/047 | Int: categoría tipo erróneo |
| RB-017 | L4 | RF-022/023/033 | Unit: subtotal recalculado |
| RB-018 | L4 | RF-024 | Int: total tras cambios de líneas |
| RB-019 | L2/L4 | RF-034 | Unit: descuento > subtotal |
| RB-020 | L2 CHECK | RF-017 | Propiedad: stock ≥ 0 siempre |
| RB-021 | L2 (datos) | RF-022/023/029 | Int: editar catálogo no toca líneas |
| RB-022 | L2 FK | RF-010/015/019/032/038 | Int: eliminar con hijos → rechazo |
| RB-023 | L4/RDS | RF-056/059 | Int: grupo inactivo → sin acceso |
| RB-024 | L4 | RF-057 | Fecha simulada > expiración |
| RB-025 | L5/consulta | RF-046 | Fechas controladas; marca visible |
| RB-026 | consulta | RF-044 | Tabla de 5×situaciones con dataset |
| RB-027 | L4 | RF-028/035 | Int: enlaces coherentes |
| RB-028 | L2/L4 | RF-067 | 5 campos presentes en cada log |
| RB-029 | L3/L1 | RF-059–061 | Parser de códigos; UI editor |
| RB-030 | L2 | RF-081 | Int: segunda fila empresa rechazada |
| RB-031–036 | L1–L4 | RNF-S-* | Suite seguridad (sección §4) |

---

## 7. Reglas explícitamente NO incluidas (anti-invención)

Para cumplir “No inventar procesos adicionales” (SP), se documenta lo que este análisis **deliberadamente no agrega**, aunque un sistema similar lo tuviera: facturas fiscales/legalmente vinculantes; notas de crédito/anulaciones automáticas; aprobaciones multinivel; máquinas de estados estrictas de orden (más allá del enum RB-010); “desfacturar”; notificaciones WhatsApp/SMS; portal con pago en línea; multi-empresa/multi-sede; reservas de stock independientes de las líneas; catálogo de categorías de archivo con tabla propia; backup “Respaldo” funcional (solo códigos reservos RB-029). Si AG-001 desea alguno, es un cambio de alcance explícito, no una omisión de este análisis.
