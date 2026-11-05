# Reglas de Negocio — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0001 — Requirements Analysis |
| Autor | AG-004 Business Analyst |
| Fecha | 2026-11-05 |
| Versión | 1.1 — **BORRADOR PENDIENTE DE VALIDACIÓN** (v1.1: corregido typo en el índice RB-013; sin cambios de contenido) |
| Estado | Hereda supuestos A-01..A-04 y preguntas abiertas OQ-01..OQ-06 de `FUNCTIONAL_REQUIREMENTS.md` (§2, §16). Escalado a AG-001 |

---

## 1. Notación

### 1.1 Clasificación (idéntica a los otros documentos de requisitos)
- `[CONFIRMADA]` — impuesta por instrucción explícita del usuario/prompt.
- `[INFERIDA]` — derivada del dominio asumido "taller mecánico automotriz" (A-01). **Debe validarse.**
- `[RECOMENDADA]` — buena práctica propuesta; rechazable sin romper el MVP.
- `[PENDIENTE OQ-xx]` — el parámetro/valor depende de una decisión de AG-001.

### 1.2 Capas de aplicación (dónde se hace cumplir la regla)
| Capa | Mecanismo | Naturaleza |
|---|---|---|
| **L1** UI (React + shadcn/ui) | Validación en formularios, mensajes en español | Comodidad; **nunca** límite de seguridad |
| **L2** Restricciones Postgres/Supabase | `UNIQUE`, `CHECK`, FK, índices parciales, triggers | Dura: garantía aunque se salte la UI |
| **L3** RLS / permisos Supabase | Políticas por rol (RF-003) | Dura: autoriza el acceso a datos |
| **L4** RPC atómica (función Postgres) | función `SECURITY DEFINER`, transacción completa | Dura: operaciones compuestas (OT+stock+documento) |
| **L5** Job / Edge Function | Expiraciones, alertas, notificaciones asincrónicas | Dura con reintento (RNF-A-04) |

**Principio rector:** toda regla existe en L2/L3/L4 aunque también se muestre en L1. Una regla sin test automatizable no se considera implementada (RNF-M-02).

### 1.3 Principios de negocio transversales `[INFERIDA]`
- **P-01 Inmutabilidad documental:** un documento (OT, cotización, cobro) nunca se borra ni se reescribe una vez cerrado; se corrige con un documento negativo vinculado (RB-008).
- **P-02 Trazabilidad total:** todo cambio de stock, estado de OT, precio de documento o parámetro deja bitácora (RF-036).
- **P-03 Consistencia del dinero:** total = subtotal servicios + subtotal repuestos − descuento + impuesto, recalculable a partir de las líneas guardadas (snapshots, RB-010).
- **P-04 Nada se pierde ante un fallo:** las operaciones multi-tabla son atómicas o compensables (RNF-A-02).

---

## 2. Índice de reglas

| ID | Nombre (una línea) | Clasificación |
|---|---|---|
| RB-001 | Identificación de cliente única (tipo + número normalizado) | INFERIDA |
| RB-002 | Cliente no se elimina con historial; borrado lógico preferido | INFERIDA |
| RB-003 | Placa de vehículo única y normalizada | INFERIDA |
| RB-004 | Máximo una OT activa por vehículo | INFERIDA |
| RB-005 | Máquina de estados válida de la OT | INFERIDA |
| RB-006 | Reservas no exceden el stock disponible | INFERIDA |
| RB-007 | Stock solo cambia por movimientos; nunca negativo | INFERIDA |
| RB-008 | Documentos cerrados inmutables; solo anulación por Admin | INFERIDA |
| RB-009 | Horas técnicas: rango, paso 0,1 h y edición acotada | INFERIDA |
| RB-010 | Snapshot de precios en documentos | INFERIDA |
| RB-011 | Cita duplicada por vehículo: aviso sin bloqueo | INFERIDA |
| RB-012 | Máquina de estados de citas; cancelación con motivo | INFERIDA |
| RB-013 | Correlativos únicos y monótonos, sin reutilización | INFERIDA |
| RB-014 | OT requiere cliente+vínculo coherente del vehículo | INFERIDA |
| RB-015 | Descuentos por línea/documento; total ≥ 0 | INFERIDA |
| RB-016 | Entrega con costo 0 exige justificación | INFERIDA |
| RB-017 | Precio de venta 0 = "por definir" y obliga fijar precio | INFERIDA |
| RB-018 | OT entregada ⇒ exactamente 1 documento de cobro vigente | INFERIDA |
| RB-019 | Suma de pagos ≤ total del documento; saldo ≥ 0 | INFERIDA |
| RB-020 | Cotización expira automáticamente por fecha | INFERIDA |
| RB-PARAM | Tabla de parámetros configurables | INFERIDA |

> Numerales RB-001..RB-020 son los mismos citados en `FUNCTIONAL_REQUIREMENTS.md` y `NON_FUNCTIONAL_REQUIREMENTS.md` (RNF-M-02). RB-009 y RB-020 se definen aquí para completar la serie 001–020 anunciada en RNF-M-02.

---

## 3. Registro: clientes y vehículos

### RB-001 — Identificación única de cliente `[INFERIDA]`
- **Enunciado:** no pueden existir dos clientes con el mismo par (tipo de identificación, número normalizado). Normalización: `upper(trim(numero))` sin separadores (`-`, `.`).
- **Aplicación:** L2 `UNIQUE INDEX (tipo_identificacion, numero_normalizado)`; L1 mensaje en vivo.
- **Mensaje UI:** «Ya existe un cliente registrado con ese número de identificación.»
- **Verificación:** test de integración — crear 2 clientes con mismo número → 23505; con y sin separadores se detecta como duplicado.
- **Trazabilidad:** RF-005. Formato legal de identificaciones por país: `[PENDIENTE OQ-02]`.

### RB-002 — Eliminación de clientes `[INFERIDA]`
- **Enunciado:** un cliente con vehículos, OT, cotizaciones o documentos de cobro asociados **no** puede eliminarse físicamente; la operación estándar es desactivar (borrado lógico). La eliminación física es solo Admin y solo si no existe ninguna referencia (caso: alta errónea sin historial).
- **Aplicación:** L4 `delete_cliente(p_id)` que verifica referencias; L2 FK `ON DELETE RESTRICT` como red.
- **Mensaje UI:** «El cliente tiene órdenes de trabajo asociadas. Se registrará como inactivo.»
- **Verificación:** test: eliminar cliente con OT → rechazado; sin referencias → OK; desactivado no aparece en búsquedas de alta pero sí en historiales.
- **Trazabilidad:** RF-005, RF-006. Interacción con derecho de supresión local: `[PENDIENTE OQ-02]` (RNF-S-05).

### RB-003 — Placa única y normalizada `[INFERIDA A-01]`
- **Enunciado:** la placa de vehículo es única en el sistema, normalizada a mayúsculas sin espacios. Cada vehículo pertenece a exactamente un cliente (RF-008).
- **Aplicación:** L2 `UNIQUE INDEX (upper(replace(placa,' ','')))`; L1 normaliza al perder foco.
- **Mensaje UI:** «Esa placa ya está registrada (vehículo: {placa} — {cliente}).»
- **Verificación:** test: alta duplicada con variantes ` abc-123 / ABC123` → rechazada. Patrón de formato según país: `[PENDIENTE OQ-01/OQ-02]` (si A-01 cambia, esta regla se re-formaliza al activo equivalente).
- **Trazabilidad:** RF-008, RF-009.

---

## 4. Órdenes de trabajo (OT)

### RB-013 — Correlativo de documentos `[INFERIDA]`
- **Enunciado:** OT, cotizaciones y documentos de cobro reciben un correlativo único al crearse: `{serie}{numero}` (serie y padding desde RB-PARAM). El número se asigna atómicamente con la creación (misma transacción, `nextval` por serie en L4). Un número emitido **nunca se reutiliza**, incluso si el documento se cancela o anula. Cambiar la serie en RB-PARAM inicia una nueva secuencia; los números antiguos se conservan.
- **Aplicación:** L4 + L2 `UNIQUE` sobre el correlativo por tipo de documento.
- **Verificación:** test de concurrencia: 2 creaciones simultáneas de OT no producen igual correlativo; cancelación de OT no libera el número.
- **Trazabilidad:** RF-016, RF-026, RF-027, RF-035. Obligatoriedad fiscal de series sin huecos: `[PENDIENTE OQ-02]`.

### RB-014 — Vínculo coherente cliente–vehículo `[INFERIDA]`
- **Enunciado:** toda OT referencia un cliente y un vehículo, y el vehículo debe pertenecer a ese cliente. La UI filtra vehículos por el cliente seleccionado.
- **Aplicación:** L4 (valida `vehiculo.client_id = ot.client_id`), L2 FKs `NOT NULL`, L1 filtro de combobox.
- **Mensaje UI:** «El vehículo no pertenece al cliente seleccionado.»
- **Verificación:** test: RPC con cliente A + vehículo B → error; UI nunca lista vehículos de otro cliente.
- **Trazabilidad:** RF-016, RF-008.

### RB-004 — Una OT activa por vehículo `[INFERIDA — núcleo]`
- **Enunciado:** un vehículo no puede tener simultáneamente más de una OT en estado activo (`Abierta`, `En_proceso`, `Esperando_repuestos`, `Verificación_QC`, `Lista_entrega`). Al intentar crear una segunda, la UI bloquea y enlaza a la OT existente.
- **Aplicación:** L2 índice único parcial:
  `CREATE UNIQUE INDEX ON orden_trabajo(vehiculo_id) WHERE estado IN ('Abierta','En_proceso','Esperando_repuestos','Verificación_QC','Lista_entrega');`
- **Mensaje UI:** «El vehículo {placa} ya tiene una OT {correlativo} en {estado}. ¿Verla?»
- **Verificación:** test concurrente de doble alta → una gana, otra recibe el mensaje; tras entregar/cancelar se permite la siguiente.
- **Trazabilidad:** RF-016, RF-021. Depende de A-01 (objeto intervenido): `[PENDIENTE OQ-01]`.

### RB-005 — Máquina de estados de la OT `[INFERIDA]`
- **Estados:** `Abierta`, `En_proceso`, `Esperando_repuestos`, `Verificación_QC`, `Lista_entrega`, `Entregada` (terminal), `Cancelada` (terminal).
- **Transiciones válidas (únicas permitidas):**

| Desde | A | Quién | Condición |
|---|---|---|---|
| Abierta | En_proceso | Técnico asignado, Recepción, Admin | — |
| En_proceso | Esperando_repuestos | Técnico asignado, Recepción, Admin | solicitud de repuestos |
| Esperando_repuestos | En_proceso | Recepción, Admin | — |
| En_proceso | Verificación_QC | Recepción, Admin | — |
| Verificación_QC | En_proceso | Recepción, Admin | falla QC (reproceso) |
| Verificación_QC | Lista_entrega | Recepción, Admin | — |
| En_proceso | Lista_entrega | Recepción, Admin | solo si RB-PARAM `requerir_qc = false` |
| Lista_entrega | Entregada | Recepción, Admin | RB-016, RB-018, km salida |
| Cualquier no terminal | Cancelada | Recepción, Admin | **motivo obligatorio** |

- **Aplicación:** L4 `cambiar_estado_ot(id, destino)` valida transición y rol; L1 muestra solo acciones válidas; todo cambio pasa a auditoría (RF-036). Las reservas de RB-006 se liberan automáticamente al llegar a `Entregada`/`Cancelada` (consumidas o devueltas según corresponda).
- **Mensaje UI:** «Transición no permitida: {origen} → {destino}.»
- **Verificación:** test parametrizado sobre las 42 parejas ordenadas de estados: las 13 transiciones válidas de la tabla → OK con bitácora; las 29 restantes → rechazo.
- **Trazabilidad:** RF-017, RF-020, RF-021.

### RB-009 — Horas técnicas `[INFERIDA]`
- **Enunciado:** cada línea de servicio de una OT no terminal puede registrar horas trabajadas: `0 ≤ horas ≤ 999,99`, con paso 0,1 h. Pueden editarlas el técnico asignado (de sus OT), Recepción y Admin. En OT `Entregada/Cancelada` quedan bloqueadas (RB-008).
- **Aplicación:** L2 `CHECK (horas BETWEEN 0 AND 999.99)`; L3 RLS por asignación; L1 stepper.
- **Verificación:** test: −0,1 y 1000 → rechazados; 0,15 → rechazado por paso (o redondeo con aviso, decisión de diseño); técnico no asignado → 403.
- **Trazabilidad:** RF-019, RF-034. Nivel de detalle (inicio/fin por línea): `[PENDIENTE OQ-06]`.

### RB-016 — Entrega con costo cero `[INFERIDA]`
- **Enunciado:** una OT no puede pasar a `Entregada` con total = 0 sin que Recepción/Admin escriba una justificación (≥ 10 caracteres) que queda guardada e impresa en el documento (p. ej., garantía sin cargo).
- **Aplicación:** L4 en el RPC de entrega; L1 diálogo obligatorio.
- **Verificación:** test: entregar sin líneas y sin justificación → bloqueado; con justificación → OK y visible en RF-037.
- **Trazabilidad:** RF-021.

---

## 5. Agenda / Citas

### RB-011 — Aviso de superposición de citas `[INFERIDA]`
- **Enunciado:** al guardar una cita, si el mismo vehículo ya tiene una cita `programada/confirmada` que se solapa en fecha/hora, el sistema **avisa sin bloquear** (puede ser ingreso en espera). Si al convertir la cita en OT se violaría RB-004, la conversión sí se bloquea.
- **Aplicación:** L1 aviso + L4 verificación en conversión.
- **Mensaje UI:** «Aviso: {placa} ya tiene una cita {fecha} {hora}. Puede guardar igualmente.»
- **Verificación:** test: citas superpuestas permitidas; conversión con OT activa → rechazada con enlace.
- **Trazabilidad:** RF-013, RF-016.

### RB-012 — Estados de cita `[INFERIDA]`
- **Enunciado:** estados `Programada → Confirmada → Atendida | No_Show`; `Programada/Confirmada → Cancelada` con motivo obligatorio. `Atendida` exige que la cita se haya convertido en OT (vínculo `ot_id`). Una cita vencida sin gestión queda `No_Show` al cerrar el día hábil (job L5 con zona local, RNF-C-03).
- **Aplicación:** L4 + L5; L1 acciones disponibles por estado.
- **Verificación:** test de transiciones igual que RB-005; `Atendida` sin OT → rechazado.
- **Trazabilidad:** RF-013, RF-015.

---

## 6. Inventario de repuestos

### RB-007 — Stock solo vía movimientos `[INFERIDA — crítica]`
- **Enunciado:** la columna de existencias **nunca** se modifica directamente; todo cambio genera un movimiento tipado (`entrada_compra`, `salida_ot`, `ajuste`, `devolucion`) con cantidad ≠ 0, referencia, usuario y fecha (RF-023). Existe `CHECK (stock >= 0)` como última defensa: un `salida_ot` que daría negativo falla con mensaje claro y ofrece marcar la OT `Esperando_repuestos`. Ajustes con signo negativo que violen `stock ≥ 0` se rechazan.
- **Aplicación:** L4 `mover_stock(repuesto_id, tipo, cantidad, ref)` (revocar `UPDATE` directo de la columna en L2/L3); L1 botón "quedar en espera".
- **Verificación:** invariantes: `stock == SUM(movimientos)` para todo repuesto (test de propiedad tras la suite); intento de stock negativo → rechazo + transición sugerida.
- **Trazabilidad:** RF-023, RF-025. Valoración: costo promedio ponderado en `entrada_compra` (RF-025).

### RB-006 — Reservas `[INFERIDA]`
- **Enunciado:** `disponible = stock − reservas_activas`. Una reserva (RF-020) no puede exceder el disponible; se libera al alcanzar `Entregada`/`Cancelada` o al retirar la línea. La salida `salida_ot` consume primero la reserva si existe.
- **Aplicación:** L4 (revisión dentro de la misma transacción, no con lectura previa).
- **Mensaje UI:** «Disponible insuficiente para {repuesto}: solicitado {n}, disponible {m}.»
- **Verificación:** test concurrente: dos reservas que sumadas exceden stock → una gana, la otra recibe mensaje; invariante `disponible ≥ 0`.
- **Trazabilidad:** RF-020, RF-019, RNF-A-02.

### RB-017 — Precio de venta "por definir" `[INFERIDA]`
- **Enunciado:** un repuesto con `precio_venta = 0` puede existir en catálogo, pero al agregarlo a una OT/cotización el sistema advierte «precio por definir» y **obliga** a fijar un precio > 0 para esa línea; el precio usado queda como snapshot (RB-010) sin alterar el catálogo.
- **Aplicación:** L1 obligatorio + L4 rechaza guardar líneas de documento con precio ≤ 0 (RB-016 cubre el total cero del documento, no el precio cero de una línea).
- **Verificación:** test: agregar repuesto con precio 0 sin fijar → no permite guardar; catálogo conserva su precio original.
- **Trazabilidad:** RF-022, RF-018.

---

## 7. Precios, cotizaciones, facturación interna y pagos

### RB-010 — Snapshot de precios `[INFERIDA]`
- **Enunciado:** cada línea de OT, cotización o documento de cobro guarda copia inmutable de: nombre del ítem, precio unitario, tasa de impuesto y descuento vigentes **al momento de agregarse**. Actualizar catálogo (RF-011), repuestos (RF-022) o parámetros (RF-035) **jamás** recalcula documentos existentes ni OT cerradas; solo afecta a los nuevos.
- **Aplicación:** L2 (columnas propias de la línea, sin FK viva al precio); L4 al clonar líneas cotización→OT.
- **Verificación:** test: cambiar precio catálogo → OT previa muestra precio antiguo; aprobar cotización → OT hereda snapshots idénticos.
- **Trazabilidad:** RF-011, RF-018, RF-026, RF-035.

### RB-015 — Descuentos `[INFERIDA + RECOMENDADA]`
- **Enunciado:** se permite descuento porcentual o de monto por línea y/o por documento, aplicándose primero los de línea y luego el de documento sobre el subtotal resultante. Reglas duras: ningún descuento puede hacer negativo el subtotal de su línea ni el total del documento (P-03). `[RECOMENDADA]`: descuento de documento > 20 % exige rol Admin (validar umbral con AG-001 — sin respuesta, se implementa como advertencia no bloqueante).
- **Aplicación:** L4 recalcula totales; L2 `CHECK (total >= 0)`; L1 muestra desglose.
- **Verificación:** test: descuento > subtotal → rechazado; Admin vs Recepción con descuento 25 % → permitido solo a Admin (o advertencia, según decisión).
- **Trazabilidad:** RF-018, RF-026, RF-027.

### RB-018 — Un documento de cobro por OT entregada `[INFERIDA]`
- **Enunciado:** la transición a `Entregada` (RPC L4) crea o vincula **exactamente un** documento de cobro no anulado para esa OT. No se puede entregar sin él, ni entregar dos veces. Si el documento se anula (RB-008), la OT regresa a `Lista_entrega` hasta emitir el nuevo documento vigente.
- **Aplicación:** L2 `UNIQUE (ot_id) WHERE estado_documento <> 'Anulado'` en documentos de cobro; L4 en `entregar_ot`.
- **Verificación:** test: doble emisión → violación única; anular → OT editable y reemisión OK; invariante tras anulación = 1 vigente.
- **Trazabilidad:** RF-021, RF-027, RF-029, RNF-A-02. El documento **no es factura fiscal legal**: `[PENDIENTE OQ-02]` — si se requiere, se reemplaza la política de series y el pie «documento no válido fiscalmente».

### RB-019 — Pagos y saldos `[INFERIDA]`
- **Enunciado:** cada pago tiene monto > 0; la suma acumulada de pagos de un documento nunca excede su total (el exceso se rechaza con el saldo visible). `saldo = total − Σpagos`; `saldo = 0` ⇒ documento `Pagado`. En anulación de documento (RB-008), los pagos quedan registrados como referencia de devolución manual; nunca se borran.
- **Aplicación:** L4 en `registrar_pago`; L2 `CHECK (monto > 0)`.
- **Verificación:** test: pagar de más → rechazado; abonos parciales → saldo decreciente; anular con pagos → bitácora de devolución visible.
- **Trazabilidad:** RF-028, RF-029. Formas de pago con pasarela: `[PENDIENTE OQ-03]` (MVP = referencia manual).

### RB-020 — Expiración de cotizaciones `[INFERIDA]`
- **Enunciado:** `vence = fecha_emisión + RB-PARAM.dias_validez_cotizacion` (días naturales, en zona local del taller, RNF-C-03). Vencida la fecha, el job L5 (y toda lectura) marca la cotización `Expirada`. Una cotización expirada **no puede aprobarse**: se recrea desde la OT con precios actuales (RB-010 no se viola porque es un documento nuevo).
- **Aplicación:** L5 job diario + L4 guarda al aprobar.
- **Mensaje UI:** «La cotización venció el {fecha}. Cree una nueva cotización con precios vigentes.»
- **Verificación:** test con fecha simulada +1/+8 días → expiración y bloqueo de aprobación.
- **Trazabilidad:** RF-026.

### RB-008 — Inmutabilidad y anulación `[INFERIDA — crítica]`
- **Enunciado:** OT en `Entregada`/`Cancelada`, cotizaciones aprobadas/expiradas y documentos de cobro emitidos **no se editan ni eliminan**. La única corrección permitida es la **anulación**: solo Admin, con motivo obligatorio (≥ 10 caracteres), generando documento negativo vinculado al original (nota de ajuste), que figura como ingreso negativo en reportes (RF-033). El original permanece con estado `Anulado` y todo queda en auditoría (RF-036). La anulación de un documento de cobro revierte la OT según RB-018.
- **Aplicación:** L3 RLS (sin `UPDATE/DELETE` en documentos cerrados para roles bajos), L4 `anular_documento(id, motivo)`; L1 sin botones de borrado.
- **Verificación:** test: PUT directo a API sobre documento cerrado con JWT recepcionista → 403; anulación solo Admin; reporte muestra el negativo; borrado físico inexistente.
- **Trazabilidad:** RF-018 (criterio 2), RF-029, RNF-S-02.

---

## 8. RB-PARAM — Parámetros configurables del taller `[INFERIDA]`

Editables solo por Admin (RF-035). Toda edición se audita (RF-036) y **aplica únicamente a documentos/operaciones nuevos** (RB-010).

| Clave | Descripción | Tipo | Default | Validación dura |
|---|---|---|---|---|
| `nombre_taller` / `direccion` / `telefono` | Encabezado de documentos | texto | — | no vacío (impresión RF-037) |
| `logo` | Logo en documentos | imagen Storage | — | ≤ 2 MB, PNG/SVG `[RECOMENDADA]` |
| `moneda` | Moneda de todos los importes | código | `[PENDIENTE OQ-02]` (sugerido: GTQ) | catálogo ISO-4217 acotado |
| `tasa_impuesto` | % impuesto sobre ventas | decimal | `[PENDIENTE OQ-02]` | 0–99,00 con 2 decimales |
| `serie_ot` / `serie_cotizacion` / `serie_factura` | Prefijos de correlativo (RB-013) | texto+padding | `OT-` / `COT-` / `FAC-`, 5 dígitos | `[A-Z0-9]{1,8}` |
| `dias_validez_cotizacion` | Validez (RB-020) | entero | **7** | 1–90 |
| `horario_habil` | Inicio/fin por día de semana | horas | 08:00–18:00 L-V, 08:00–13:00 S | inicio < fin; usado por RF-013 |
| `requerir_qc` | Estado `Verificación_QC` obligatorio en flujo | bool | `true` | cambia RB-005 (transición En_proceso→Lista_entrega) |
| `capturar_estado_entrada` | Ficha de ingreso RF-010 obligatoria | bool | `true` | km y combustible requeridos al abrir OT |
| `zona_horaria` | Zona de exhibición y cálculo de "hoy" | IANA | `[PENDIENTE OQ-02]` | lista IANA válida (RNF-C-03) |

- **Verificación de conjunto:** test: cambiar `tasa_impuesto` no altera documento previo; cambiar `serie_ot` → siguiente OT usa serie nueva con secuencia propia.
- **Trazabilidad:** RF-035, RF-013, RF-021, RF-026, RF-037.

---

## 9. Matriz RB → capas → requisitos → tipo de prueba

| RB | Capa dura principal | RF relacionadas | Prueba mínima |
|---|---|---|---|
| RB-001 | L2 unique | RF-005 | Int: duplicado normalizado |
| RB-002 | L4 + L2 FK | RF-005/006 | Int: con/sin referencias |
| RB-003 | L2 unique parcial a normalizada | RF-008 | Int: variantes de placa |
| RB-004 | L2 índice único parcial | RF-016 | Conc: doble alta |
| RB-005 | L4 | RF-017/020/021 | Unit param: 13 válidas + 29 inválidas |
| RB-006 | L4 | RF-020 | Conc: reservas cruzadas |
| RB-007 | L4 + L2 CHECK | RF-023 | Propiedad: stock = Σmovimientos |
| RB-008 | L3 + L4 | RF-018/029 | E2E/Int: anulación solo Admin |
| RB-009 | L2 CHECK + L3 | RF-019 | Unit: bordes de rango/paso |
| RB-010 | L2 (datos en línea) | RF-011/018/026/035 | Int: precio vs snapshot |
| RB-011 | L1 + L4 | RF-013 | Int: conversión con OT activa |
| RB-012 | L4 + L5 | RF-015 | Unit transiciones + job No_Show |
| RB-013 | L2 unique + secuencia | RF-016/026/027 | Conc: correlativos únicos |
| RB-014 | L4 + L2 FK | RF-016 | Unit: cliente≠vehículo |
| RB-015 | L4 + L2 CHECK | RF-018/027 | Unit: totales y topes |
| RB-016 | L4 | RF-021 | E2E: entregar costo 0 |
| RB-017 | L1 + L4 | RF-022/018 | Int: precio 0 en línea |
| RB-018 | L2 unique parcial + L4 | RF-021/027/029 | Int: 1 documento vigente |
| RB-019 | L4 + L2 CHECK | RF-028 | Unit: saldos |
| RB-020 | L5 + L4 | RF-026 | Fechas simuladas |
| RB-PARAM | L4 + L2 | RF-035 | Int: efectos solo documentos nuevos |

---

## 10. Reglas pendientes de validación (escalación AG-001)

| Regla | Depende de | Qué puede cambiar |
|---|---|---|
| RB-003, RB-004, RB-011, RB-014 | **OQ-01 (CRÍTICO)** | Si A-01 falla, "placa/vehículo" se re-formaliza por el activo equivalente (bicicleta, equipo eléctrico…); la estructura de regla (unicidad + una OT por activo) se conserva. |
| RB-001, RB-013, RB-018, RB-PARAM `tasa_impuesto/moneda` | **OQ-02 (CRÍTICO)** | Factura electrónica legal cambiaría RB-013 (series fiscales), RB-018 (emisión certificada) y el pie del documento; requisitos de retención endurecen RB-PARAM/RF-036. |
| RB-019 (formas de pago) | OQ-03 | Integración de pasarela reemplaza "referencia manual". |
| RB-PARAM `horario_habil` | OQ-02 | Festivos locales no contemplados en MVP. |

**Ninguna regla de este documento fue presentada como confirmada por el usuario salvo las derivadas del stack/idioma (RNF-U-01, RF-001).** El conjunto RB-001..RB-020 + RB-PARAM es `[INFERIDA]/[RECOMENDADA]` y requiere validación de AG-001 junto con los supuestos A-01..A-04 antes de iniciar cualquier TASK de código.
