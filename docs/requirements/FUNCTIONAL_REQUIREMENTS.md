# Requisitos Funcionales — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0001 — Requirements Analysis |
| Autor | AG-004 Business Analyst |
| Fecha | 2026-11-05 |
| Versión | **2.0** — Rebasing completo contra la fuente de verdad. Sustituye a v1.x (que modeló un dominio de taller automotriz con vehículos/citas **no presente** en la fuente y omitió módulos obligatorios; ver §9). |
| Fuente de verdad | `docs/requirements/SOURCE_PROMPT.md` (SP), copia de `/home/developer/prompts/PROMPT_SISTEMA_TALLER.md` |
| Estado | Requisitos de fuente confirmados; 6 puntos abiertos de implementación (§8). Ninguno bloquea el inicio de diseño de BD/stack, salvo OQ-01 y OQ-03 (riesgo medio). |
| Stack obligatorio | React + TypeScript + Tailwind CSS + shadcn/ui + Supabase `[CONFIRMADA — SP §STACK]` |
| Idioma UI | Español `[CONFIRMADA — SP §STACK]` |

---

## 1. Cómo leer este documento

Clasificación de cada requisito (no se inventan necesidades del usuario; SP autoriza inferir solo detalles **no especificados**, "de la implementación más simple y consistente… sin agregar funcionalidades nuevas" — SP, párrafo final):

| Etiqueta | Significado |
|---|---|
| `[CONFIRMADA]` | Declaración explícita de SP. Obligatorio, texto de negocio no modificable (nombres, campos, estados, códigos). |
| `[INFERIDA]` | Detalle no especificado en SP; inferencia más simple y consistente permitida por SP. Validar en revisión de diseño. |
| `[RECOMENDADA]` | Buena práctica del analista; descartable sin alterar el alcance exigido por SP. |
| `[PENDIENTE]` | Brecha real sin respuesta posible en SP → abierta como OQ (§8), escalada a AG-001 si es crítica. |

Referencias cruzadas: `RB-xxx` en `BUSINESS_RULES.md`, `RNF-xxx` en `NON_FUNCTIONAL_REQUIREMENTS.md`, `HU-xxx` en `USER_STORIES.md`.

**Regla de integridad del alcance:** SP exige recrear "exactamente" el sistema, "sin agregar ni quitar funcionalidades", "No reducir funcionalidades. No cambiar nombres de negocio. No inventar procesos adicionales." Los 17 módulos de SP §MÓDULOS OBLIGATORIOS se conservan con sus nombres y numeración originales. Los IDs RF solo reorganizan esas declaraciones; no añaden módulos.

## 2. Actores

| Actor | Descripción | Origen |
|---|---|---|
| Usuario administrativo | Persona con registro en `usuarios` y un grupo de `permisos` activo; accede al panel administrativo por correo + contraseña. El "admin" (dueño/gerente) es el usuario con códigos completos, incluido gestión de usuarios/permisos. | `[CONFIRMADA]` SP §AUTENTICACIÓN, §FUNCIONALIDADES 10–12 |
| Cliente (externo) | Persona registrada en `clientes`; accede únicamente al Portal del cliente con correo + documento. | `[CONFIRMADA]` SP §AUTENTICACIÓN, §FUNCIONALIDADES 15 |
| Sistema | Procesos automáticos: actualización de stock, generación de movimientos al facturar, procesamiento de cola de emails, registro de auditoría, vencimientos financiero. | `[CONFIRMADA]` SP §FUNCIONALIDADES, §REGLAS DE NEGOCIO |

---

## 3. Alcance: los 17 módulos obligatorios (SP §MÓDULOS OBLIGATORIOS, textual)

| # | Módulo (nombre SP) | Sección SP de funcionalidades | RF |
|---|---|---|---|
| 1 | Autenticación administrativa | §AUTENTICACIÓN Y SESIONES | RF-001…006 |
| 2 | Panel principal | §FUNCIONALIDADES 1 | RF-007…009 |
| 3 | Clientes | §FUNCIONALIDADES 2 | RF-010…014 |
| 4 | Productos | §FUNCIONALIDADES 3 | RF-015…018 |
| 5 | Servicios | §FUNCIONALIDADES 4 | RF-019 |
| 6 | Órdenes de trabajo | §FUNCIONALIDADES 5 | RF-020…031 |
| 7 | Ventas | §FUNCIONALIDADES 6 | RF-032…037 |
| 8 | Garantías | §FUNCIONALIDADES 7 | RF-038…040 |
| 9 | Financiero | §FUNCIONALIDADES 8 | RF-041…048 |
| 10 | Archivos/Documentos | §FUNCIONALIDADES 9 | RF-049…053 |
| 11 | Usuarios | §FUNCIONALIDADES 10 | RF-054…058 |
| 12 | Permisos | §FUNCIONALIDADES 11 | RF-059…061 |
| 13 | Informes/Reportes | §FUNCIONALIDADES 12 | RF-062…066 |
| 14 | Auditoría | §FUNCIONALIDADES 13 | RF-067…069 |
| 15 | Cola de emails | §FUNCIONALIDADES 14 | RF-070…074 |
| 16 | Portal del cliente | §FUNCIONALIDADES 15 | RF-075…080 |
| 17 | Configuración de empresa | §FUNCIONALIDADES 16 | RF-081…082 |

> Nota de denominación: la lista de módulos del pipeline abrevia el módulo 1 como "Autenticación admin"; SP lo nombra "Autenticación administrativa". Se conserva el nombre SP (fuente de verdad) y ambos se consideran equivalentes.

## 4. Modelo de datos exigido (SP §MODELO DE DATOS) `[CONFIRMADA]`

Requisito estructural: la base PostgreSQL/Supabase debe contener exactamente estas tablas, con nombres de tabla/columna en español y las relaciones (PK/FK) indicadas. Cualquier nombre adicional de tabla/módulo está **fuera de alcance** (no improvisar). Tipos y constraints finos: decisión de diseño AG-003 guiada por RB/RNF.

| # | Tabla | Columnas (SP textual) | Relaciones |
|---|---|---|---|
| 1 | `clientes` | id_cliente (PK), nombre_cliente, sexo, persona_fisica (booleano), documento, telefono, celular, correo, fecha_registro, calle, numero, barrio, ciudad, estado, codigo_postal | Referida por órdenes, ventas, movimientos, equipos |
| 2 | `productos` | id_producto (PK), descripcion, unidad, precio_compra, precio_venta, stock, stock_minimo, salida (booleano), entrada (booleano) | Referida por productos_orden, items_venta |
| 3 | `servicios` | id_servicio (PK), nombre, descripcion, precio | Referida por servicios_orden |
| 4 | `ordenes_trabajo` | id_orden (PK), fecha_inicial, fecha_final, garantia, descripcion_producto, defecto, estado (Presupuesto, Abierta, En Proceso, Finalizado, Cancelado, Aguardando Piezas), observaciones, laudo_tecnico, valor_total, cliente_id (FK clientes), usuario_id (FK usuarios), lanzamiento_id (FK movimientos_financieros, nullable), facturado (booleano), garantia_id (FK garantias, nullable) | FKs a clientes, usuarios, movimientos_financieros, garantias; referida por productos_orden, servicios_orden, anexos, equipos_orden |
| 5 | `productos_orden` | id_producto_orden (PK), cantidad, descripcion, precio, orden_id (FK ordenes_trabajo), producto_id (FK productos), subtotal | — |
| 6 | `servicios_orden` | id_servicio_orden (PK), servicio, cantidad, precio, orden_id (FK ordenes_trabajo), servicio_id (FK servicios), subtotal | — |
| 7 | `ventas` | id_venta (PK), fecha_venta, valor_total, descuento, facturado (booleano), cliente_id (FK clientes), usuario_id (FK usuarios), lanzamiento_id (FK movimientos_financieros, nullable) | Referida por items_venta y movimientos_financieros |
| 8 | `items_venta` | id_item_venta (PK), cantidad, descripcion, precio, venta_id (FK ventas), producto_id (FK productos), subtotal | — |
| 9 | `garantias` | id_garantia (PK), fecha_garantia, referencia, texto_garantia, usuario_id (FK usuarios) | Referida por ordenes_trabajo.garantia_id |
| 10 | `movimientos_financieros` | id_movimiento (PK), descripcion, valor, fecha_vencimiento, fecha_pago, pagado (booleano), cliente_proveedor, forma_pago, tipo (ingreso/egreso), anexo, cliente_id (FK clientes, nullable), categoria_id (FK categorias, nullable), cuenta_id (FK cuentas, nullable), venta_id (FK ventas, nullable) | FKs a clientes, categorias, cuentas, ventas; referida por ordenes_trabajo.lanzamiento_id y ventas.lanzamiento_id |
| 11 | `categorias` | id_categoria (PK), categoria, fecha_registro, estado (booleano), tipo (ingreso/egreso) | — |
| 12 | `cuentas` | id_cuenta (PK), cuenta, banco, numero, saldo, fecha_registro, estado (booleano), tipo | — |
| 13 | `anexos` | id_anexo (PK), anexo, miniatura, url, ruta, orden_id (FK ordenes_trabajo) | — |
| 14 | `documentos` | id_documento (PK), documento, descripcion, archivo, ruta, url, fecha_registro, categoria, tipo, tamaño | — |
| 15 | `marcas` | id_marca (PK), marca, fecha_registro, estado (booleano) | Referida por equipos |
| 16 | `equipos` | id_equipo (PK), equipo, numero_serie, modelo, color, descripcion, tension, potencia, voltaje, fecha_fabricacion, marca_id (FK marcas), cliente_id (FK clientes) | — |
| 17 | `equipos_orden` | id_equipo_orden (PK), defecto_declarado, defecto_encontrado, solucion, equipo_id (FK equipos), orden_id (FK ordenes_trabajo) | — |
| 18 | `usuarios` | id_usuario (PK), nombre, rg, cpf, calle, numero, barrio, ciudad, estado, correo, contraseña, telefono, celular, estado(bool)… | Ver nota de ambigüedad §4.1; FK a permisos; SP textual: nombre, rg, cpf, calle, numero, barrio, ciudad, estado, correo, contraseña, telefono, celular, estado (booleano), fecha_registro, permiso_id (FK permisos), fecha_expiracion |
| 19 | `permisos` | id_permiso (PK), nombre, permisos (texto con códigos de actividad separados por coma o JSON), estado (booleano), fecha | Referida por usuarios |
| 20 | `empresa` | id (PK), nombre, cnpj, ie, calle, numero, barrio, ciudad, provincia, telefono, correo, url_logo | — |
| 21 | `logs_auditoria` | id_log (PK), usuario, tarea, fecha, hora, ip | — |
| 22 | `cola_emails` | id (PK), para, cc, cco, mensaje, estado (pendiente, enviando, enviado, fallido), fecha, encabezados | — |
| 23 | `sesiones` | "tabla de sesiones de base de datos" | `[INFERIDA]` ver RF-005 |

### 4.1 Notas de modelo
- **Colisión `estado` en `usuarios`:** SP lista `estado` como campo de dirección **y** como booleano activo/inactivo. `[INFERIDA]` la columna booleana se materializa como `estado` (activo/inactivo, SP §FUNCIONALIDADES 10 "Estado activo/inactivo") y la dirección usa `calle, numero, barrio, ciudad, estado` (provincia/UF). Decisión de nomenclatura física (p. ej. `estado_usuario` + `estado` de región) corresponde a AG-003; el significado de negocio queda conservado. Riesgo bajo.
- `ordenes_trabajo.garantia` (columna) vs `garantia_id` (FK): `[INFERIDA]` `garantia` = indicador/valor de garantía declarado al recibir la orden; `garantia_id` = término de garantía (tabla `garantias`) asociado. Semántica fina: OQ-04.
- `productos.salida`/`entrada` (booleanos): `[INFERIDA]` marcan si el producto participa en procesos de salida (consume stock en órdenes/ventas) y entrada (compras/ingresos). Semántica fina: OQ-04.
- `documentos.categoria`/`tipo`: campo de texto propio del módulo Archivos, **no** FK a `categorias` (esta última es exclusivamente financiera por el modelo SP). `[INFERIDA]`
- Las tablas `equipos`/`marcas`/`equipos_orden` no tienen módulo propio en SP; su uso se deduce del modelo (§REGLAS: "No omitas ningún módulo, tabla, relación"). Su gestión se asigna a los módulos existentes Clientes y Órdenes de trabajo (RF-014, RF-031) sin crear módulos nuevos. `[INFERIDA]`

---

## 5. Requisitos por módulo

Criterios de aceptación (CA) verificables; "UI en español" aplica a todos por `[CONFIRMADA]` (SP: "Idioma de la interfaz: español"; RNF-U-01). Formato de fechas y moneda según RB-007/RB-008.

### M1 — Autenticación administrativa (SP §AUTENTICACIÓN Y SESIONES)

**RF-001 Login administrativo** `[CONFIRMADA]` — M
El sistema permite el ingreso al panel por **correo electrónico y contraseña**.
- CA1: credenciales válidas de un usuario activo → sesión iniciada y acceso al Panel principal según sus permisos.
- CA2: credenciales inválidas → mensaje de error en español; no se revela si el correo existe (`[RECOMENDADA]`, mensaje genérico).
- CA3: intentos sucesivos: se registran en auditoría (`[RECOMENDADA]`; SP solo exige "registrar acciones relevantes" RB-009).

**RF-002 Almacenamiento seguro de contraseñas** `[CONFIRMADA]` — M
Contraseñas almacenadas con hash seguro (**bcrypt/argon2**); nunca en texto plano.
- CA: no existe ruta alguna (API, logs, UI) que devuelva o exhiba la contraseña en claro; columna `contraseña` solo guarda hash. En Supabase: Supabase Auth gestiona el hash (equivalente seguro; RNF-S-01).

**RF-003 Sesión persistente con expiración** `[CONFIRMADA]` — M
La sesión sobrevive recargas y expira por tiempo.
- CA1: al reabrir el navegador dentro de la vigencia, el usuario permanece autenticado.
- CA2: expirada la sesión, cualquier acción exige re-login; las rutas privadas no son accesibles (RNF-S-06).
- CA3: vigencia concreta del token → parámetro de diseño (`[INFERIDA]`; RNF-S-08 sugiere 24 h).

**RF-004 Cerrar sesión** `[CONFIRMADA]` — M
Acción explícita "Cerrar sesión" disponible en el panel; invalida la sesión server-side.

**RF-005 Registro de sesiones en base de datos** `[CONFIRMADA — tabla sesiones]` — S
SP exige tabla `sesiones` de base de datos. `[INFERIDA]` implementación más simple y consistente en Supabase: Auth de Supabase emite/gestiona los tokens JWT y la tabla `sesiones` (o vista propia equivalente) registra las sesiones activas del sistema para control/cierre. No se construye un sistema propio de tokens. Criterio: existe una tabla/mecanismo persistido que relaciona usuario con sesión activa y su expiración. Riesgo: cómo se materializa sin duplicar Supabase Auth → OQ-06 (bajo).

**RF-006 Control de acceso por permisos** `[CONFIRMADA]` — M
El acceso a cada módulo/acción se determina por el grupo de permisos del usuario (códigos; RF-060).
- CA: usuario sin código `v< Módulo>` no ve el módulo en el menú (RF-009) y la acción es rechazada también a nivel de datos (RLS, RNF-S-02); no basta ocultar en UI.

### M2 — Panel principal (SP §FUNCIONALIDADES 1)

**RF-007 Resumen operativo** `[CONFIRMADA]` — M
El panel muestra: (a) órdenes abiertas, (b) productos con stock bajo, (c) últimas ventas, (d) movimientos pendientes.
- CA1: cada bloque se calcula desde las tablas del modelo (órdenes por estado, `stock < stock_minimo`, ventas por fecha, movimientos con `pagado = false`). `[INFERIDA]` definición exacta de cada métrica derivada del modelo; RB-002 marca umbral de stock.
- CA2: "órdenes abiertas" `[INFERIDA]` = estados {Abierta, En Proceso, Aguardando Piezas} (y opcionalmente Presupuesto como bloque aparte); decisión de etiqueta visual corresponde a diseño, el dato debe estar visible.

**RF-008 Accesos rápidos a módulos** `[CONFIRMADA]` — M
Enlaces/botones desde el panel a los módulos permitidos del usuario.

**RF-009 Usuario conectado y menú según permisos** `[CONFIRMADA]` — M
Se muestra el usuario autenticado (nombre) y el menú lateral/superior contiene solo los módulos/acciones autorizados por sus códigos.
- CA: verificación cruzada UI↔RLS para un usuario con permisos parciales (p. ej. solo `vCliente, vOrden`).

### M3 — Clientes (SP §FUNCIONALIDADES 2)

**RF-010 CRUD de clientes** `[CONFIRMADA]` — M
Crear, editar, eliminar y visualizar clientes con todos los campos SP §clientes.
- CA1: alta registra `fecha_registro` automática. `[INFERIDA]` (columna existe y SP no indica edición manual).
- CA2: la eliminación está restringida por integridad referencial (RB-022): cliente con órdenes/ventas/movimientos/equipos asociados no puede eliminarse; mensaje claro en español. `[INFERIDA]` política más simple consistente con el modelo (SP dice "eliminar" sin excepciones; FKs lo condicionan). OQ-03.

**RF-011 Búsqueda por nombre / documento / correo** `[CONFIRMADA]` — M
- CA: los tres criterios buscan de forma parcial (insensible a mayúsculas `[RECOMENDADA]`); resultado < 2 s con datos de producción típicos (RNF-P-01).

**RF-012 Paginación de listados** `[CONFIRMADA]` — M
El listado de clientes (y todo listado del sistema, RNF-U-03) está paginado.

**RF-013 Vinculación del cliente con órdenes, ventas, financiero y garantías** `[CONFIRMADA]` — M
La ficha del cliente permite ver sus órdenes de trabajo, ventas, movimientos financieros y garantías asociadas.
- CA: navegación desde el cliente a cada listado filtrado por `cliente_id`. Las "garantías asociadas" se obtienen vía `ordenes_trabajo.garantia_id` `[INFERIDA]` (tabla garantias no tiene FK a cliente en SP).

**RF-014 Equipos del cliente** `[INFERIDA — deducida del modelo SP: equipos.cliente_id]` — S
Registrar y visualizar los equipos del cliente (marca, modelo, número de serie, color, tensión, potencia, voltaje, fecha de fabricación, descripción), incluida la creación en línea de marcas nuevas (catálogo `marcas` con estado).
- CA: cada equipo pertenece a un cliente; las marcas activas alimentan el autocompletado del formulario. Sin módulo propio (no se agregan módulos; SP prohíbe improvisar). Ver OQ-02 (forma de gestión aceptada).

### M4 — Productos (SP §FUNCIONALIDADES 3)

**RF-015 CRUD de productos** `[CONFIRMADA]` — M
Crear, editar, eliminar y visualizar productos con campos SP §productos: descripción, unidad, precio_compra, precio_venta, stock, stock_minimo, salida, entrada.
- CA: importes con 2 decimales (RB-008); `stock ≥ 0` (RB-020); eliminación condicionada por RB-022 (`[INFERIDA]`).

**RF-016 Alerta de stock bajo** `[CONFIRMADA]` — M
Producto con `stock < stock_minimo` es señalado en el listado de productos y en el Panel principal (RF-007).
- CA: la alerta es visible (badge/filtro "stock bajo"); no bloquea operaciones (SP no lo exige).

**RF-017 Descuento de stock al agregar producto a orden o venta** `[CONFIRMADA]` — M
Cuando se agrega un producto con cantidad N a `productos_orden` (orden) o `items_venta` (venta), `productos.stock` disminuye en N.
- CA1: el descuento ocurre al guardar la línea (transacción con la escritura, RNF-A-01).
- CA2: si N excede el stock disponible → `[INFERIDA]` SP no define el comportamiento; opción más simple y consistente: advertir y permitir (el estado "Aguardando Piezas" existe para faltantes) **o** bloquear. Decisión: **advertir sin bloquear** por defecto (coherente con RB-020 ≥ 0 al momento de la operación real y con el estado Aguardando Piezas); requiere validación AG-001 → OQ-01. Verificación: prueba automatizada de invariante `stock_final = stock_inicial − Σ salidas + Σ entradas`.

**RF-018 Incremento de stock al eliminar producto de orden o venta** `[CONFIRMADA]` — M
Al quitar una línea de `productos_orden`/`items_venta`, el stock incrementa la cantidad previamente descontada.
- CA: editar la cantidad ajusta la diferencia (invariante del criterio RF-017 CA2). Probable también al eliminar orden/venta completa: `[INFERIDA]` SP solo dice "al eliminar producto de una orden o venta"; se aplica además a la eliminación del documento padre para conservar la invariante (RB-002).

### M5 — Servicios (SP §FUNCIONALIDADES 4)

**RF-019 CRUD de servicios** `[CONFIRMADA]` — M
Crear, editar, eliminar y visualizar servicios: nombre, descripción, precio.
- CA: precio con 2 decimales (RB-008); sin gestión de stock (SP no lo asigna a servicios); eliminación condicionada por RB-022 `[INFERIDA]`.

### M6 — Órdenes de trabajo (SP §FUNCIONALIDADES 5)

**RF-020 CRUD de órdenes** `[CONFIRMADA]` — M
Crear, editar, eliminar y visualizar órdenes con: `fecha_inicial`, `fecha_final`, `garantia`, `descripcion_producto`, `defecto`, `estado`, `observaciones`, `laudo_tecnico`, `valor_total`, cliente (`cliente_id`), usuario/técnico (`usuario_id`), `lanzamiento_id`, `facturado`, `garantia_id`.
- CA1: alta requiere cliente y usuario (técnico/vendedor) seleccionados; `fecha_inicial` automática al crear `[INFERIDA]`.
- CA2: eliminación condicionada a RB-022 (líneas y anexos asociados) `[INFERIDA]`; `[RECOMENDADA]` prohibir eliminar una orden ya facturada (debe tratarse vía financiero), sin base en SP → se deja como recomendación validable.

**RF-021 Ciclo de estados de la orden** `[CONFIRMADA]` — M
Estados exactos (SP): **Presupuesto, Abierta, En Proceso, Finalizado, Cancelado, Aguardando Piezas**. No se agregan ni renombran estados.
- CA1: el selector de estado ofrece solo estos 6.
- CA2: `[INFERIDA]` SP no define transiciones; la implementación más simple: cualquier cambio directo entre los 6 estados, con registro en auditoría (RB-009). **No** se agrega máquina de estados restrictiva sin autorización.
- CA3: pasar a **Finalizado** registra/conserva `fecha_final` `[INFERIDA]` (campo existe para eso; SP no lo especifica).
- CA4: **Presupuesto** puede convertirse en orden activa editando su estado (mismo registro) `[INFERIDA]` — no se crea un documento de presupuesto separado (no existe tabla).

**RF-022 Productos en la orden** `[CONFIRMADA]` — M
Agregar/quitar productos de la orden con `cantidad`, `precio` y `subtotal` por línea (`productos_orden`), afectando stock (RF-017/018).
- CA: `subtotal = cantidad × precio` (RB-017); la línea guarda `descripcion` y `precio` copiados del catálogo al agregar (`[INFERIDA]` snapshot, RB-021: cambiar el catálogo no recalcula líneas existentes).

**RF-023 Servicios en la orden** `[CONFIRMADA]` — M
Agregar/quitar servicios con `servicio` (texto), `cantidad`, `precio`, `subtotal` (`servicios_orden`).
- CA: sin afectación de stock (SP solo lo indica para productos).

**RF-024 Cálculo de valor total** `[CONFIRMADA]` — M
`ordenes_trabajo.valor_total` = Σ subtotales de productos + Σ subtotales de servicios de la orden (RB-018).
- CA: recalculado por el backend al modificar líneas; la UI muestra el total en vivo.

**RF-025 Adjuntos (anexos) de la orden** `[CONFIRMADA]` — M
Adjuntar archivos a la orden almacenando `anexo` (nombre), `miniatura`, `url`, `ruta` (`anexos`), con `orden_id`.
- CA: miniatura visible en la ficha; archivo servido desde Supabase Storage (URL + ruta persistidas); descarga visual disponible. `[INFERIDA]` formato/tamaño de miniatura: decisión de diseño.

**RF-026 Enviar orden por correo al cliente** `[CONFIRMADA]` — M
Acción "Enviar por correo" en la orden que encola un email dirigido al `correo` del cliente de la orden (crea registro en `cola_emails`, RF-070).
- CA: destinatario autocompletado desde `clientes.correo`, editable antes de enviar `[INFERIDA]`; contenido del mensaje = orden impresa/resumen `[INFERIDA]` (SP no especifica plantilla; mantener simple y consistente).

**RF-027 Imprimir orden** `[CONFIRMADA]` — M
Vista de impresión (o PDF, RNF-P-04) de la orden con sus datos, líneas, cliente y empresa (RB-005).

**RF-028 Facturar orden** `[CONFIRMADA]` — M
Al facturar: se crea un `movimientos_financieros` (tipo ingreso), se enlaza en `ordenes_trabajo.lanzamiento_id` y `facturado = true`. **Una orden puede facturarse una sola vez** (RB-003).
- CA1: segundo intento → rechazado con mensaje «La orden ya fue facturada.» (RB-003).
- CA2: el movimiento refleja `valor_total` de la orden, fecha de vencimiento/pago iniciales, cliente y forma de pago `[INFERIDA]` datos tomados del formulario de facturación (SP no especifica los campos preseleccionados; mínimo: descripción + valor + cliente; vencimiento configurable).
- CA3: desfacturar: `[INFERIDA]` SP no lo contempla → **no se implementa** (no inventar procesos); corrección manual vía Financiero.

**RF-029 Autocompletado en órdenes** `[CONFIRMADA]` — M
Formulario de orden con autocompletado de clientes, productos, servicios, usuarios y términos de garantía.
- CA: búsqueda por prefijo/parcial en los 5 conjuntos; selección rellena precio/nombre desde el catálogo (snapshot RB-021 para líneas).

**RF-030 Control de stock al agregar/eliminar productos de la orden** `[CONFIRMADA]` — M
Reafirma RF-017/018 en el contexto específico del módulo de órdenes.
- CA: tras agregar/quitar líneas, `productos.stock` y los avisos de stock bajo (RF-016) quedan consistentes en la misma transacción (RNF-A-01).

**RF-031 Equipos en la orden** `[INFERIDA — deducida del modelo SP: equipos_orden]` — S
Asociar a la orden uno o varios equipos del cliente, registrando `defecto_declarado`, `defecto_encontrado` y `solucion` por equipo.
- CA: listado de equipos filtrado por el cliente de la orden; las líneas `equipos_orden` se rigen por la misma política de eliminación definida para la orden (RF-020 CA2 / RB-022 / OQ-03). Ver OQ-02.

### M7 — Ventas (SP §FUNCIONALIDADES 6)

**RF-032 CRUD de ventas** `[CONFIRMADA]` — M
Crear, editar, eliminar y visualizar ventas: `fecha_venta`, `valor_total`, `descuento`, `facturado`, cliente, usuario.
- CA: fecha y usuario por defecto en alta `[INFERIDA]`; eliminación condicionada (líneas/stock facturado; RB-022; `[RECOMENDADA]` bloquear eliminar venta facturada).

**RF-033 Productos en la venta** `[CONFIRMADA]` — M
Agregar/quitar productos con `cantidad`, `precio`, `subtotal` (`items_venta`) con efecto de stock (RF-017/018, RB-002).
- CA: solo productos (SP no incluye servicios en ventas).

**RF-034 Descuento y valor total de la venta** `[CONFIRMADA]` — M
`valor_total = Σ subtotales de items_venta − descuento`, con `valor_total ≥ 0` (RB-019).
- CA: descuento ≥ 0; exceso sobre el subtotal → rechazado con mensaje `[INFERIDA]` (invariante de negocio P-consistencia; SP lo implica al definir ambos campos).

**RF-035 Facturar venta** `[CONFIRMADA]` — M
Análogo a RF-028: **una sola vez**; crea `movimientos_financieros` (ingreso), enlaza `ventas.lanzamiento_id` **y** `movimientos_financieros.venta_id`, marca `facturado = true` (RB-004).
- CA: doble facturación rechazada; movimiento con valor = `valor_total` de la venta; cliente y forma de pago del formulario.

**RF-036 Imprimir venta** `[CONFIRMADA]` — M
Vista de impresión/PDF de la venta (RB-005, formato SP: encabezado empresa, datos tabulados).

**RF-037 Control de stock en ventas** `[CONFIRMADA]` — M
Reafirma RF-017/018 para el módulo Ventas (mismo invariante que Órdenes).

### M8 — Garantías (SP §FUNCIONALIDADES 7)

**RF-038 CRUD de términos de garantía** `[CONFIRMADA]` — M
Crear, editar, eliminar y visualizar términos: `fecha_garantia`, `referencia`, `texto_garantia`, usuario que crea.

**RF-039 Asociación a órdenes** `[CONFIRMADA]` — M
Un término de garantía puede asociarse a órdenes (`ordenes_trabajo.garantia_id`); visible desde la orden y seleccionado vía autocompletado (RF-029).

**RF-040 Impresión** `[CONFIRMADA]` — M
Imprimir el término de garantía (documento PDF con encabezado de empresa, RB-005).

### M9 — Financiero (SP §FUNCIONALIDADES 8)

**RF-041 CRUD de movimientos financieros** `[CONFIRMADA]` — M
Crear, editar, eliminar movimientos con todos los campos SP §movimientos_financieros (descripción, valor, fecha_vencimiento, fecha_pago, pagado, cliente_proveedor, forma_pago, tipo, anexo, FKs opcionales).
- CA: `tipo ∈ {ingreso, egreso}`; `valor > 0` con 2 decimales; marcar `pagado = true` exige/registra `fecha_pago` `[INFERIDA]` (campos existentes en SP, relación condicionada no especificada → regla RB-014).

**RF-042 Vinculaciones del movimiento** `[CONFIRMADA]` — M
El movimiento puede vincular cliente (`cliente_id`), categoría (`categoria_id`), cuenta (`cuenta_id`) y venta (`venta_id`); los movimientos generados por facturación quedan vinculados además desde `ordenes_trabajo.lanzamiento_id`/`ventas.lanzamiento_id`.
- CA: `cliente_proveedor` como texto libre (SP lo define así, no como FK) convive con el vínculo opcional a `clientes` `[INFERIDA]` lectura: ambos visibles.

**RF-043 Filtros por período** `[CONFIRMADA]` — M
Filtrar movimientos por: **día, semana, mes, año, todos** (sobre fecha de vencimiento/pago `[INFERIDA]`: el período aplica a la fecha relevante del listado; default `fecha_vencimiento`; validable en diseño).

**RF-044 Filtros por situación** `[CONFIRMADA]` — M
Filtros: **todos, previsto, atrasado, realizado, pendiente**, con mapeo inferido (RB-026): realizado = pagado; atrasado = pendiente vencido (fecha_vencimiento < hoy); previsto = pendiente futuro; pendiente = pendiente vigente/para display consolidado. Tabla RB-025/026 fija el detalle.

**RF-045 Totales por período** `[CONFIRMADA]` — M
Con el filtro aplicado, el sistema muestra totales: sumas de ingresos y egresos y saldo del período (desglose `[INFERIDA]`: por tipo; es la definición mínima de "totales por período").

**RF-046 Detección de vencidos** `[CONFIRMADA]` — M
Los movimientos no pagados con fecha de vencimiento anterior a hoy se señalan como vencidos/atrasados (RF-044) en el listado y en Panel (RF-007 "movimientos pendientes").

**RF-047 Categorías y cuentas** `[INFERIDA — deducidas del modelo SP: categorias, cuentas]` — S
Mantenimiento (alta/edición/estado activo-inactivo) de categorías financieras (`categoria`, `tipo`, `estado`) y cuentas (`cuenta`, `banco`, `numero`, `saldo`, `tipo`, `estado`) como sub-listados del módulo Financiero (no se agregan módulos nuevos).
- CA: el selector de categoría/cuenta al crear un movimiento solo ofrece registros activos y de `tipo` coincidente con el movimiento `[INFERIDA]` RB-016.

**RF-048 Anexo del movimiento** `[CONFIRMADA — campo anexo]` — S
Adjuntar comprobante (`movimientos_financieros.anexo`) con la misma mecánica de archivos que RF-025. `[INFERIDA]` almacenamiento (Storage) consistente.

### M10 — Archivos/Documentos (SP §FUNCIONALIDADES 9)

**RF-049 CRUD de documentos** `[CONFIRMADA]` — M
Crear, editar, eliminar y visualizar documentos del módulo (tabla `documentos`: documento, descripcion, archivo, ruta, url, fecha_registro, categoria, tipo, tamaño).

**RF-050 Carga de archivos** `[CONFIRMADA]` — M
Subida del archivo físico (Supabase Storage) que alimenta `archivo`, `ruta`, `url`; `fecha_registro` y `tamaño` automáticos `[INFERIDA]` (campos existen; generación automática es la inferencia más simple).

**RF-051 Metadatos** `[CONFIRMADA]` — M
Captura/editar nombre, descripción, categoría, tipo. `[INFERIDA]` `categoria`/`tipo` como texto o vocabulario administrable dentro del propio módulo (no hay tabla; no crear una nueva sin autorización → OQ-02).

**RF-052 Descarga** `[CONFIRMADA]` — M
Descarga del archivo desde el listado/ficha, respetando permisos (`vArchivo`/`aArchivo`).

**RF-053 Organización por categoría** `[CONFIRMADA]` — M
Listado agrupado/filtrable por `categoria`.

### M11 — Usuarios (SP §FUNCIONALIDADES 10)

**RF-054 CRUD de usuarios** `[CONFIRMADA]` — M
Crear, editar, eliminar y visualizar usuarios con campos SP §usuarios (nombre, rg, cpf, dirección completa, correo, contraseña, teléfono, celular, estado, fecha_registro, permiso_id, fecha_expiracion).
- CA: correo usado para login, único `[INFERIDA]` (login por correo lo exige); `fecha_registro` automática; eliminación condicionada (RB-022: órdenes/ventas referencian `usuario_id`).

**RF-055 Contraseña con hash** `[CONFIRMADA]` — M
Toda contraseña de usuario se almacena con hash seguro (RF-002).
- CA: el formulario nunca muestra la contraseña almacenada; el cambio requiere acción explícita.

**RF-056 Estado activo/inactivo** `[CONFIRMADA]` — M
Usuario inactivo no puede iniciar sesión ni ser asignado en nuevos documentos `[INFERIDA]` (lo primero es consecuencia de seguridad, lo segundo la regla simple consistente); sus registros históricos permanecen visibles (RB-022/consistencia).

**RF-057 Fecha de expiración** `[CONFIRMADA — campo]` — S
`fecha_expiracion`: al superarla, el usuario no puede iniciar sesión `[INFERIDA]` (uso más simple y consistente del campo; RB-024).

**RF-058 Asignación de grupo de permisos** `[CONFIRMADA]` — M
Todo usuario referencia un `permisos` activo; cambiar el grupo cambia su menú y accesos sin editar roles adicionales (no existe segundo mecanismo).

### M12 — Permisos (SP §FUNCIONALIDADES 11)

**RF-059 CRUD de grupos de permisos** `[CONFIRMADA]` — M
Crear, editar, **desactivar** grupos (estado) y visualizar; campos `nombre`, `permisos`, `estado`, `fecha` (fecha de registro/última edición `[INFERIDA]`).
- CA: no se describe "eliminar" para grupos en SP (solo "desactivar") → la eliminación física no se ofrece si existen usuarios vinculados; mantener desactivación como operación de baja (RB-022/RB-023) `[INFERIDA]`.

**RF-060 Códigos de actividad por módulo** `[CONFIRMADA]` — M
Vocabulario exacto SP: actividades **a = agregar, e = editar, d = eliminar, v = visualizar, r = reporte, c = configuración**. Módulos cubiertos (14, SP textual): **Cliente, Producto, Servicio, Orden, Venta, Garantía, Movimiento, Archivo, Usuario, Permiso, Respaldo, Auditoría, Email, Empresa**.
- CA1: códigos formados como `<actividad><Módulo>` (ejemplos SP: `aCliente`, `eCliente`, `dCliente`, `vCliente`, `rCliente`, `aProducto`, etc.).
- CA2: el editor del grupo permite marcar/desmarcar cada código.
- CA3: `Respaldo` y `Empresa` aparecen en SP sin módulo funcional dedicado (empresa = M17, respaldo = sin módulo). `[INFERIDA]` `cRespaldo`/`aRespaldo` etc. se presentan como códigos disponibles; su efecto concreto (p. ej. generar respaldos) no está definido → OQ-06 y nota §8; **no se inventa** una pantalla de respaldo funcional. Recomendación: dejar los códigos reservos en el editor sin acción. `[RECOMENDADA]`

**RF-061 Formato de almacenamiento** `[CONFIRMADA]` — M
`permisos.permisos` se almacena como texto con códigos separados por coma **o** JSON (SP permite ambas). 
- CA: la elección es decisión de diseño AG-003 (sugiere JSONB por robustez); la semántica de negocio es idéntica.

### M13 — Informes/Reportes (SP §FUNCIONALIDADES 12)

**RF-062 Familias de reportes** `[CONFIRMADA]` — M
Reportes de: (a) clientes, (b) productos —incluye stock bajo—, (c) servicios, (d) órdenes (con filtros por estado, fecha, cliente), (e) ventas, (f) financieros. No se agregan otras familias `[CONFIRMADA: "sin agregar funcionalidades"]`.

**RF-063 Versión rápida y personalizada** `[CONFIRMADA]` — M
Cada reporte ofrece: versión **rápida** (todos los registros) y versión **personalizada** (con filtros).

**RF-064 Filtros exigidos** `[CONFIRMADA]` — M
Filtros por: **fecha inicial/final**, **precio inicial/final**, **stock inicial/final** (aplicables donde el reporte tenga esos datos: p. ej. precio/stock en productos; fecha en órdenes/ventas/movimientos `[INFERIDA]` distribución por reporte).

**RF-065 Generación PDF con formato SP** `[CONFIRMADA]` — M
PDF generado con librería compatible (jsPDF o react-pdf) que conserve el mismo contenido y formato de los reportes: **encabezado con datos de la empresa (y logo, RF-082), datos tabulados y paginación** (RB-005).
- CA: el PDF de un listado con 100+ registros muestra encabezado en cada página y totales donde el reporte los tenga `[INFERIDA]` paginación = repetición de encabezado + corte de página.

**RF-066 Descarga / visualización en línea** `[CONFIRMADA]` — M
Cada reporte puede verse en línea (vista previa) y descargarse como PDF.

### M14 — Auditoría (SP §FUNCIONALIDADES 13)

**RF-067 Registro de acciones** `[CONFIRMADA]` — M
Registrar en `logs_auditoria`: `usuario`, `tarea`, `fecha`, `hora`, `ip` por cada acción relevante (RB-009).
- CA1: `[INFERIDA]` conjunto mínimo de "acciones relevantes" (para que sea verificable): login/logout, crear/editar/eliminar de cada módulo transaccional y maestro (órdenes, ventas, movimientos, clientes, productos, servicios, garantías, usuarios, permisos, empresa, documentos), facturar orden/venta, envío de emails desde cola, limpiar logs, cambio de estado de orden. La lista cerrada se valida en diseño.
- CA2: el registro es automático (no confiado a la UI) — `[RECOMENDADA]` vía triggers/RPC; SP solo exige "registrar".

**RF-068 Listar logs** `[CONFIRMADA]` — M
Pantalla de auditoría con listado paginado (RNF-U-03) y filtro por usuario/fecha/tarea `[INFERIDA]` filtros mínimos consistentes.

**RF-069 Limpiar logs** `[CONFIRMADA]` — M
Acción de limpieza de logs (`logs_auditoria`) disponible para quien tenga el código de Auditoría aplicable. 
- CA `[RECOMENDADA]`: la propia limpieza queda registrada antes del borrado y se sugiere descarga previa (SP solo dice "Limpiar logs"; no se agrega aprobaciones).

### M15 — Cola de emails (SP §FUNCIONALIDADES 14)

**RF-070 Creación de emails en cola** `[CONFIRMADA]` — M
Crear emails con `para`, `cc`, `cco`, `mensaje`, `encabezados` → registro `cola_emails` con `estado='pendiente'`, `fecha` automática.
- CA: la acción RF-026 (enviar orden por correo) alimenta esta cola (flujo SP §FUNCIONALIDADES 5+14; `[INFERIDA]` el vínculo es la única vía explícita en SP por la que un módulo de negocio encola emails; otras integraciones **no se agregan**).

**RF-071 Estados de email** `[CONFIRMADA]` — M
Estados exactos: **pendiente, enviando, enviado, fallido**.

**RF-072 Procesar cola** `[CONFIRMADA]` — M
Proceso que toma emails `pendiente` → `enviando` → `enviado`/`fallido` según resultado del proveedor de envío.
- CA `[INFERIDA]`: procesamiento asíncrono (job/Edge Function) con la marca de transición de estado persistida; el proveedor SMTP concreto no está especificado → OQ-01.

**RF-073 Reintentar fallidos** `[CONFIRMADA]` — M
Reintento de envíos `fallido` (manual desde pantalla y/o automático `[INFERIDA]` automático con tope; SP dice "Reintentar envíos fallidos" sin detalles → lo simple: botón "reintentar" + job que re-encola fallidos un número acotado de veces).

**RF-074 Eliminar emails** `[CONFIRMADA]` — M
Eliminar registros de la cola (típico: ya enviados/fallidos definitivamente).

### M16 — Portal del cliente (SP §FUNCIONALIDADES 15)

**RF-075 Ingreso por correo + documento** `[CONFIRMADA]` — M
Pantalla separada del login administrativo. Si el par (correo, documento) coincide con un cliente registrado → **sesión de cliente**; si no, acceso denegado con mensaje.
- CA1: coincidencia exacta sobre `clientes.correo` + `clientes.documento` (normalización de espacios/mayúsculas `[RECOMENDADA]`).
- CA2: la sesión de cliente otorga acceso **únicamente** al portal (roles separados, RB-032 / RNF-S-03) vía RLS.

**RF-076 Panel con últimas compras y órdenes** `[CONFIRMADA]` — M
Inicio del portal: últimas ventas (compras) y últimas órdenes de trabajo del cliente.

**RF-077 Detalle de orden y compra** `[CONFIRMADA]` — M
Consulta del detalle completo de una orden o una venta propios (líneas, estados, totales).

**RF-078 Imprimir orden/compra** `[CONFIRMADA]` — M
Impresión/PDF desde el portal con el mismo formato de documento (RB-005).

**RF-079 Ver y editar datos de cuenta** `[CONFIRMADA]` — M
El cliente visualiza y puede editar sus datos (`clientes`): teléfono, celular, dirección; etc.
- CA `[INFERIDA]` campos editables: todos los capturables por persona **excepto** `id_cliente`, `documento`, `correo` y `fecha_registro` (editar correo/documento rompería el acceso por credenciales sin flujo adicional definido en SP; SP "Ver y editar datos de cuenta" + prohibición de inventar procesos → la restricción es la inferencia más simple y segura). OQ-05.
- CA: el cliente solo puede leer/escribir **su propio** registro (RLS).

**RF-080 Cerrar sesión (portal)** `[CONFIRMADA]` — M
Acción de cierre de sesión del portal.

### M17 — Configuración de empresa (SP §FUNCIONALIDADES 16)

**RF-081 Crear/editar datos de empresa** `[CONFIRMADA]` — M
Mantenimiento de la tabla `empresa`: nombre, cnpj, ie, calle, numero, barrio, ciudad, provincia, telefono, correo, url_logo.
- CA `[INFERIDA]`: registro único de empresa (el sistema gestiona una sola empresa; SP usa singular en todos sus usos: "los datos de la empresa").

**RF-082 Logo para reportes PDF** `[CONFIRMADA]` — M
Carga/edición de `url_logo`; el logo se incluye en el encabezado de todo PDF de reportes/documentos (RB-005).

---

## 6. Cobertura de "FUNCIONALIDADES POR MÓDULO" (SP) → RF

Verificación punto a punto contra cada viñeta de SP §FUNCIONALIDADES (16 bloques listados allí + autenticación) y §AUTENTICACIÓN Y SESIONES:

| Viñeta SP | RF que la conserva |
|---|---|
| Login correo+contraseña / hash / sesión persistente con expiración / cerrar sesión / control por permisos / portal separado | RF-001, RF-002, RF-003, RF-004, RF-006, RF-005+RF-075 |
| Panel: resumen operativo (4 bloque), accesos rápidos, usuario+menú por permisos | RF-007, RF-008, RF-009 |
| Clientes: CRUD, búsqueda 3 criterios, paginación, vinculación 4 contextos | RF-010, RF-011, RF-012, RF-013 |
| Productos: CRUD, campos compra/venta/unidad/stock/mínimo, alerta stock bajo, descontar/incrementar stock en orden y venta | RF-015, RF-016, RF-017, RF-018 |
| Servicios: CRUD nombre/descripción/precio | RF-019 |
| Órdenes: CRUD, 6 estados, fechas, cliente/técnico/garantía, descripción/defecto/observaciones/laudo, líneas de producto y servicio, total, anexos con miniatura/URL/ruta, enviar por correo, imprimir, facturar, autocompletado ×5, control de stock | RF-020…RF-031 |
| Ventas: CRUD, cliente/usuario/fecha, líneas, descuento y total, facturar, imprimir, stock | RF-032…RF-037 |
| Garantías: CRUD términos, referencia/texto/fecha, asociación a órdenes, impresión | RF-038…RF-040 |
| Financiero: CRUD movimientos, tipo ingreso/egreso, campos, cliente/proveedor/categoría/cuenta/forma pago, anexo, vinculación venta, filtros período ×5, filtros situación ×5, totales por período, vencidos | RF-041…RF-048 |
| Archivos: CRUD, carga, metadatos ×6, descarga, organización por categoría | RF-049…RF-053 |
| Usuarios: CRUD, campos, hash, estado, fecha registro, expiración, asignación de permisos | RF-054…RF-058 |
| Permisos: CRUD/desactivar, campos, códigos a/e/d/v/r/c, 14 módulos cubiertos, ejemplos | RF-059…RF-061 |
| Informes: 6 familias, rápido/personalizado, filtros fecha/precio/stock, PDF con encabezado/tabla/paginación, descarga/visualización | RF-062…RF-066 |
| Auditoría: registrar (usuario/tarea/fecha/hora/ip), listar, limpiar | RF-067…RF-069 |
| Cola emails: crear (para/cc/cco/mensaje/encabezados), 4 estados, procesar, reintentar, eliminar | RF-070…RF-074 |
| Portal: ingreso correo+documento, panel compras/órdenes, detalle, imprimir, cuenta ver/editar, cerrar sesión | RF-075…RF-080 |
| Empresa: crear/editar, campos, logo PDF | RF-081…RF-082 |
| REGLAS DE NEGOCIO SP (8 viñetas) | RB-001…RB-009 (BUSINESS_RULES.md §3, texto conservado) |
| SEGURIDAD SP (6 viñetas) | RB-031…RB-036, RNF-S-01…S-07 |
| ENTREGABLE SP (8 viñetas) | §7 (criterios de aceptación de proyecto) |
| Tablas SP (23) | §4 (modelo exigido) |

**No se omite ningún módulo, tabla, relación, filtro, reporte ni flujo descrito** — ver matriz anterior, línea por línea.

## 7. Criterios de aceptación del entregable completo (SP §ENTREGABLE ESPERADO) `[CONFIRMADA]`

1. Aplicación completa y funcional (todos los módulos navegables).
2. Base de datos con las 23 tablas y todas las relaciones de §4.
3. Datos de ejemplo mínimos para pruebas (seed: al menos empresa, un usuario con grupo "admin" completo, grupos de permisos, catálogo pequeño de clientes/productos/servicios/garantías/categorías/cuentas/marcas). `[INFERIDA]` composición exacta del seed.
4. Todos los módulos navegables (17).
5. Reportes PDF funcionales (RF-062…066).
6. Portal de cliente funcional (RF-075…080).
7. Sistema de permisos funcional (RF-059…061 + RF-006).
8. Auditoría funcional (RF-067…069).

## 8. Preguntas abiertas y escalación

Ninguna brecha es de "necesidad" (SP define el producto completo); las siguientes son brechas de **implementación permitidas por la cláusula de inferencia de SP**, listadas para validación de AG-001/AG-003:

| ID | Pregunta | Clasificación | Impacto | Nivel |
|---|---|---|---|---|
| OQ-01 | Stock insuficiente al agregar producto a orden/venta: ¿se advierte y permite (opción recomendada, coherente con estado "Aguardando Piezas") o se bloquea? Proveedor de email (SMTP/Edge Function) para RF-072. | `[INFERIDA]` / `[PENDIENTE]` | RF-017/018/030/037; M15 | **Medio-alto** — validar antes de código del módulo de stock y cola |
| OQ-02 | Gestión de `equipos`/`marcas` y vocabularios de `documentos.categoria/tipo` se asumen dentro de Clientes/Órdenes/Archivos sin módulo nuevo (SP prohíbe agregarlos). ¿Aceptado? | `[INFERIDA]` | RF-014, RF-031, RF-051 | Medio |
| OQ-03 | Política de eliminación física vs. restricciones FK: SP dice "eliminar" en CRUD de clientes/productos/… sin regla de borrado; se asume RESTRICT (RB-022) y, ¿además borrado lógico (`estado=false`) para maestros? | `[INFERIDA]` | RF-010/015/019/032/038/… | Medio |
| OQ-04 | Semántica exacta de `productos.salida`/`entrada` y `ordenes_trabajo.garantia`. | `[INFERIDA]` | RF-015, RF-020 | Bajo |
| OQ-05 | Portal: ¿puede el cliente editar correo/documento (sus credenciales de acceso)? Se asume no (RF-079). | `[INFERIDA]` | RF-079 | Bajo |
| OQ-06 | Materialización de la tabla `sesiones` junto a Supabase Auth (RF-005) y tratamiento de códigos `Respaldo` (RF-060 CA3) sin inventar funcionalidad. | `[INFERIDA]` | RF-005, RF-060 | Bajo |

**Decisión de continuidad:** el dominio y alcance están totalmente definidos por SP; **no** existe el riesgo de dominio de las v1.x (A-01 automotriz). El pipeline puede continuar hacia diseño de BD/arquitectura; OQ-01 debe resolverse antes de programar stock (módulos Productos/Órdenes/Ventas) y el envío de cola de emails.

## 9. Nota de rebasing (integridad del análisis)

Las versiones 1.0–1.2 de este documento se elaboraron **sin la fuente de verdad** y debían invalidarse porque: (1) inventaron un dominio automotriz (vehículos, placas, citas, cotizaciones, QC) no presente en SP; (2) omitieron u excluyeron módulos obligatorios (Ventas, Garantías, Financiero, Archivos, Permisos por códigos, Informes, Auditoría, Cola de emails, Portal del cliente —esta explícitamente marcada fuera de MVP—, Configuración de empresa); (3) reemplazaron la tabla de estados de orden de SP por otra inventada. Esta v2.0 conserva **íntegramente** los 17 módulos, las 23 tablas y las 8 reglas de negocio + 6 de seguridad de SP, sin agregar módulos ni cambiar nombres. Los supuestos A-01…A-04 y OQ-01…OQ-06 de v1.x quedan **eliminados** como obsoletos y no deben usarse en tareas posteriores.
