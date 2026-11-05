# Historias de Usuario — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0001 — Requirements Analysis |
| Autor | AG-004 Business Analyst |
| Fecha | 2026-11-05 |
| Versión | 1.1 — **BORRADOR PENDIENTE DE VALIDACIÓN** (v1.1: corregida referencia de HU-026 al reporte (c) de HU-037/RF-033; sin cambios de contenido) |
| Estado | Hereda supuestos A-01..A-04 y OQ-01..OQ-06 de `FUNCTIONAL_REQUIREMENTS.md` (§2, §16). Escalado a AG-001 |

---

## 1. Cómo leer este documento

- Formato: **Como** [rol] **quiero** [capacidad] **para** [beneficio], con criterios de aceptación en formato **Dado / Cuando / Entonces** (en español, idioma obligatorio de UI `[CONFIRMADA]`).
- Prioridad MoSCoW: **M** Must (MVP) / **S** Should / **C** Could.
- Clasificación `[CONFIRMADA]` / `[INFERIDA]` / `[RECOMENDADA]` según `FUNCTIONAL_REQUIREMENTS.md` §1. **Ninguna historia de negocio fue declarada explícitamente por el usuario**: todas las de los epics E2–E10 son `[INFERIDA]` del dominio A-01 y herdan el bloqueo de OQ-01/OQ-02.
- Referencias: `RF-xxx` = requisitos funcionales; `RB-xxx` = reglas de negocio (`BUSINESS_RULES.md`); `RNF-xxx` = no funcionales.
- Roles (RF §2.3): **Admin**, **Recepción** (receptor de servicio), **Técnico**. El Cliente no usa el sistema (solo recibe notificaciones, HU-035).

### Definition of Done global (aplica a todas las HU) `[CONFIRMADA por stack + RECOMENDADA]`
1. UI en español, shadcn/ui + Tailwind; TS strict; pasa `tsc --noEmit` + lint (RNF-M-01).
2. Regla RB citada aplicada en capa dura (L2/L3/L4) con test automatizado (RNF-M-02).
3. Permiso según matriz RF §15 verificado por RLS con JWT de rol bajo → 403/0 filas (RNF-S-02).
4. Cumple RNF-P-01/P-02 (tiempos y paginación) en rutas tocadas.
5. Cambio relevante registrado en auditoría RF-036 cuando la historia lo indica.

---

## 2. Épicos y mapa de cobertura

| Epic | Historias | Cubre RF | Prioridad dominante |
|---|---|---|---|
| E1 Acceso e identidad | HU-001..004 | RF-001..004 | M |
| E2 Clientes y vehículos | HU-005..011 | RF-005..010 | M |
| E3 Catálogo | HU-012..013 | RF-011..012 | M/C |
| E4 Agenda | HU-014..016 | RF-013..015 | S |
| E5 Órdenes de trabajo | HU-017..024 | RF-016..021, 029 | M |
| E6 Inventario | HU-025..028 | RF-022..025 | M |
| E7 Cotización y cobro | HU-029..033 | RF-026..029 | M |
| E8 Notificaciones | HU-034..035 | RF-030..031 | S/C |
| E9 Dashboard y reportes | HU-036..038 | RF-032..034 | M/S/C |
| E10 Configuración, auditoría, impresión | HU-039..041 | RF-035..037 | M |

Todo RF-001..RF-037 tiene al menos una historia. FUERA de las historias (igual que RF §3): portal del cliente, pasarelas de pago, multi-sede, contabilidad, factura electrónica (hasta OQ-02), app móvil nativa.

---

## 3. E1 — Acceso e identidad

### HU-001 — Iniciar y cerrar sesión `[CONFIRMADA por stack: Supabase Auth]` — M
**Como** usuario del taller, **quiero** entrar con mi correo y contraseña y salir de forma segura, **para** trabajar con mi identidad y permisos.
- RF: RF-001 · RB: RB-PARAM (`zona_horaria`) · RNF: RNF-S-01/03
1. **Dado** un usuario activo con credenciales válidas, **cuando** las ingreso, **entonces** accedo al dashboard en español y queda registrada la sesión (Supabase).
2. **Dado** credenciales inválidas, **cuando** intento entrar, **entonces** veo «Correo o contraseña incorrectos» sin indicarse cuál falló.
3. **Dado** 30 min de inactividad, **cuando** regreso, **entonces** se exige re-login (RNF-S-03).
4. **Cuando** pulso «Cerrar sesión», **entonces** la sesión queda invalidada y el botón «atrás» del navegador no devuelve datos privados (logout server-side + cache no-store).

### HU-002 — Administrar usuarios internos `[INFERIDA]` — M
**Como** Admin, **quiero** crear, editar, desactivar usuarios y asignarles rol, **para** controlar quién opera el sistema.
- RF: RF-002/003 · RB: RB-008 (los registros históricos permanecen)
1. **Dado** sesión Admin, **cuando** creo un usuario con correo y rol (Recepción/Técnico), **entonces** recibe invitación de Supabase y puede activar su cuenta.
2. **Cuando** desactivo un usuario, **entonces** no puede iniciar sesión pero sus OT/movimientos históricos siguen visibles.
3. **Dado** rol Recepción, **cuando** navego a la pantalla de usuarios, **entonces** no existe (UI) y la API responde 403 (RLS).

### HU-003 — Permisos por rol en toda la aplicación `[INFERIDA]` — M
**Como** Admin, **quiero** que cada acción esté restringida por rol según la matriz de permisos, **para** proteger datos y dinero.
- RF: RF-003 · RB: RB-008/009 · RNF: RNF-S-02 · Matriz: RF §15
1. **Dado** un rol de la matriz con ❌ para una acción, **cuando** su usuario intenta la acción vía API con su JWT, **entonces** recibe 403 o 0 filas (política RLS probada en suite).
2. **Entonces** la UI oculta/deshabilita esos controles coherente con la matriz (verificación cruzada UI↔RLS en QA).

### HU-004 — Recuperar contraseña `[RECOMENDADA]` — S
**Como** usuario, **quiero** restablecer mi contraseña por correo, **para** no depender del Admin.
- RF: RF-004 · 1. **Cuando** solicito recuperación, **entonces** recibo el correo de Supabase y al cambiar la contraseña se cierra la sesión y exige re-login. 2. Token expirado/ya usado → mensaje claro en español.

---

## 4. E2 — Clientes y vehículos `[INFERIDA — dominio A-01, bloqueo OQ-01]`

### HU-005 — Registrar cliente `[INFERIDA]` — M 🚧OQ-01/02
**Como** Recepción, **quiero** registrar clientes con su identificación y contacto, **para** saber a quién atendemos y a quién pertenece cada vehículo.
- RF: RF-005 · RB: RB-001/002
1. **Cuando** guardo un cliente con campos mínimos (tipo ID, número, nombre, teléfono), **entonces** se crea con fecha/usuario de alta (RF-036 si aplica).
2. **Dado** otro cliente con el mismo número (con o sin separadores/mayúsculas), **cuando** guardo, **entonces** se rechaza con el mensaje de RB-001.
3. **Cuando** intento eliminar un cliente, **entonces** solo se desactiva (no se borra) si tiene historial (RB-002).

### HU-006 — Buscar cliente `[INFERIDA]` — M
**Como** Recepción, **quiero** buscar por nombre, identificación o teléfono desde 2 caracteres, **para** localizarlo en segundos en el mostrador.
- RF: RF-005 · RNF: RNF-P-01/02/03 (P95 ≤ 1–2 s), RNF-U-02 (≤ 3 clics)
1. **Cuando** escribo 2+ caracteres, **entonces** veo resultados paginados (≤ 50/hoja) en < 2 s.
2. **Cuando** selecciono un resultado, **entonces** abro su ficha (HU-007).

### HU-007 — Ver historial de un cliente `[INFERIDA]` — S
**Como** Recepción/Admin (Técnico solo lectura), **quiero** ver los vehículos y documentos (OT/cotizaciones/cobros) de un cliente ordenados por fecha, **para** conocer su relación con el taller.
- RF: RF-006 · 1. **Entonces** veo lista paginada con totales y cada ítem enlaza a su detalle. 2. Filtros por rango de fechas funcionales.

### HU-008 — Crear cliente en línea al abrir una OT `[INFERIDA]` — S
**Como** Recepción, **quiero** dar de alta un cliente nuevo sin salir del formulario de OT, **para** no perder el ingreso del vehículo.
- RF: RF-007 · RB: RB-001 · 1. **Cuando** el buscador no encuentra al cliente y pulso «Nuevo», **entonces** se abre el mini-formulario (validaciones idénticas a HU-005) y al guardar, el cliente queda preseleccionado en la OT sin perder datos ya escritos.

### HU-009 — Registrar vehículo de un cliente `[INFERIDA A-01]` — M 🚧OQ-01
**Como** Recepción, **quiero** registrar vehículos (placa, marca, modelo, año, color, VIN opcional) asociados a un cliente, **para** identificar el objeto de trabajo.
- RF: RF-008 · RB: RB-003/014
1. **Cuando** guardo con placa duplicada (en cualquier variante de formato), **entonces** se rechaza con enlace al vehículo existente (RB-003).
2. **Entonces** el vehículo queda vinculado a exactamente un cliente.
3. **Cuando** busco por placa o por cliente, **entonces** lo encuentro en < 2 s.

### HU-010 — Historial de servicio por vehículo `[INFERIDA]` — M 🚧OQ-01
**Como** Recepción/Admin, **quiero** ver la línea de tiempo de OT de un vehículo con repuestos, costos y técnicos, **para** decidir reparaciones y detectar patrones.
- RF: RF-009 · 1. **Entonces** veo OT ordenadas por fecha con totales; filtro por rango de fechas; km registrado por visita si existe.

### HU-011 — Ficha de ingreso del vehículo `[INFERIDA]` — S 🚧OQ-01
**Como** Recepción, **quiero** capturar km, nivel de combustible y fotos de daños al abrir la OT, **para** dejar evidencia del estado de entrada.
- RF: RF-010 · RB: RB-PARAM (`capturar_estado_entrada`) · RNF-P-04
1. **Dado** `capturar_estado_entrada = true`, **cuando** guardo la OT, **entonces** km y estado son obligatorios (con mensaje claro si faltan).
2. **Cuando** adjunto una imagen > 5 MB, **entonces** se rechaza con el límite indicado; máximo 10 por OT (RNF-P-04).
3. **Entonces** las fotos se ven en el detalle de la OT con carga diferida.

---

## 5. E3 — Catálogo de servicios `[INFERIDA]`

### HU-012 — Gestionar servicios/mano de obra `[INFERIDA]` — M
**Como** Admin, **quiero** mantener el catálogo de servicios (código, nombre, duración estimada, precio), **para** estandarizar precios y tiempos.
- RF: RF-011 · RB: RB-010
1. **Cuando** guardo un código duplicado, **entonces** se rechaza (unique).
2. **Cuando** desactivo un servicio, **entonces** no aparece en OT nuevas pero sigue visible en documentos históricos (snapshot RB-010).
3. **Cuando** edito el precio, **entonces** OT/documents existentes no cambian; solo los nuevos usan el precio nuevo.

### HU-013 — Categorizar servicios `[INFERIDA]` — C
**Como** Admin, **quiero** agrupar servicios por categoría, **para** reportar por tipo de trabajo.
- RF: RF-012 · 1. **Cuando** intento eliminar una categoría con servicios en uso, **entonces** solo se permite desactivarla.

---

## 6. E4 — Agenda / Citas `[INFERIDA]`

### HU-014 — Programar cita `[INFERIDA]` — S
**Como** Recepción, **quiero** agendar el ingreso de un vehículo (fecha/hora, cliente, vehículo, motivo, técnico opcional), **para** organizar el flujo del taller.
- RF: RF-013 · RB: RB-011/012, RB-PARAM (`horario_habil`)
1. **Cuando** elijo una hora fuera del horario hábil, **entonces** el selector lo impide (L1) y el RPC lo rechaza (L4).
2. **Dado** el vehículo ya tiene cita superpuesta, **cuando** guardo, **entonces** veo aviso de RB-011 y puedo continuar.
3. **Cuando** guardo, **entonces** la cita queda `Programada`.

### HU-015 — Ver calendario y reprogramar `[INFERIDA]` — S
**Como** Recepción, **quiero** un calendario día/semana con citas y OT activas por color de estado, **para** visualizar la carga del taller.
- RF: RF-014/015 · RB: RB-012 · RNF-P-01 (carga < 2 s)
1. **Entonces** veo citas + OT del rango con código de color por estado y leyenda.
2. **Cuando** arrastro o uso «Reprogramar», **entonces** cambio fecha/hora conservando estado y con auditoría del cambio.
3. **Cuando** marco `No_Show`, **entonces** queda registrado (job nocturno hace lo mismo con citas vencidas, RB-012).

### HU-016 — Convertir cita en OT `[INFERIDA]` — S
**Como** Recepción, **quiero** que una cita atendida genere su OT en un clic, **para** no reescribir datos.
- RF: RF-013/015 · RB: RB-004/011/012
1. **Cuando** pulso «Crear OT» en la cita, **entonces** se abre el formulario de OT (HU-017) con cliente/vehículo/motivo precargados y la cita pasa a `Atendida` ligada a la OT.
2. **Dado** el vehículo tiene otra OT activa, **cuando** intento convertir, **entonces** se bloquea con enlace (RB-004).

---

## 7. E5 — Órdenes de Trabajo `[INFERIDA — núcleo]`

### HU-017 — Crear una OT `[INFERIDA]` — M
**Como** Recepción, **quiero** crear la OT del vehículo que ingresa, **para** dejar constancia del trabajo solicitado.
- RF: RF-016 · RB: RB-004/013/014 · HU-008 (cliente en línea)
1. **Cuando** guardo con cliente+vehículo válidos, **entonces** la OT nace con correlativo RB-013, estado `Abierta`, fecha/hora local y síntomas del cliente.
2. **Dado** el vehículo con OT activa, **cuando** guardo, **entonces** se bloquea y se ofrece ver la existente (RB-004).
3. **Entonces** todo cambio queda en bitácora (RF-036).

### HU-018 — Hacer avanzar el estado de la OT `[INFERIDA]` — M
**Como** Recepción/Técnico, **quiero** mover la OT por el flujo (en proceso, repuestos, QC, lista, entregada/cancelada), **para** reflejar la realidad del taller.
- RF: RF-017 · RB: RB-005
1. **Entonces** solo veo acciones de estado válidas desde el estado actual (matriz RB-005).
2. **Cuando** intento una transición inválida vía API, **entonces** el RPC la rechaza con mensaje de RB-005.
3. **Cuando** cancelo, **entonces** motivo ≥ 10 caracteres obligatorio y se liberan reservas (RB-006).
4. **Entonces** cada transición registra usuario + timestamp en auditoría.

### HU-019 — Agregar servicios y repuestos con totales en vivo `[INFERIDA]` — M
**Como** Recepción, **quiero** componer las líneas de la OT (servicios del catálogo, repuestos del inventario, descuentos), **para** calcular el costo del trabajo.
- RF: RF-018 · RB: RB-009/010/015/017
1. **Cuando** agrego un servicio, **entonces** se copia su precio actual como snapshot (RB-010) y el total se recalcula en pantalla (subtotal servicios + repuestos − descuento + impuesto).
2. **Cuando** agrego un repuesto con precio 0, **entonces** debo fijar precio de línea (RB-017).
3. **Cuando** descuento excede el subtotal, **entonces** se rechaza (RB-015).

### HU-020 — Asignar OT a técnicos `[INFERIDA]` — M
**Como** Recepción/Admin, **quiero** asignar una OT a uno o varios técnicos, **para** repartir el trabajo.
- RF: RF-019 · RB: RB-009 · RNF-S-02
1. **Cuando** asigno, **entonces** el/los técnicos ven esa OT en su listado y nada más (RLS).
2. **Cuando** retiro una asignación con horas ya registradas, **entonces** las horas quedan auditadas y se notifica internamente (RF-030).

### HU-021 — Técnico: reportar avance y horas `[INFERIDA]` — M
**Como** Técnico, **quiero** registrar horas por línea y notas de avance en mis OT, **para** dejar evidencia del trabajo y solicitar repuestos.
- RF: RF-019 · RB: RB-005/007/009 · OQ-06 🚧
1. **Dado** OT asignada `Abierta`, **cuando** marco «Iniciar», **entonces** pasa a `En_proceso` (permitido al técnico).
2. **Cuando** registro 0,5 h en una línea, **entonces** se guarda (paso 0,1 h); −0,1 o 1000 → rechazado (RB-009).
3. **Cuando** solicito un repuesto sin stock suficiente, **entonces** veo el mensaje de RB-007 y la OT puede quedar `Esperando_repuestos`.

### HU-022 — Reservar repuestos para una OT `[INFERIDA]` — S
**Como** Recepción, **quiero** reservar repuestos existentes para una OT sin consumarlos, **para** asegurar insumos de trabajos programados.
- RF: RF-020 · RB: RB-006
1. **Cuando** reservo más que disponible, **entonces** se rechaza con números (RB-006).
2. **Cuando** la OT llega a `Entregada`/`Cancelada`, **entonces** las reservas se liberan/consumen según corresponda (RB-005).

### HU-023 — Entregar la OT y emitir el cobro `[INFERIDA]` — M
**Como** Recepción, **quiero** entregar la OT registrando km de salida, forma de pago e imprimir la orden, **para** cerrar el servicio con documento.
- RF: RF-021/037 · RB: RB-005/016/018 · RNF-C-02
1. **Dado** OT en `Lista_entrega` con total > 0, **cuando** entrego, **entonces** (transacción única, RNF-A-02): estado `Entregada`, km/firma capturados, **se genera el documento de cobro** (HU-031) y se consumen salidas de stock.
2. **Cuando** total = 0 sin justificación, **entonces** se bloquea hasta escribirla (RB-016).
3. **Entonces** el documento OT-… incluye datos del taller (RF-035) y puede imprimirse/PDF.
4. **Cuando** intento entregar dos veces, **entonces** la segunda falla (RB-018/RLS).

### HU-024 — Anular una OT/documents entregados `[INFERIDA]` — S
**Como** Admin, **quiero** anular un cobro/OT entregada con motivo y documento negativo, **para** corregir sin destruir el rastro.
- RF: RF-029 · RB: RB-008/018 · 1. **Dado** Recepción, **cuando** llama la API de anulación, **entonces** 403 (solo Admin). 2. **Cuando** anulo, **entonces** aparece nota negativa vinculada, la OT vuelve a editable (RB-018) y el original permanece `Anulado` con su pago como referencia de devolución (RB-019).

---

## 8. E6 — Inventario `[INFERIDA]`

### HU-025 — Registrar repuestos `[INFERIDA]` — M
**Como** Admin/Recepción, **quiero** dar de alta repuestos (SKU, nombre, precios, stock inicial, mínimo, ubicación), **para** controlar los insumos.
- RF: RF-022 · RB: RB-017 · 1. SKU duplicado → rechazado. 2. Cantidades/precios < 0 → rechazados. 3. Alta con stock inicial > 0 crea un movimiento `ajuste` (motivo «alta inicial») auditado (RB-007).

### HU-026 — Registrar compra/entrada de mercancía `[INFERIDA]` — S
**Como** Recepción, **quiero** registrar entradas de compra (proveedor, costo unitario, cantidad), **para** mantener existencias y el costo promedio.
- RF: RF-025 · RB: RB-007 · 1. **Cuando** guardo, **entonces** existe movimiento `entrada_compra`, stock sube y el costo promedio ponderado se recalcula (visible en HU-037, reporte (c) de RF-033).

### HU-027 — Ajustar inventario con trazabilidad `[INFERIDA]` — M
**Como** Admin/Recepción, **quiero** ajustar existencias (mala, extraviado, conteo) con motivo, **para** conciliar stock físico sin perder evidencia.
- RF: RF-023 · RB: RB-007 · 1. Ajuste sin motivo → rechazado. 2. Ajuste que dé stock negativo → rechazado con valor disponible. 3. **Entonces** `stock = Σ movimientos` se mantiene (test de propiedad).

### HU-028 — Alerta de stock mínimo `[INFERIDA]` — S
**Como** Recepción/Admin, **quiero** ver repuestos con disponible < mínimo en el dashboard y al usarlos en OT, **para** reabastecer a tiempo.
- RF: RF-024 · RB: RB-006/007 · RNF: dashboard ≤ 60 s de frescura (RF-032) · 1. Tras un movimiento que cruza el umbral, la alerta aparece en ≤ 5 s; no bloquea operaciones salvo violación de RB-007.

---

## 9. E7 — Cotizaciones y cobro `[INFERIDA — no fiscal, OQ-02]`

### HU-029 — Crear cotización `[INFERIDA]` — M 🚧OQ-02
**Como** Recepción, **quiero** cotizar servicios+repuestos desde una OT o suelta, **para** informar el costo antes de trabajar.
- RF: RF-026 · RB: RB-010/013/020 · 1. **Entonces** la cotización nace `Vigente`, correlativo RB-013, con snapshot de precios y vencimiento por RB-PARAM. 2. **Cuando** vence la fecha, **entonces** queda `Expirada` y no es aprobable (RB-020).

### HU-030 — Aprobar cotización → OT `[INFERIDA]` — M
**Como** Recepción, **quiero** aprobar una cotización y convertirla en OT en un clic, **para** arrancar el trabajo aprobado.
- RF: RF-026 · RB: RB-004/010/020 · 1. Aprobar → OT `Abierta` que hereda líneas/snapshots; la cotización queda `Aprobada` vinculada. 2. Si el vehículo tiene OT activa, se ofrece adjuntar líneas a la OT existente en vez de crear una nueva. 3. Rechazar requiere motivo.

### HU-031 — Documento de cobro con impuestos `[INFERIDA]` — M 🚧OQ-02
**Como** Recepción, **quiero** que al entregar se emita el documento de cobro con subtotal/descuento/impuesto/total, **para** cobrar de forma consistente.
- RF: RF-027 · RB: RB-013/018/010, RB-PARAM (`tasa_impuesto`) · 1. **Entonces** el total se recalcula con P-03 y el documento imprime pie «documento no válido fiscalmente» mientras OQ-02 siga abierto. 2. Ver HU-023 criterio 1: el documento nace en la misma transacción de entrega (RNF-A-02).

### HU-032 — Registrar pagos/abonos `[INFERIDA]` — S 🚧OQ-03
**Como** Recepción, **quiero** registrar abonos (efectivo/tarjeta/transferencia como referencia manual) sobre un documento, **para** controlar la cartera.
- RF: RF-028 · RB: RB-019 · 1. Monto ≤ saldo, o se rechaza mostrando saldo. 2. Saldo 0 → documento `Pagado` con recibo imprimible. 3. No hay cobro por pasarela en MVP (OQ-03).

### HU-033 — Anular cotización `[INFERIDA]` — S
**Como** Admin, **quiero** anular cotizaciones con motivo, **para** mantener el registro limpio.
- RF: RF-029 · RB: RB-008 · 1. Cotización `Anulada` no desaparece; si estaba aprobada y ya existe la OT, la anulación NO toca la OT (se anula por HU-024).

---

## 10. E8 — Notificaciones `[INFERIDA]`

### HU-034 — Centro de notificaciones internas `[INFERIDA]` — S
**Como** usuario, **quiero** ver en la app mis OT movidas, stock bajo y cotizaciones por expirar, **para** actuar sin abrir reportes.
- RF: RF-030 · RNF: retención ≥ 90 días · 1. **Entonces** veo no-leídas con contador y enlace directo. 2. Notificación generada por mi propio cambio → no a mí (evitar ruido) `[RECOMENDADA]`.

### HU-035 — Email al cliente «vehículo listo» `[INFERIDA]` — C 🚧OQ-03
**Como** Recepción, **quiero** que el cliente reciba un correo automático al pasar su OT a `Lista_entrega`, **para** reducir tiempos muertos en mostrador.
- RF: RF-031 · RNF-A-04 · 1. Plantilla en español editable por Admin. 2. Fallo del proveedor → cola con 3 reintentos, sin bloquear la OT. 3. Cliente sin email → la OT se entrega igual con aviso informativo. WhatsApp/SMS: fuera de MVP (OQ-03).

---

## 11. E9 — Dashboard y reportes `[INFERIDA]`

### HU-036 — Dashboard operativo `[INFERIDA]` — M
**Como** cualquier rol, **quiero** al entrar ver OT activas por estado, citas de hoy, cartera y repuestos en alerta, **para** saber por dónde empezar.
- RF: RF-032 · RNF-P-01/02 · 1. Cada KPI navega a su listado filtrado. 2. Datos frescos (caché ≤ 60 s). 3. Los KPIs respetan la matriz de permisos (técnico ve sus OT).

### HU-037 — Reportes con exportación CSV `[INFERIDA]` — S
**Como** Admin, **quiero** reportes de OT/ingresos/repuestos/clientes/productividad por rango de fechas con exportación, **para** tomar decisiones.
- RF: RF-033/034 · RB: RB-010 (sumas por snapshots) · RNF-S-04 (escape CSV) · 1. Totales del reporte = Σ documentos individuales (QA con dataset semilla). 2. CSV UTF-8, cabeceras en español, protegido contra CSV-injection. 3. Técnico solo ve sus datos; Admin ve todos.

### HU-038 — Productividad de técnicos `[INFERIDA]` — C 🚧OQ-06
**Como** Admin, **quiero** horas registradas, OT cerradas y tiempos promedio por estado de cada técnico, **para** equilibrar carga.
- RF: RF-034 · 1. Métricas calculadas desde la auditoría de estados (RF-036), no de campos volátiles.

---

## 12. E10 — Configuración, auditoría, impresión `[INFERIDA]`

### HU-039 — Configurar parámetros del taller `[INFERIDA]` — M 🚧OQ-02
**Como** Admin, **quiero** editar datos del taller, logo, moneda, tasa de impuesto, series, validez de cotización, horario y QC, **para** adaptar el sistema al negocio.
- RF: RF-035 · RB: RB-PARAM/010/013 · 1. Solo Admin (matriz §15). 2. Cambios aplican solo a documentos nuevos (RB-010) y cada edición se audita. 3. Validaciones duras de RB-PARAM en L2 (rechazo de tasa > 99 %, horarios invertidos, serie con caracteres inválidos).

### HU-040 — Consultar bitácora de auditoría `[RECOMENDADA]` — S
**Como** Admin, **quiero** filtrar cambios (OT, stock, parámetros, roles, anulaciones) con usuario/fecha/valores antes-después, **para** resolver discrepancias.
- RF: RF-036 · RNF-D-01 · 1. No existe UI/API de edición/borrado de bitácora (inmutable desde la app). 2. Retención ≥ 12 meses.

### HU-041 — Imprimir/exportar documentos `[INFERIDA]` — S
**Como** Recepción, **quiero** imprimir/PDF la OT, cotización, cobro y recibo con logo y datos del taller, **para** entregar evidencia física al cliente.
- RF: RF-037 · RNF-C-02 (A4 o térmica 80 mm según parámetro) · 1. **Entonces** el documento sale íntegramente en español, con correlativo y totales idénticos a pantalla (P-03). 2. Impresión no modifica el documento (inmutable, RB-008).

---

## 13. Historias explícitamente FUERA del MVP
Portal web del cliente · cobro en línea/pasarelas (OQ-03) · multi-sede (OQ-04) · contabilidad/libros · factura electrónica legal (queda a disposición de OQ-02, que hoy solo reetiqueta HU-031) · app móvil nativa · WhatsApp/SMS · migración de datos previos (OQ-05 → generaría historias ETL propias).

## 14. Validación requerida antes de implementación
- **🚧 = historia con dependencia de OQ abierta.** OQ-01 afecta E2 y la semántica de RB-003/004/011/014; OQ-02 afecta moneda/impuesto/fiscal (HU-031/039) y retenciones.
- Prioridades M = mínimo verificable; si AG-001 recorta alcance, candidatas a salir primero: HU-013, 022, 034–038, 041.
- Cada historia es verificable por sus criterios + DoD + matriz RB→prueba de `BUSINESS_RULES.md` §9. **Ninguna historia debe codificarse hasta la validación de A-01..A-04 por AG-001.**
