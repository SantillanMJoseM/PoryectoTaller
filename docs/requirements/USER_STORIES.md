# Historias de Usuario — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0001 — Requirements Analysis |
| Autor | AG-004 Business Analyst |
| Fecha | 2026-11-05 |
| Versión | **2.0** — Rebasing contra la fuente de verdad. Sustituye a v1.1 (historias de un dominio automotriz/citas no presente en SP; ver `FUNCTIONAL_REQUIREMENTS.md` §9) |
| Fuente de verdad | `docs/requirements/SOURCE_PROMPT.md` (SP) |
| Trazabilidad | RF-xxx = `FUNCTIONAL_REQUIREMENTS.md`; RB-xxx = `BUSINESS_RULES.md`; RNF-xxx = `NON_FUNCTIONAL_REQUIREMENTS.md` |

---

## 1. Cómo leer este documento

- Formato: **Como** [rol] **quiero** [capacidad] **para** [beneficio]; criterios de aceptación (CA) en **Dado/Cuando/Entonces**, redactados en español (idioma de UI `[CONFIRMADA]`).
- **Épicos E1…E17 = los 17 módulos obligatorios de SP, con sus nombres y orden originales.** Ninguna historia introduce capacidad fuera de SP; las clasificaciones `[CONFIRMADA]/[INFERIDA]/[RECOMENDADA]` se heredan del RF de cada historia.
- Actores: **Usuario administrativo** (autenticado en el panel; sus capacidades reales dependen de los códigos de su grupo de permisos, RB-006/RB-029) y **Cliente** (sesión de portal, RB-012/RB-032). SP no fija nombres de cargo internos; se escribe “Usuario administrativo con `v< Módulo>`” en lugar de inventar roles.
- 🚧 = historia con dependencia de pregunta abierta (OQ-xx, `FUNCTIONAL_REQUIREMENTS.md` §8). Prioridad MoSCoW: **M** (SP lo exige como parte del sistema completo) / **S** (deducido del modelo, imprescindible para integridad) / **R** (recomendación anulable).

### Definition of Done global `[CONFIRMADA por SP + RECOMENDADA]`
1. UI en español con shadcn/ui + Tailwind, responsive, con tabla/formulario/modal/paginación donde aplique (RNF-U-01…03; RB-007/RB-008).
2. RB citadas aplicadas en capa dura (L2/L3/L4) con test automatizado (RNF-M-02).
3. Permisos del caso verificados por RLS (consulta directa con JWT sin código → 0 filas/403) (RB-006, RB-031, RB-032).
4. Acción relevante auditada en `logs_auditoria` con usuario/tarea/fecha/hora/IP (RB-009, RB-028).
5. Pasa `tsc --noEmit` + lint; no introduce librerías fuera de stack (RNF-M-01).

---

## 2. Épicos y mapa de cobertura

| Epic (módulo SP) | Historias | Cubre RF | Prioridad |
|---|---|---|---|
| E1 Autenticación administrativa | HU-001…003 | RF-001…006 | M |
| E2 Panel principal | HU-004 | RF-007…009 | M |
| E3 Clientes | HU-005…008 | RF-010…014 | M/S |
| E4 Productos | HU-009…011 | RF-015…018 | M |
| E5 Servicios | HU-012 | RF-019 | M |
| E6 Órdenes de trabajo | HU-013…021 | RF-020…031 | M/S |
| E7 Ventas | HU-022…024 | RF-032…037 | M |
| E8 Garantías | HU-025…026 | RF-038…040 | M |
| E9 Financiero | HU-027…029 | RF-041…048 | M/S |
| E10 Archivos/Documentos | HU-030…031 | RF-049…053 | M |
| E11 Usuarios | HU-032…033 | RF-054…058 | M |
| E12 Permisos | HU-034…036 | RF-059…061 | M |
| E13 Informes/Reportes | HU-037…039 | RF-062…066 | M |
| E14 Auditoría | HU-040…041 | RF-067…069 | M |
| E15 Cola de emails | HU-042…043 | RF-070…074 | M |
| E16 Portal del cliente | HU-044…046 | RF-075…080 | M |
| E17 Configuración de empresa | HU-047…048 | RF-081…082 | M |

RF-001…RF-082 tienen todas al menos una historia (tabla anterior). No existen historias fuera de los 17 módulos (SP: “No improvises módulos nuevos”).

---

## 3. E1 — Autenticación administrativa

### HU-001 — Ingresar al panel `[CONFIRMADA]` — M
**Como** usuario administrativo, **quiero** iniciar sesión con mi correo y contraseña, **para** acceder al sistema según mis permisos.
- RF: RF-001/002/003/006 · RB: RB-011/013/006 · RNF: RNF-S-01/06/08
1. **Dado** un usuario activo, no expirado y con grupo de permisos activo, **cuando** ingreso credenciales válidas, **entonces** accedo al Panel principal y el menú solo muestra mis módulos permitidos.
2. **Dado** credenciales inválidas, **cuando** intento entrar, **entonces** veo un mensaje de error en español y no se indica si el correo existe `[RECOMENDADA]`.
3. **Dado** la contraseña almacenada, **entonces** solo existe como hash seguro (bcrypt/argon2 o Supabase Auth equivalente) — jamás visible en UI/API/logs.
4. **Dado** sesión iniciada, **cuando** recargo el navegador antes de la expiración, **entonces** sigo autenticado (sesión persistente).

### HU-002 — Cerrar sesión y expiración `[CONFIRMADA]` — M
**Como** usuario administrativo, **quiero** cerrar mi sesión (y que el sistema la expire automáticamente), **para** que nadie use mi cuenta.
- RF: RF-003/004 · RB: RB-013 · RNF: RNF-S-06
1. **Cuando** pulso «Cerrar sesión», **entonces** la sesión queda invalidada y las rutas privadas redirigen al login.
2. **Dado** sesión expirada, **cuando** intento navegar, **entonces** se exige re-login sin exponer datos.

### HU-003 — Registro de sesiones en base de datos `[CONFIRMADA — tabla sesiones]` — S
**Como** administrador, **quiero** que las sesiones queden registradas en la base de datos, **para** cumplir el modelo de datos del sistema.
- RF: RF-005 · 🚧 OQ-06 (materialización junto a Supabase Auth; decisión de diseño, no de alcance)
1. **Cuando** un usuario inicia sesión, **entonces** existe evidencia persistida de la sesión (usuario, inicio, expiración) en la solución acordada para la tabla `sesiones`.

---

## 4. E2 — Panel principal

### HU-004 — Resumen operativo del día `[CONFIRMADA]` — M
**Como** usuario administrativo, **quiero** ver al entrar las órdenes abiertas, productos con stock bajo, últimas ventas y movimientos pendientes, **para** saber por dónde empezar.
- RF: RF-007/008/009 · RB: RB-002/025/006
1. **Entonces** veo los 4 bloques con cifras y listados cortos enlazados a cada módulo.
2. **Cuando** pulso un bloque, **entonces** naviga al listado del módulo correspondiente (accesos rápidos).
3. **Entonces** veo mi nombre de usuario conectado y el menú restringido a mis códigos de permiso (un usuario con `vOrden` únicamente, no verá el bloque de ventas si carece de `vVenta` `[INFERIDA]`).

---

## 5. E3 — Clientes

### HU-005 — Crear/editar/eliminar/ver cliente `[CONFIRMADA]` — M
**Como** usuario con `aCliente/eCliente/dCliente/vCliente`, **quiero** mantener la ficha del cliente con todos los campos del modelo (nombre, sexo, persona física, documento, teléfonos, correo, dirección, fecha de registro), **para** registrar a quién atiendo.
- RF: RF-010 · RB: RB-022/009/007
1. **Cuando** guardo un cliente nuevo, **entonces** queda con `fecha_registro` automática y es visible con sus datos.
2. **Dado** un cliente con órdenes/ventas/movimientos/equipos asociados, **cuando** intento eliminarlo, **entonces** se rechaza con mensaje claro en español (RB-022) 🚧OQ-03.
3. **Entonces** la operación queda auditada (usuario/tarea/fecha/hora/IP).

### HU-006 — Buscar y paginar clientes `[CONFIRMADA]` — M
**Como** usuario con `vCliente`, **quiero** buscar por nombre, documento o correo y ver resultados paginados, **para** localizar clientes en segundos.
- RF: RF-011/012 · RNF: RNF-P-01, RNF-U-03
1. **Cuando** escribo parte del nombre/documento/correo, **entonces** obtengo coincidencias paginadas en < 2 s con datos de producción típicos.

### HU-007 — Ficha vinculada del cliente `[CONFIRMADA]` — M
**Como** usuario con `vCliente`, **quiero** ver desde el cliente sus órdenes, ventas, movimientos financieros y garantías, **para** conocer toda su relación con el taller.
- RF: RF-013 · RB: — (las garantías asociadas se obtienen vía `ordenes_trabajo.garantia_id`, RF-013)
1. **Entonces** en la ficha hay 4 secciones/enlaces con los listados filtrados por el cliente.

### HU-008 — Equipos del cliente 🚧 `[INFERIDA — deducida del modelo SP]` — S
**Como** usuario con `eCliente` (o `aCliente`), **quiero** registrar los equipos de cada cliente (marca, modelo, serie, color, tensión, potencia, voltaje, fecha de fabricación), **para** identificar qué aparato ingresa a reparación.
- RF: RF-014 · OQ-02
1. **Cuando** agrego un equipo con marca inexistente, **entonces** puedo crear la marca en línea (catálogo `marcas`, activa por defecto) sin pantalla extra.
2. **Entonces** el equipo queda ligado al cliente y es seleccionable al crear una orden (HU-021).

---

## 6. E4 — Productos

### HU-009 — CRUD de productos `[CONFIRMADA]` — M
**Como** usuario con `a/e/d/vProducto`, **quiero** mantener el catálogo (descripción, unidad, precio de compra, precio de venta, stock, stock mínimo, salida, entrada), **para** controlar los insumos vendibles.
- RF: RF-015 · RB: RB-008/020/022
1. **Entonces** importes se muestran con 2 decimales y el stock no puede quedar negativo por edición directa.
2. **Cuando** elimino un producto referenciado por líneas existentes, **entonces** se rechaza (RB-022) 🚧OQ-03.

### HU-010 — Alerta de stock bajo `[CONFIRMADA]` — M
**Como** usuario con `vProducto`, **quiero** identificar los productos cuyo stock está por debajo del mínimo, **para** reabastecer.
- RF: RF-016 · RB: RB-002
1. **Dado** producto con `stock < stock_minimo`, **cuando** abro el listado de productos o el Panel, **entonces** aparece señalado (columna/filtro/marca “stock bajo”).

### HU-011 — Stock consistente con órdenes y ventas `[CONFIRMADA]` — M
**Como** el sistema, **quiero** descontar stock al agregar una línea de producto y reintegrarlo al quitarla, **para** mantener la cifra real.
- RF: RF-017/018 · RB: RB-002/020 · 🚧 OQ-01
1. **Dado** producto con stock 10, **cuando** guardo una orden con cantidad 3 del producto, **entonces** stock = 7 en la misma transacción.
2. **Cuando** quito la línea, **entonces** stock vuelve a 10. Cambiar 3→5 descuenta 2 más.
3. **Dado** cantidad mayor al stock, **cuando** guardo la línea, **entonces** ocurre la política OQ-01 (por defecto: advertencia no bloqueante + sugerir estado «Aguardando Piezas») y el invariante RB-020 se preserva.
4. Idéntico para `items_venta` (HU-022).

---

## 7. E5 — Servicios

### HU-012 — CRUD de servicios `[CONFIRMADA]` — M
**Como** usuario con `a/e/d/vServicio`, **quiero** mantener servicios (nombre, descripción, precio), **para** ofrecer mano de obra/repuestos sin inventario.
- RF: RF-019 · RB: RB-008/021/022
1. **Entonces** el precio muestra 2 decimales; editar el precio **no** altera líneas históricas de órdenes (snapshot RB-021).
2. **Cuando** elimino un servicio usado en órdenes existentes, **entonces** se rechaza (RB-022).

---

## 8. E6 — Órdenes de trabajo

### HU-013 — Crear una orden `[CONFIRMADA]` — M
**Como** usuario con `aOrden`, **quiero** crear una orden con cliente, técnico (usuario), fechas, garantía, descripción del producto, defecto, observaciones y laudo técnico, **para** registrar el ingreso del servicio.
- RF: RF-020 · RB: RB-009/010
1. **Cuando** guardo la orden con cliente y usuario asignados, **entonces** nace con estado editable dentro de los 6 permitidos y `fecha_inicial` registrada.
2. **Entonces** todos los campos del modelo SP son visibles/editables (menos `facturado`/`lanzamiento_id`, que solo cambia el proceso de facturación HU-019 `[INFERIDA]`).

### HU-014 — Estados de la orden `[CONFIRMADA]` — M
**Como** usuario con `eOrden`, **quiero** mover la orden entre **Presupuesto, Abierta, En Proceso, Finalizado, Cancelado y Aguardando Piezas**, **para** reflejar su avance real.
- RF: RF-021 · RB: RB-010/009
1. **Entonces** el selector ofrece exactamente esos 6 valores (sin otros).
2. **Cuando** cambio de estado, **entonces** queda auditado; al pasar a Finalizado se deja constancia de `fecha_final` `[INFERIDA]`.
3. **Cuando** cancelo una orden, **entonces** el registro permanece (para histórico/financiero); no hay restricción adicional de transiciones definida por SP.

### HU-015 — Líneas de productos y servicios con total `[CONFIRMADA]` — M
**Como** usuario con `eOrden`, **quiero** agregar/quitar productos (cantidad, precio, subtotal) y servicios (cantidad, precio, subtotal), **para** calcular el `valor_total` de la orden.
- RF: RF-022/023/024/030 · RB: RB-017/018/002/021
1. **Cuando** agrego una línea, **entonces** `subtotal = cantidad × precio` y `valor_total = Σ productos + Σ servicios` recalculados por backend.
2. **Entonces** el precio/descripción quedan copiados del catálogo (RB-021) y el stock se ajusta en productos (HU-011).

### HU-016 — Adjuntar archivos a la orden `[CONFIRMADA]` — M
**Como** usuario con `eOrden`, **quiero** adjuntar fotos/archivos con miniatura, URL y ruta, **para** documentar el estado del equipo.
- RF: RF-025 · RB: RB-034 (sanitizar nombres/tipos) · RNF-U/S varios
1. **Cuando** subo una imagen, **entonces** la ficha muestra la miniatura y la descarga usa `url`/`ruta` de Supabase Storage; el registro `anexos` queda ligado a la orden.

### HU-017 — Enviar orden por correo al cliente `[CONFIRMADA]` — M
**Como** usuario con `eOrden` (+`aEmail` para la cola), **quiero** enviar la orden al correo del cliente, **para** notificarlo formalmente.
- RF: RF-026 · RB: RB-015 · RNF-A-02
1. **Cuando** pulso «Enviar por correo», **entonces** se crea un email `pendiente` en `cola_emails` con destinatario tomado del cliente (editable), mensaje de la orden y `fecha`.
2. **Entonces** el envío real lo hace la cola (HU-043); si el proveedor falla, la orden no se afecta.

### HU-018 — Imprimir orden `[CONFIRMADA]` — M
**Como** usuario con `vOrden`, **quiero** imprimir/PDF la orden con encabezado de empresa, **para** entregar comprobante físico.
- RF: RF-027 · RB: RB-005 · RNF-P-04/C-02
1. **Entonces** el documento incluye cliente, orden, líneas, totales (2 decimales), fechas dd/mm/aaaa y datos+logo de empresa, con paginación.

### HU-019 — Facturar orden `[CONFIRMADA]` — M 🚧RB-003
**Como** usuario con `eOrden`, **quiero** facturar la orden una sola vez, **para** que genere su ingreso financiero.
- RF: RF-028 · RB: RB-003/027/009
1. **Cuando** facturo una orden no facturada, **entonces** en una transacción: se crea `movimientos_financieros` (tipo ingreso, valor = `valor_total`), `ordenes_trabajo.lanzamiento_id` lo enlaza y `facturado = true`.
2. **Dado** `facturado = true`, **cuando** intento facturar de nuevo, **entonces** se rechaza: «La orden ya fue facturada.»
3. **Entonces** la acción queda auditada. No existe “desfacturar” (SP).

### HU-020 — Autocompletado de órdenes `[CONFIRMADA]` — M
**Como** usuario con `aOrden/eOrden`, **quiero** autocompletado de clientes, productos, servicios, usuarios y términos de garantía, **para** capturar rápido y sin errores.
- RF: RF-029 · RNF-U-04
1. **Cuando** escribo 2+ caracteres en cualquier buscador del formulario, **entonces** aparece la lista filtrada; la selección rellena precio/datos correspondientes.

### HU-021 — Equipos en la orden 🚧 `[INFERIDA — tabla equipos_orden]` — S
**Como** usuario con `eOrden`, **quiero** vincular equipos del cliente a la orden con defecto declarado, defecto encontrado y solución, **para** dejar el diagnóstico por equipo.
- RF: RF-031 · OQ-02
1. **Entonces** solo se listan equipos del cliente de la orden; los 3 campos por equipo quedan visibles en el detalle y en la impresión (HU-018) `[INFERIDA]`.

---

## 9. E7 — Ventas

### HU-022 — Crear venta con productos y descuento `[CONFIRMADA]` — M
**Como** usuario con `aVenta`, **quiero** registrar una venta de productos (cantidad/precio/subtotal), con cliente, usuario, fecha, descuento y total, **para** facturar mostrador.
- RF: RF-032/033/034/037 · RB: RB-019/017/002/021
1. **Entonces** `valor_total = Σ subtotales − descuento` (≥ 0) recalculado por backend, con stock ajustado por línea (HU-011) y snapshot de precios.
2. **Cuando** el descuento supera el subtotal, **entonces** se rechaza con mensaje.

### HU-023 — Facturar venta `[CONFIRMADA]` — M 🚧RB-004
**Como** usuario con `eVenta`, **quiero** facturar la venta una sola vez, **para** crear su ingreso financiero vinculado.
- RF: RF-035 · RB: RB-004/027
1. **Cuando** facturo, **entonces** se crea el movimiento (ingreso, valor total), `ventas.lanzamiento_id` y `movimientos_financieros.venta_id` quedan vinculados y `facturado = true`.
2. **Dado** `facturado = true`, **cuando** reintento, **entonces** se rechaza con mensaje claro.

### HU-024 — Imprimir venta `[CONFIRMADA]` — M
**Como** usuario con `vVenta`, **quiero** imprimir/PDF la venta con datos de empresa, **para** entregar el comprobante.
- RF: RF-036 · RB: RB-005
1. Igual que HU-018 con los datos de la venta (ítems, descuento, total).

---

## 10. E8 — Garantías

### HU-025 — Términos de garantía `[CONFIRMADA]` — M
**Como** usuario con `a/e/d/vGarantía`, **quiero** mantener términos (referencia, texto, fecha, usuario), **para** estandarizar condiciones.
- RF: RF-038 · RB: RB-022
1. **Entonces** cada término registra fecha y usuario creador; eliminar un término usado por órdenes se rechaza.

### HU-026 — Asociar e imprimir garantía `[CONFIRMADA]` — M
**Como** usuario con `eOrden`/`vGarantía`, **quiero** asociar un término a la orden e imprimirlo, **para** entregar el certificado al cliente.
- RF: RF-039/040 · RB: RB-005
1. **Cuando** en la orden elijo el término (autocompletado HU-020), **entonces** `garantia_id` queda guardado.
2. **Cuando** imprimo el término, **entonces** sale en PDF con encabezado de empresa.

---

## 11. E9 — Financiero

### HU-027 — CRUD de movimientos financieros `[CONFIRMADA]` — M
**Como** usuario con `a/e/d/vMovimiento`, **quiero** crear/editar/eliminar movimientos (descripción, valor, vencimiento, pago, pagado, cliente/proveedor, forma de pago, tipo, anexo, vínculos opcionales cliente/categoría/cuenta/venta), **para** llevar ingresos y egresos.
- RF: RF-041/042/048 · RB: RB-014/016/008
1. **Cuando** guardo un movimiento `pagado = true`, **entonces** se exige `fecha_pago` (RB-014) y categoría/cuenta del tipo coincidente (RB-016).
2. **Entonces** los movimientos creados por facturación (HU-019/023) aparecen aquí con su vínculo visible.

### HU-028 — Filtros, totales y vencidos `[CONFIRMADA]` — M
**Como** usuario con `vMovimiento`, **quiero** filtrar por período (día/semana/mes/año/todos) y situación (todos/previsto/atrasado/realizado/pendiente) con totales, **para** conocer la posición financiera.
- RF: RF-043/044/045/046 · RB: RB-025/026
1. **Entonces** los totales del período mostrado se calculan en backend (ingresos, egresos, saldo `[INFERIDA]`).
2. **Entonces** los no pagados con vencimiento anterior a hoy se marcan como atrasados/vencidos, también en el Panel.

### HU-029 — Categorías y cuentas 🚧 `[INFERIDA — tablas categorias/cuentas]` — S
**Como** usuario con `aMovimiento`, **quiero** dar de alta/edición/desactivación de categorías y cuentas (banco, número, saldo, tipo, estado) dentro del módulo Financiero, **para** clasificar movimientos.
- RF: RF-047 · RB: RB-016 · OQ-02
1. **Entonces** en el formulario de movimiento solo aparecen categorías/cuentas activas del tipo correcto.

---

## 12. E10 — Archivos/Documentos

### HU-030 — CRUD de documentos con carga `[CONFIRMADA]` — M
**Como** usuario con `a/e/d/vArchivo`, **quiero** crear documentos con archivo subido (nombre, descripción, categoría, tipo, tamaño, fecha), **para** centralizar la documentación del taller.
- RF: RF-049/050/051 · RB: RB-034
1. **Cuando** subo un archivo, **entonces** quedan persistidos `archivo`, `ruta`, `url`, `fecha_registro` y `tamaño` automáticos.

### HU-031 — Descargar y organizar documentos `[CONFIRMADA]` — M
**Como** usuario con `vArchivo`, **quiero** filtrar por categoría y descargar cualquier documento, **para** usarlos offline.
- RF: RF-052/053
1. **Entonces** el listado permite agrupar/filtrar por `categoria` y cada fila tiene «Descargar» con control de permisos.

---

## 13. E11 — Usuarios

### HU-032 — CRUD de usuarios `[CONFIRMADA]` — M
**Como** usuario con `aUsuario/eUsuario/dUsuario`, **quiero** mantener usuarios (nombre, RG, CPF, dirección, correo, contraseña con hash, teléfonos, estado, fechas), **para** controlar quién opera.
- RF: RF-054/055 · RB: RB-011/022
1. **Cuando** creo un usuario, **entonces** la contraseña queda hasheada y `fecha_registro` automática; el correo es único (login).
2. **Entonces** nunca se muestra la contraseña almacenada.

### HU-033 — Estado, expiración y asignación de permisos `[CONFIRMADA]` — M
**Como** usuario con `eUsuario`, **quiero** activar/desactivar usuarios, fijar `fecha_expiracion` y asignar grupo de permisos, **para** limitar accesos en el tiempo y por función.
- RF: RF-056/057/058 · RB: RB-023/024
1. **Dado** usuario inactivo o con fecha de expiración superada, **cuando** intenta login, **entonces** es rechazado con mensaje.
2. **Cuando** cambio su grupo, **entonces** su menú y accesos quedan alineados al nuevo grupo sin otros pasos.

---

## 14. E12 — Permisos

### HU-034 — CRUD/desactivación de grupos de permisos `[CONFIRMADA]` — M
**Como** usuario con `aPermiso/ePermiso`, **quiero** crear, editar y **desactivar** grupos (nombre, códigos, estado, fecha), **para** definir perfiles de acceso.
- RF: RF-059 · RB: RB-023/006
1. **Dado** grupo desactivado con usuarios asignados, **entonces** esos usuarios pierden el acceso (RB-023) y el admin ve la advertencia al desactivar.

### HU-035 — Editor de códigos de actividad `[CONFIRMADA]` — M
**Como** usuario con `ePermiso`, **quiero** marcar/desmarcar para cada módulo cubierto los códigos a/e/d/v/r/c — 14 módulos: Cliente, Producto, Servicio, Orden, Venta, Garantía, Movimiento, Archivo, Usuario, Permiso, Respaldo, Auditoría, Email, Empresa — **para** construir el permiso exacto.
- RF: RF-060/061 · RB: RB-029
1. **Entonces** la UI presenta matriz 6×14 (etiquetas en español, p. ej. «Agregar Cliente (aCliente)») y guarda los códigos en el formato elegido (coma/JSON, RB-029).
2. **Entonces** los códigos de «Respaldo» quedan disponibles como reservos sin inventar pantalla funcional (🚧OQ-06).

### HU-036 — Aplicación real de permisos `[CONFIRMADA]` — M
**Como** administrador, **quiero** que cada código controle su acción dentro y fuera de la UI, **para** que el modelo de permisos sea vinculante.
- RF: RF-006 · RB: RB-006/031/032
1. **Dado** usuario sin `dCliente`, **cuando** su sesión llama la API de borrado, **entonces** RLS/RPC la rechazan (403/0 filas), no solo se oculta el botón.
2. Matriz completa (módulo × acción) cubierta por suite automatizada.

---

## 15. E13 — Informes/Reportes

### HU-037 — Reportes por módulo, modo rápido `[CONFIRMADA]` — M
**Como** usuario con `rCliente/rProducto/rServicio/rOrden/rVenta/rMovimiento`, **quiero** reportes de clientes, productos (incluido stock bajo), servicios, órdenes, ventas y financieros con “todos los registros”, **para** obtener el dato completo sin configurar filtros.
- RF: RF-062/063
1. **Entonces** existe una pantalla/acción de reporte para cada una de las 6 familias con versión rápida funcional.

### HU-038 — Reportes personalizados con filtros `[CONFIRMADA]` — M
**Como** usuario con `r<Módulo>`, **quiero** filtrar por fecha inicial/final, precio inicial/final y stock inicial/final (donde aplique) y en órdenes además estado/cliente, **para** mirar solo el segmento deseado.
- RF: RF-063/064
1. **Entonces** los 5 tipos de filtro exigidos por SP están disponibles; la combinación fecha+estado+cliente es posible en órdenes.

### HU-039 — PDF con encabezado de empresa `[CONFIRMADA]` — M
**Como** usuario, **quiero** que cualquier reporte se vea en línea y se descargue como PDF con datos tabulados y paginación, **para** distribuirlo formalmente.
- RF: RF-065/066 · RB: RB-005/007/008 · RNF-P-04
1. **Entonces** el PDF lleva encabezado de empresa (nombre, documentos, dirección, teléfono/correo, logo) en cada página y paginación correcta.
2. **Entonces** las vistas muestran fechas dd/mm/aaaa e importes con 2 decimales.

---

## 16. E14 — Auditoría

### HU-040 — Registro automático de acciones `[CONFIRMADA]` — M
**Como** administrador, **quiero** que las acciones relevantes queden registradas con usuario, tarea, fecha, hora e IP, **para** trazabilidad.
- RF: RF-067 · RB: RB-009/028
1. **Cuando** ocurre una acción del conjunto RB-009, **entonces** existe la fila correspondiente en `logs_auditoria`, generada por el backend (no por un clic del usuario).

### HU-041 — Listar y limpiar logs `[CONFIRMADA]` — M
**Como** usuario con códigos de Auditoría, **quiero** listar los logs (paginados, filtrables) y ejecutar «Limpiar logs», **para** revisar y depurar la bitácora.
- RF: RF-068/069 · RB: RB-009
1. **Cuando** limpio logs, **entonces** la confirmación es explícita y la propia limpieza queda registrada antes del borrado `[RECOMENDADA]`.

---

## 17. E15 — Cola de emails

### HU-042 — Crear y administrar emails en cola `[CONFIRMADA]` — M
**Como** usuario con `aEmail/vEmail/dEmail`, **quiero** crear emails con para/cc/cco/mensaje/encabezados, ver su estado y eliminarlos, **para** gestionar la comunicación.
- RF: RF-070/071/074 · RB: RB-015
1. **Cuando** creo un email, **entonces** nace `pendiente` con fecha automática; los estados posibles son solo los 4 SP.

### HU-043 — Procesar y reintentar la cola `[CONFIRMADA]` — M 🚧OQ-01
**Como** el sistema, **quiero** procesar los pendientes (enviando→enviado/fallido) y reintentar los fallidos, **para** que la comunicación no dependa de la suerte del momento.
- RF: RF-072/073 · RB: RB-015 · RNF-A-02
1. **Cuando** el procesador toma un pendiente, **entonces** marca `enviando`; al confirmar el proveedor, `enviado`; ante error, `fallido`.
2. **Cuando** un email `fallido` se reintenta (botón y/o job acotado), **entonces** vuelve a `enviando`; el fallo nunca afecta la operación de negocio origen (HU-017).

---

## 18. E16 — Portal del cliente

### HU-044 — Ingreso al portal `[CONFIRMADA]` — M
**Como** cliente, **quiero** entrar con mi correo y documento en una pantalla separada, **para** ver mis cosas sin clave.
- RF: RF-075 · RB: RB-012/032
1. **Dado** un par correo+documento que coincide con un cliente registrado, **cuando** lo ingreso, **entonces** se crea una sesión de cliente con acceso exclusivo al portal (RLS de rol cliente).
2. **Dado** datos que no coinciden, **entonces** el acceso se deniega con mensaje; nada de datos visibles.

### HU-045 — Mis compras y mis órdenes `[CONFIRMADA]` — M
**Como** cliente, **quiero** ver mis últimas compras (ventas) y órdenes con su detalle, **para** consultar el estado de mi servicio.
- RF: RF-076/077 · RB: RB-032
1. **Entonces** el panel lista las ventas y órdenes propias (filtradas por mi `id_cliente` vía RLS), con detalle de líneas, estado, fechas y totales.
2. **Entonces** no puedo ver ni un registro de otro cliente (prueba RLS dedicada).

### HU-046 — Imprimir, editar cuenta y salir `[CONFIRMADA]` — M
**Como** cliente, **quiero** imprimir mis documentos, revisar/editar mis datos de cuenta y cerrar mi sesión, **para** completar mi autogestión.
- RF: RF-078/079/080 · RB: RB-005/013
1. **Cuando** imprimo mi orden o compra, **entonces** el PDF tiene el mismo formato con datos de empresa.
2. **Cuando** edito mis datos (teléfono, celular, dirección), **entonces** solo puedo modificar los campos de contacto permitidos — correo/documento quedan bloqueados (🚧OQ-05).
3. **Cuando** cierro sesión, **entonces** el portal queda inaccesible hasta nuevo ingreso.

---

## 19. E17 — Configuración de empresa

### HU-047 — Datos de la empresa `[CONFIRMADA]` — M
**Como** usuario con `aEmpresa/eEmpresa` (o `cEmpresa`), **quiero** crear/editar nombre, CNPJ, IE, dirección, teléfono, correo, **para** identificar al taller.
- RF: RF-081 · RB: RB-030/009
1. **Entonces** la edición queda auditada; no se admite una segunda empresa (registro único).

### HU-048 — Logo en PDFs `[CONFIRMADA]` — M
**Como** usuario con permisos de Empresa, **quiero** cargar el logo (`url_logo`), **para** que aparezca en reportes y documentos.
- RF: RF-082 · RB: RB-005
1. **Cuando** actualizo el logo, **entonces** los siguientes PDF (reportes, órdenes, ventas, garantías, portal) lo muestran sin regenerar configuraciones adicionales.

---

## 20. Validación y estado de las historias

- **🚧 (dependencias OQ):** HU-003/008/021/029 (OQ-02), HU-005/009/012 (OQ-03), HU-011/015 (OQ-01), HU-019/023 (RB-003/004 confirmadas — sin brecha), HU-035 (OQ-06), HU-043 (OQ-01), HU-046 (OQ-05). Son detalles de interpretación permitidos por la cláusula de inferencia de SP; **ninguna pone en riesgo el alcance**.
- **Prioridad:** dado que SP exige el sistema **completo** (“sin agregar ni quitar funcionalidades”), todo lo `[CONFIRMADA]` es Must (M). Las S son tablas/funcionalidades exigidas por el modelo SP pero sin bullet de UI propio (equipos, categorías/cuentas, sesiones): **no son opcionales**; se construyen para no “omitir tablas/relaciones”.
- Fuera del alcance por mandato SP (“no inventar”): cualquier historia no derivable textualmente de SP. Si AG-001 solicitara capacidades adicionales, se tramitan como cambio de alcance con nueva versión de estos documentos.
- Cada historia es verificable por sus CA + DoD + la matriz RB→prueba de `BUSINESS_RULES.md` §6. Las historias pueden iniciarse por módulo en el orden de dependencias del diseño (módulos maestros → transaccionales → portal/reportes), sin bloqueadores de dominio (a diferencia de v1.x, SP elimina toda incertidumbre de negocio).
