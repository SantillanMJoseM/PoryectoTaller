# Requisitos Funcionales — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0001 — Requirements Analysis |
| Autor | AG-004 Business Analyst |
| Fecha | 2026-11-05 |
| Versión | 1.2 — **BORRADOR PENDIENTE DE VALIDACIÓN** (v1.1: referencias cruzadas §15/§16, RNF-D-01; v1.2: criterios RF-005/022/029/035 alineados con RB-002/017/018 y parámetro `requerir_qc`; sin cambios de alcance) |
| Estado | Escalado a AG-001 (ver §2 y §16) |

---

## 1. Cómo leer este documento

Todo requisito lleva una etiqueta de clasificación. **No se han inventado necesidades del usuario**: todo lo que no fue declarado explícitamente está marcado como inferencia o recomendación y requiere validación.

| Etiqueta | Significado |
|---|---|
| `[CONFIRMADA]` | Derivada de una instrucción explícita del usuario/prompt (nombre del proyecto, stack obligatorio, idioma de UI, entregables). |
| `[INFERIDA]` | Supuesto del análisis a partir del contexto "Sistema Taller". **Debe validarse antes de construir.** |
| `[RECOMENDADA]` | Buena práctica propuesta por el analista; aceptable rechazarla sin afectar el alcance mínimo. |
| `[PENDIENTE]` | Requiere decisión del usuario (AG-001) antes de la fase de diseño/código. |

Prioridades con MoSCoW: **M** (Must, MVP) / **S** (Should) / **C** (Could) / **W** (Won't MVP).

---

## 2. Entrada confirmada vs. alcance asumido

### 2.1 Hechos confirmados por el prompt/usuarios del pipeline
1. **F-01** El producto se llama "Sistema Taller" `[CONFIRMADA]`.
2. **F-02** Stack obligatorio: React + TypeScript + Tailwind CSS + shadcn/ui + Supabase `[CONFIRMADA]`.
3. **F-03** Todo texto de UI en español `[CONFIRMADA]`.
4. **F-04** Es una aplicación web (implícito en el stack: SPA React + backend-as-a-service Supabase) `[CONFIRMADA por stack]`.
5. **F-05** El objetivo del pipeline exige requisitos funcionales, no funcionales, reglas de negocio e historias de usuario verificables `[CONFIRMADA]`.

> **Nota de integridad:** el prompt original recibido por la cadena de tareas no incluye un brief de negocio (tipo de taller, roles, país, facturación). Lo siguiente es el único insumo verificado. No existe documento de necesidad del usuario en el repositorio.

### 2.2 Supuesto de dominio principal (CRÍTICO — escalar a AG-001)
- **A-01** `[INFERIDA]` "Sistema Taller" = **sistema de gestión para un taller mecánico automotriz** (recepción de vehículos, órdenes de trabajo, inventario de repuestos, facturación básica, citas y reportes), operado por una sede pequeña/mediana.
- **A-02** `[INFERIDA]` Usuarios internos: administrador/dueño, receptor de servicio, técnicos mecánicos. El cliente final no usa el sistema (solo recibe notificaciones).
- **A-03** `[INFERIDA]` Moneda y régimen fiscal locales **no definidos**: se modela moneda configurable y un impuesto sobre ventas con tasa configurable (sin factura electrónica legal). `[PENDIENTE OQ-02]`
- **A-04** `[INFERIDA]` Una sola sede/ubicación en el MVP; el modelo no impide multi-sede futura.

**Riesgo:** si A-01 falla (p. ej., es taller metalmecánico, de bicicletas, eléctrico, o de costura), los módulos M3 (Vehículos), parte de M4 (catálogo) y RB asociadas cambian. La arquitectura de los demás módulos (clientes, OT, inventario, citas, facturación) es reutilizable en cualquier "taller de servicios". **Ningún TASK de código debe iniciarse hasta que AG-001 confirme A-01.**

### 2.3 Actores
| Actor | Descripción | Rol de acceso (Supabase) |
|---|---|---|
| Administrador | Dueño/gerente; configuración completa, reportes, anular/transfers | `admin` |
| Receptor de servicio | Atención en mostrador: clientes, vehículos, citas, OT, cobros | `recepcionista` |
| Técnico | Ejecuta y reporta avance de OT asignadas | `tecnico` |
| Cliente (externo) | No autenticado; recibe notificaciones | — |

---

## 3. Definición de alcance (MVP)

**In:** autenticación y roles, gestión de clientes y vehículos, catálogo de servicios, agenda de citas, órdenes de trabajo con estados, inventario básico de repuestos con existencias, cotizaciones y facturación interna, notificaciones de estado, reportes básicos, parámetros configurables, auditoría mínima.

**Out (explícito, MVP):** contabilidad general, integraciones bancarias/pasarelas de pago, portal web del cliente, factura electrónica certificada, multi-sede, app móvil nativa, CRM/marketing, garantía extendida/trazabilidad de VIN avanzada.

---

## 4. Módulo M1 — Autenticación y autorización `[CONFIRMADA por stack: Supabase Auth]`

### RF-001 Inicio y cierre de sesión
- **Prioridad:** M | **Clasificación:** `[CONFIRMADA por stack]` | **Actor:** cualquier usuario interno
- **Descripción:** El sistema autentica usuarios mediante Supabase Auth (email/contraseña) y permite cerrar sesión.
- **Criterios de aceptación:**
  1. Dado un usuario registrado con credenciales válidas, al ingresarlas accede a la pantalla principal en español.
  2. Credenciales inválidas muestran error genérico sin revelar si el email existe.
  3. Sesión expira por inactividad (ver RNF-S-03); tras expirar, se exige reautenticación.
  4. El cierre de sesión invalida la sesión del lado servidor.
- **Depende de:** —

### RF-002 Gestión de usuarios del sistema
- **Prioridad:** M | **Clasificación:** `[INFERIDA]` | **Actor:** Administrador
- **Descripción:** Crear, editar, desactivar usuarios internos y asignarles un rol.
- **Criterios de aceptación:**
  1. Solo rol `admin` puede crear/desactivar usuarios y cambiar roles.
  2. Un usuario desactivado no puede iniciar sesión; sus registros históricos permanecen.
  3. Email de invitación/recuperación de contraseña funcional (Supabase).
- **Depende de:** RF-001

### RF-003 Autorización por roles (RBAC)
- **Prioridad:** M | **Clasificación:** `[INFERIDA]` | **Actor:** sistema
- **Descripción:** Cada acción verificable está permitida solo a roles definidos en la Matriz de Permisos (§15). Se aplica en UI y es reforzada por Row Level Security de Supabase.
- **Criterios de aceptación:**
  1. Para cada fila de la matriz, un rol sin permiso recibe error 403/ocultación del control en UI.
  2. Las políticas RLS deniegan el acceso a datos aún consultando la API directamente.
- **Depende de:** RF-001, RF-002

### RF-004 Recuperación de contraseña
- **Prioridad:** S | **Clasificación:** `[RECOMENDADA]` | **Actor:** cualquier usuario interno
- **Criterios:** flujo estándar email-reset; cambio exige re-login.
- **Depende de:** RF-001

---

## 5. Módulo M2 — Clientes `[INFERIDA]`

### RF-005 Registro y mantenimiento de clientes
- **Prioridad:** M | **Actor:** Recepcionista, Admin
- **Descripción:** CRUD de clientes con identificación, contacto y notas.
- **Campos mínimos:** tipo de identificación (ej. DPI/Cédula/RUT/NIT — `[PENDIENTE OQ-02]`), número único, nombre/razón social, teléfono, email opcional, dirección opcional, notas.
- **Criterios de aceptación:**
  1. No se permite crear un cliente con número de identificación duplicado (ver RB-001).
  2. Búsqueda por nombre, número de identificación o teléfono (mín. 2 caracteres, < 2 s).
  3. Un cliente puede tener N vehículos (RF-008).
  4. El borrado lógico es la operación estándar; la eliminación física solo admite si no existe ninguna referencia (vehículos, OT, cotizaciones, cobros) (RB-002).
- **Depende de:** RF-003

### RF-006 Historial de un cliente
- **Prioridad:** S | **Actor:** Recepcionista, Admin, Técnico (solo lectura)
- **Descripción:** Vista del cliente con sus vehículos y OT/cotizaciones/facturas históricas ordenadas por fecha.
- **Criterios:** lista paginada (≤ 50/hoja); cada ítem enlace a su detalle.

### RF-007 Ficha rápida durante creación de OT
- **Prioridad:** S | **Descripción:** Al crear una OT, si el cliente no existe, permite crearlo en línea sin abandonar el formulario.
- **Criterios:** alta inmediata disponible desde el formulario de OT; datos validados igual que RF-005.

---

## 6. Módulo M3 — Vehículos `[INFERIDA A-01]`

### RF-008 Registro y mantenimiento de vehículos
- **Prioridad:** M | **Actor:** Recepcionista, Admin
- **Campos mínimos:** placa (única), propiedad (cliente), marca, modelo, año, color, tipo de combustible opcional, VIN opcional, observaciones/km actual.
- **Criterios de aceptación:**
  1. Placa única en el sistema (normalizada: sin espacios, mayúsculas) — RB-003.
  2. Todo vehículo pertenece exactamente a un cliente.
  3. Búsqueda por placa o cliente.

### RF-009 Historial de servicio por vehículo
- **Prioridad:** M | **Descripción:** Vista cronológica de OT de un vehículo: servicios realizados, repuestos usados, costos, técnico responsable.
- **Criterios:** filtro por rango de fechas; total de km registrados por visita si fue capturado.

### RF-010 Ficha de ingreso (estado del vehículo)
- **Prioridad:** S | **Descripción:** Al abrir una OT se captura estado de entrada: nivel de combustible, km, descripción/adjuntos de daños observados.
- **Criterios:** adjuntos imágenes ≤ 5 MB por archivo, máx. 10 por OT (ver RNF-P-04); campos km y estado requeridos por defecto (configurable, ver RB-PARAM).

---

## 7. Módulo M4 — Catálogo de servicios `[INFERIDA]`

### RF-011 CRUD de servicios/mano de obra
- **Prioridad:** M | **Actor:** Admin
- **Descripción:** Catálogo con: código, nombre, descripción, duración estimada (min), precio base de mano de obra, activo/inactivo.
- **Criterios:** código único; servicio inactivo no aparece en nuevas OT pero historial intacto; precio editable sin afectar OT cerradas (RB-010).

### RF-012 Categorías de servicio
- **Prioridad:** C | **Descripción:** Agrupar servicios por categoría (mecánica, eléctrica, llantas, diagnosis…) para reportes.
- **Criterios:** una categoría con servicios en uso no puede eliminarse, solo desactivarse.

---

## 8. Módulo M5 — Agenda / Citas `[INFERIDA]`

### RF-013 Programar cita
- **Prioridad:** S | **Actor:** Recepcionista, Admin
- **Descripción:** Agendar ingreso de vehículo con fecha/hora, cliente, vehículo, motivo/servicios preliminares y técnico opcional.
- **Criterios:**
  1. No permite citas en horario fuera del día hábil configurable (RB-PARAM).
  2. Aviso (no bloqueo) si el vehículo ya tiene cita superpuesta (RB-011).
  3. La cita puede convertirse en OT en un clic, preservando datos.

### RF-014 Vista de calendario
- **Prioridad:** S | **Descripción:** Vista día/semana de citas y OT activas con estados.
- **Criterios:** carga inicial < 2 s; colores por estado; acción rápida reprogramar/marcar no-show.

### RF-015 Modificación y cancelación de citas
- **Prioridad:** S | **Criterios:** cancelación exige motivo; estados: `programada → confirmada | no_show | atendida | cancelada` (RB-012).

---

## 9. Módulo M6 — Órdenes de Trabajo (OT) `[INFERIDA — núcleo del negocio]`

### RF-016 Crear OT
- **Prioridad:** M | **Actor:** Recepcionista
- **Descripción:** OT con: correlativo único (RB-013), cliente, vehículo, los síntomas reportados por el cliente, servicios preasignados, técnico asignado, fecha de ingreso, prioridad, notas.
- **Criterios:**
  1. Requiere cliente y vehículo vinculados (RB-014).
  2. Máximo una OT en estado `Abierta | En_proceso | Esperando_repuestos | Verificación_QC | Lista_entrega` por vehículo (RB-004); el sistema bloquea la segunda y ofrece ver la existente.
  3. Estado inicial: `Abierta`.

### RF-017 Ciclo de vida / estados de OT
- **Prioridad:** M | **Descripción:** Flujo de estados: `Abierta → En_proceso → Esperando_repuestos (opcional) → Verificación_QC (opcional) → Lista_entrega → Entregada`; terminales: `Entregada`, `Cancelada`. Transiciones válidas definidas en RB-005.
- **Criterios:** transiciones inválidas rechazadas; cada cambio registra usuario + timestamp (RF-036).

### RF-018 Detalle de OT: servicios y repuestos
- **Prioridad:** M | **Descripción:** Agregar/remover líneas de servicio (del catálogo, con horas y tarifa) y líneas de repuesto (del inventario, con cantidad y precio unitario); descuentos por línea o documento (RB-015).
- **Criterios:**
  1. Totales recalculados en pantalla: subtotal servicios + subtotal repuestos − descuento + impuesto = total.
  2. Solo `admin` puede modificar una OT `Entregada` (anulación, RB-008).

### RF-019 Asignación y avance técnico
- **Prioridad:** M | **Actor:** Recepcionista (asigna), Técnico (reporta)
- **Descripción:** Asignar OT a uno/varios técnicos; el técnico registra horas trabajadas por línea de servicio y notas de avance, y puede solicitar repuestos.
- **Criterios:** técnico solo ve/edita sus OT asignadas (RLS); horas ≥ 0 y con decimales (paso 0,1 h); solicitación de repuestos descuenta stock al confirmar salida (RF-023).

### RF-020 Reserva de repuestos en OT
- **Prioridad:** S | **Descripción:** Reservar stock de un repuesto para una OT sin consumirlo; la reserva libera al entregar/cancelar.
- **Criterios:** stock disponible = existencias − reservas; no se puede reservar más que disponible (RB-006).

### RF-021 Cierre / entrega de OT
- **Prioridad:** M | **Descripción:** Pasar a `Lista_entrega` y luego `Entregada` registrando km de salida, forma de pago (referencia) y firma/confirmación opcional del cliente.
- **Criterios:** no se puede entregar una OT con costo 0 sin justificación (RB-016); al entregar se emite factura interna (RF-027) o se vincula la existente; OT entregada alimenta historiales RF-006/RF-009.

---

## 10. Módulo M7 — Inventario de repuestos `[INFERIDA]`

### RF-022 CRUD de repuestos
- **Prioridad:** M | **Actor:** Admin, Recepcionista
- **Descripción:** Catálogo de repuestos: código/SKU único, nombre, marca, aplicación (vehículos/servicios compatible), precio costo, precio venta, stock actual, stock mínimo, ubicación física.
- **Criterios:** SKU único; campos numéricos ≥ 0; precio venta ≥ 0; puede ser 0 "por definir", y al usarlo en una OT/cotización se advierte y obliga a fijar el precio de esa línea sin alterar el catálogo (RB-017).

### RF-023 Movimientos de inventario
- **Prioridad:** M | **Descripción:** Todo cambio de stock se registra como movimiento con tipo: `entrada_compra`, `salida_ot`, `ajuste`, `devolucion`; con cantidad, referencia (OT/ajuste), usuario, fecha.
- **Criterios:**
  1. No existen modificaciones directas de stock sin movimiento (RB-007).
  2. Salidas por OT solo desde OT activas; no se permite stock negativo (RB-007); intento falla con mensaje claro y opción "quedar en espera de repuesto".

### RF-024 Alerta de stock mínimo
- **Prioridad:** S | **Descripción:** Cuando disponible < mínimo, el repuesto aparece en widget "Reabastecimiento" del dashboard y al usarse en OT.
- **Criterios:** alerta en < 5 s tras el movimiento; la alerta no bloquea operaciones (salvo salida que violaría RB-007).

### RF-025 Compras / entradas simples
- **Prioridad:** S | **Descripción:** Registrar entrada de mercancía (proveedor opcional, costo unitario, total) que crea movimiento `entrada_compra`. Valoración de inventario: costo promedio ponderado.
- **Criterios:** el costo promedio se recalcula en la entrada; valor total de inventario visible en reporte RF-033.

---

## 11. Módulo M8 — Cotizaciones y facturación interna `[INFERIDA]`

### RF-026 Cotización
- **Prioridad:** M | **Descripción:** Crear cotización desde OT o independiente; snapshot de precios (RB-010); válida N días (RB-PARAM `dias_validez_cotizacion`, default 7).
- **Criterios:** estados `Vigente → Aprobada | Rechazada | Expirada` (expiración automática por fecha); aprobar cotización la convierte/adjunta a OT en un clic.

### RF-027 Factura interna
- **Prioridad:** M | **Descripción:** Al entregar OT se genera documento de cobro interno con correlativo, snapshot de líneas, subtotal, descuento, impuesto (RF-035 `tasa_impuesto`), total y forma de pago.
- **Criterios:**
  1. No es factura fiscal legal `[PENDIENTE OQ-02]`; texto "documento no válido fiscalmente" en impresión si aplica.
  2. Una OT entregada tiene exactamente 1 documento de cobro (RB-018).

### RF-028 Registro de pagos
- **Prioridad:** S | **Descripción:** Registrar abonos/pagos sobre un documento de cobro (efectivo, tarjeta —referencia manual—, transferencia), con saldo pendiente.
- **Criterios:** total de abonos ≤ total (RB-019); documento con saldo 0 queda "Pagado"; se puede imprimir/recibir recibo.

### RF-029 Anulación / notas de ajuste
- **Prioridad:** S | **Actor:** Admin | **Descripción:** Anular cotización/factura con motivo; genera documento negativo vinculado; al anular el documento de cobro, la OT regresa a `Lista_entrega` hasta emitir el nuevo documento vigente (RB-008/RB-018).
- **Criterios:** solo admin; nunca borra el documento original (RB-008); visible en reportes como ingreso negativo.

---

## 12. Módulo M9 — Notificaciones `[INFERIDA]`

### RF-030 Notificaciones internas
- **Prioridad:** S | **Descripción:** Centro de notificaciones en la app para: OT que cambiaron de estado asignadas al usuario, stock bajo, cotizaciones por expirar.
- **Criterios:** in-app con no leídas; persistencia de al menos 90 días.

### RF-031 Notificación al cliente por email
- **Prioridad:** C | **Descripción:** Email automático al cliente al cambiar OT a `Lista_entrega` (y opcionalmente al aprobar repuestos), vía Supabase Edge Functions/provider.
- **Criterios:** plantilla en español, editable por admin (configurable simple); si el proveedor falla, queda en cola con reintento (máx. 3) `[RECOMENDADA]`; el fallo de email nunca bloquea la OT.

> **Nota:** WhatsApp/pagos en línea quedan fuera del MVP `[PENDIENTE OQ-03]`.

---

## 13. Módulo M10 — Reportes y dashboard `[INFERIDA]`

### RF-032 Dashboard principal
- **Prioridad:** M | **Descripción:** Al autenticar: KPIs del día/semana — OT activas por estado, citas del día, documentos por cobrar, repuestos en alerta.
- **Criterios:** cada KPI es clicable y navega al listado filtrado; datos reflejan estado actual (consulta directa, sin cache > 60 s).

### RF-033 Reportes básicos con exportación
- **Prioridad:** S | **Descripción:** Reportes con filtro de rango de fechas y exportación CSV/impresión: (a) OT por estado y técnico, (b) ingresos por periodo, (c) repuestos más usados/valor de inventario, (d) clientes/vehículos más frecuentes, (e) manos de obra más vendidas.
- **Criterios:** exportación CSV UTF-8 con cabeceras en español; totales del reporte coinciden con sumas de documentos individuales (verificación QA).

### RF-034 Productividad de técnicos
- **Prioridad:** C | **Descripción:** Horas registradas, OT cerradas y tiempo promedio por estado para cada técnico.
- **Criterios:** solo admin ve datos de todos; técnico solo los propios.

---

## 14. Módulo M11 — Configuración y auditoría

### RF-035 Parámetros del taller `[INFERIDA]`
- **Prioridad:** M | **Actor:** Admin
- **Descripción:** Config editable: nombre/dirección/teléfono del taller (encabezados de impresión), logo, moneda, tasa de impuesto %, serie de correlativos OT/factura/cotización, días de validez de cotización, horario hábil, obligatoriedad de QC (`requerir_qc`).
- **Criterios:** cambios aplican solo a documentos nuevos (RB-010); toda modificación auditada (RF-036).

### RF-036 Auditoría mínima `[RECOMENDADA]`
- **Prioridad:** S | **Descripción:** Bitácora de: altas/bajas/cambios de estado de OT, cambios de stock, cambios de parámetros, cambios de roles, anulaciones. Usuario, timestamp, valores antes/después.
- **Criterios:** inmutable desde UI; visible para admin con filtro; retención ≥ 12 meses (ver RNF-D-01).

### RF-037 Impresión/PDF de documentos `[INFERIDA]`
- **Prioridad:** S | **Descripción:** Generar vista imprimible (o PDF) de: orden de trabajo, cotización, factura interna, etiqueta de stock mínimo — con logo y datos del taller (RF-035).
- **Criterios:** funciona desde la pantalla del documento; contenido en español; A4/8.5×11 legible.

---

## 15. Matriz de permisos (resumen) `[INFERIDA — validar con AG-001]`

| Acción | Admin | Recepcionista | Técnico |
|---|---|---|---|
| Gestionar usuarios/roles/parámetros | ✅ | ❌ | ❌ |
| Clientes y vehículos CRUD | ✅ | ✅ | 👁 lectura |
| Citas CRUD | ✅ | ✅ | 👁 asignadas |
| OT: crear/editar líneas, estados, entregar | ✅ | ✅ | 👁/reportar avance asignadas |
| OT entregada: anular | ✅ | ❌ | ❌ |
| Inventario CRUD, ajustes | ✅ | ✅ | ❌ |
| Cotización/factura: anular | ✅ | ❌ | ❌ |
| Pagos registrar | ✅ | ✅ | ❌ |
| Reportes completos | ✅ | 👁 operativos | 👁 propios |
| Auditoría | ✅ | ❌ | ❌ |

---

## 16. Preguntas abiertas / Escalación a AG-001 (bloqueantes)

| ID | Pregunta | Impacto si no se responde | Nivel |
|---|---|---|---|
| OQ-01 | ¿Es A-01 correcto? ¿Qué tipo de taller y qué objetos gestiona (vehículos u otro)? | Redefinición de M3/M4 y reglas RB-003/004/011 | **CRÍTICO — bloquea TASK de código** |
| OQ-02 | País/moneda/IDs fiscales; ¿se requiere factura electrónica legal? | M8 es "documento interno" en este análisis | **CRÍTICO** |
| OQ-03 | ¿Canales de notificación requeridos (WhatsApp/SMS/email)? Alcance de cobros (pasarela vs. referencia manual) | RF-031/028 cambian de tamaño | Alto |
| OQ-04 | ¿Multi-sede/ multi-usuario concurrente estimado (2 vs 50)? | RNF de escalabilidad | Medio |
| OQ-05 | Migración de datos previos (excels/sistema anterior) | Requiere tarea ETL | Medio |
| OQ-06 | ¿El técnico necesita hora real de inicio/fin por línea (productividad) o basta horas totales? | RF-019/034 | Bajo |

**Decisión de continuidad:** los documentos restantes asumen A-01..A-04. AG-001 debe resolver OQ-01/OQ-02 antes de la implementación; el resto puede decidirse durante diseño con riesgo acotado.
