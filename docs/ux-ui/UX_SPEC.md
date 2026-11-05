# Especificación UX/UI — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0004 — UX/UI Design |
| Autor | AG-006 UX/UI Designer |
| Fecha | 2026-11-05 |
| Versión | 1.0 |
| Fuente de verdad | `docs/requirements/SOURCE_PROMPT.md` (SP) |
| Insumos | RF-001…082, RB-001…036, RNF-*, HU-001…048, `docs/architecture/ARCHITECTURE.md`, catálogo de pantallas `SCREEN_CATALOG.md` |
| Stack UI | React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui + Supabase. Motor PDF jsPDF (`ADR-012`) `[Heredada]` |

---

## 1. Principios de diseño

| # | Principio | Deriva de |
|---|---|---|
| P-1 | **Panel administrativo clásico**: barra lateral + barra superior, tablas densas, formularios, modales y paginación. Sin estilos decorativos ni dashboards «fancy». | SP §DISEÑO `[Heredada]` |
| P-2 | **Español en 100 % de la interfaz** (etiquetas, badges, vacíos, errores, confirmaciones, PDF). | SP §STACK, RNF-U-01 |
| P-3 | **El menú es el permiso**: cada módulo se muestra solo si el usuario posee `v<código>`; acciones según a/e/d/r/c. Ocultar no autoriza (RLS/RPC re-verifican). | RB-006, RB-029, ADR-006 |
| P-4 | **Formatos invariables**: fechas `dd/mm/aaaa`; importes con 2 decimales; símbolo de moneda centralizado (por defecto `R$`, E-06). Prohibido renderizar fechas/importes sin `shared/lib/formato.ts`. | RB-007, RB-008, E-06 |
| P-5 | **Cero escritura directa de datos derivados**: stock y valor_total se muestran como lectura; toda mutación pasa por RPC (UI nunca «calcula y guarda»). | RB-002/018, ADR-007 |
| P-6 | **Responsive con prioridad desktop-móvil**: el taller usa escritorio; el portal también debe usarse en móvil. | RNF-U-02 `[Inferida]` |
| P-7 | **Feedback siempre en español**: toast de éxito, toast de error traducido, validación inline, estados de carga/vacío con skeleton/EmptyState. | RNF-U-02, RB-022 |

---

## 2. Design tokens (Tailwind + shadcn/ui)

Los tokens se expresan como variables del tema shadcn (`--primary`, etc.) en `src/index.css`; valores concretos `[Inferida]` con justificación de contraste AA (RNF «responsive y legible»).

### 2.1 Color

| Token | Valor de referencia | Uso |
|---|---|---|
| `--background` | `#f8fafc` | Fondo de aplicación |
| `--foreground` | `#0f172a` | Texto |
| `--primary` | `#2563eb` (azul 600) | Botones primarios, enlaces activos, menú item activo |
| `--primary-foreground` | `#ffffff` | Texto sobre primario |
| `--secondary` | `#f1f5f9` | Botones secundarios, headers de tabla |
| `--muted-foreground` | `#64748b` | Texto de apoyo, metadatos |
| `--destructive` | `#dc2626` | Eliminar, egresos, error |
| `--border` | `#e2e8f0` | Bordes de cards/tablas |
| Badges de estado (orden) | Presupuesto `#64748b` · Abierta `#2563eb` · En Proceso `#f59e0b` · Finalizado `#16a34a` · Cancelado `#dc2626` · Aguardando Piezas `#a855f7` | `ordenes_trabajo.estado` (RB-010) |
| Badges de situación financiera | Previsto `#64748b` · Atrasado `#dc2626` · Realizado `#16a34a` · Pendiente `#f59e0b` | RB-025/026 |
| Badges de cola de emails | pendiente `#64748b` · enviando `#2563eb` · enviado `#16a34a` · fallido `#dc2626` | RB-015 |

> Los colores de badge son presentación; el valor guardado es siempre el texto literal SP (RB-010/RB-015) — nunca se coloca un código interno visible.

### 2.2 Tipografía

- Fuente: sistema (`system-ui`), 14 px base en panel (tablas densas) y 16 px en el portal (legibilidad móvil) `[Inferida]`.
- Escala: `text-sm` (tablas/labels), `text-base` (formularios portal), `text-lg/xl` (PageHeader), `font-semibold` para títulos; **no se usan más de 3 tamaños por pantalla**.

### 2.3 Espaciado, bordes y profundidad

- Espaciado múltiplo de 4 (`gap-2/4/6`); paddings de página `p-6` (panel) y `p-4` (portal móvil).
- Radios: `rounded-md` (botones/campos), `rounded-lg` (cards/modales).
- Elevación: solo `shadow-sm` en cards y `shadow-lg` en modales; sin otros `shadow` decorativos.
- Grid del panel: sidebar 240 px colapsable a iconos (≤ 1024 px) + contenido fluido `max-w-none`.

### 2.4 Densidad y datos

- Filas de tabla 44 px de alto, zebra opcional desactivada («panel clásico», `border-b` simple).
- Números alineados a la derecha (`tabular-nums`); textos a la izquierda; fechas centradas `[Inferida]`.
- Todo montaje numérico usa página «Página X de Y» + selector de tamaño `[Especificado en §5.1]`.

---

## 3. Layout de aplicación

### 3.1 Panel administrativo — `AdminLayout` (`/…` excepto portal y login)

```
┌────────────┬────────────────────────────────────────────────┐
│ SIDEBAR    │ TOPBAR: (☰) Breadcrumb / título · 🔍 global     │
│ (240 px)   │         · badge de Email/Branch [si vEmail]    │
│ ────────── │         · avatar + menú (perfil, Cerrar sesión) │
│ Panel      ├────────────────────────────────────────────────┤
│ Clientes   │  PageHeader: {título + acciones primarias}      │
│ Productos  │  Container: (FiltroBar | Tabs) + contenido      │
│ …)*        │  (DataTable | Ficha | Formulario)               │
│ ────────── │  (pie opcional de paginación)                   │
│ [avatar]   │                                                │
└────────────┴────────────────────────────────────────────────┘
(*) ítems listados tras filtrar por v<código> del usuario (RF-009).
```

**Comportamiento del sidebar**: colapsable con icono/etiqueta; guarda estado por sesión `[Inferida]`; item activo resaltado (`--primary` + `bg-accent`); agrupación sin «secciones inventadas» — lista plana de los 15 módulos admin + portal (SC-03 accesos rápidos) `[Inferida]`.

**Topbar**: muestra nombre del usuario conectado y su grupo de permisos (HU-004 CA3); «Cerrar sesión» SIEMPRE disponible; en móvil el sidebar se convierte en drawer sobre `Sheet`.

### 3.2 Portal del cliente — `PortalLayout`

- Barra superior simple: logo empresa + nombre; enlace «Mi cuenta»; «Cerrar sesión».
- Contenedor centrado `max-w-3xl`, cartas grandes táctiles (`min-h-11` para targets ≥ 44 px).
- **Sin sidebar administrativa y sin referencias al panel** (RB-032).

### 3.3 Breakpoints

| Rango | Comportamiento |
|---|---|
| ≥ 1280 px | sidebar fija + tablas completas |
| 1024–1279 | sidebar fija; columnas secundarias ocultas por prioridad (siempre quedan la clave y las acciones) |
| 768–1023 | sidebar en drawer; tablas se vuelven «tarjetas apiladas» por fila `[Inferida]` |
| < 768 | single column; modales a `Sheet` de pantalla completa; portal 100 % táctil |

---

## 4. Lenguaje visual de estados (Badges)

| Domínio | Elementos |
|---|---|
| `ordenes_trabajo.estado` | 6 badges por color (§2.1), texto literal SP |
| «Facturada» | Badge verde «Facturada» / neutro «No facturada» |
| «Stock bajo» | Badge ámbar con `AlertTriangle`; fila con `bg-amber-50` |
| Situación financiera | previsto/atrasado/realizado/pendiente; vencidos con fecha en rojo |
| Usuarios/permisos/categorías/cuentas/marcas | Badge «Activa»/«Inactiva» (booleano estado) |
| Emails | pendiente/enviando/enviado/fallido + contador de intentos |
| Sexo/persona física | texto simple («Femenino»/«Masculino», «Persona física»/«Persona jurídica») |

Reglas: un Badge **nunca** reemplaza al dato: aparecerá el valor literal SP y su color es secundario. Al leer por color se añade siempre texto (accesibilidad A11Y-2).

---

## 5. Componentes compartidos (especificaciones de interacción)

Ubicación: `src/shared/components/` (nombres y responsabilidades según `ARCHITECTURE.md` §6.1). Todos reciben textos ya en español desde `features/<módulo>/model`.

### 5.1 `DataTablePaginado` — tabla estándar (patrón C-1 del catálogo)

| Prop | Tipo | Descripción |
|---|---|---|
| `columns` | `ColumnDef<T>[]` | Encabezados en español; acciones como última columna pegajosa (sticky right) |
| `query` | hook TanStack | `['entidad', {filtros, pagina, porPagina}]`; `staleTime` 30 s `[ADR-010]` |
| `porPagina` | `25 (default) / 50 / 100` `[Inferida]` | Selector inferior |
| `acciones` | render con `PermissionGate` | a/e/d/imprimir etc. en `DropdownMenu` si > 2 acciones |

**Interacción**: paginación server-side (Skip/limit PostgREST, RNF-U-03); sort por columna opcional en maestros (ordenamiento alfabético por defecto `[Inferida]`); estados carga (skeleton de 10 filas) / vacío (EmptyState) / error (ErrorState con botón «Reintentar»). Fila no navegable a menos que `onRowClick` exista (ficha).

### 5.2 `FiltroBar`

- Fila responsive de controles: búsqueda textual (debounce 300 ms `[Inferida]`), Selects de filtros fijos (estado, situación, período, tipo, categoría, cuenta), `RangoFechas` (dd/mm/aaaa), botones «Filtrar» (aplica) y «Limpiar».
- Filtros que requieren clic (rango, selects con datos) usan el modo «aplicar»; el texto busca en vivo.
- Muestra chips de filtros activos con «×» individual — ayuda a no perder el contexto paginado («aplicado a 25 de N registros» — feedback `[Inferida]`).

### 5.3 `ModalFormulario` (shadcn Dialog + React Hook Form + zod)

| Aspecto | Especificación |
|---|---|
| Estructura | Título + descripción breve; cuerpo con `FormField`; pie: «Cancelar» (secondary) + «Guardar» (primary, muestra spinner/estado «Guardando…») |
| Validación | Inline en `onBlur`/submit; mensajes zod en español (RB-033); obligatorios marcados con «*» y nota «Los campos marcados con * son obligatorios» |
| Errores de negocio | Si la RPC rechaza (ej. `23505 «Ese valor ya está registrado.»`, `P0001 stock`, RB-022 RESTRICT): toast + error bajo el campo cuando se puede atribuir |
| Cierre | ESC / «×» / clic afuera: pide confirmación si hay cambios sin guardar (guard de dirty state) `[Inferida]` |
| Móvil | < 768 px se renderiza como Sheet full-height |

### 5.4 Formularios de ficha (página)

- Misma gramática que el modal, pero con secciones («Datos», «Vínculos», «Equipos», etc.) y `Tabs`.
- Sin autoguardado: siempre botón «Guardar» + nota de cambios sin guardar al salir (`useBlocker`) `[Inferida]`.
- Al guardar: invalidar queries del dominio + toast «✓ Guardado.» + auditoría por RPC (RB-009).

### 5.5 `Autocomplete` (Command + Popover)

- Usado para: cliente, producto, servicio, usuario/técnico, término de garantía, categoría, cuenta, marca (alta en línea).
- Datos por RPC `busqueda_*` (top 15, RNF-U-04). En líneas de orden/venta se fija el snapshot de nombre/precio al agregar (editable) — `productos_orden.descripcion/precio`, RF-018.
- Cero coincidencias: mensaje «Sin resultados para "<q>"» + acción contextual «Crear <q>» cuando el módulo lo permita (p. ej., marcas) `[Inferida HU-008 CA1]`.

### 5.6 `CampoMoneda` / `CampoFecha`

- `CampoMoneda`: input numérico con separadores; muestra `R$` prefijo; **siempre 2 decimales** (`redondear2`), contando centavos y visualizando con coma decimal (E-06).
- `CampoFecha`: Popover con calendario (~shadcn) mostrando siempre el value formateado `dd/mm/aaaa`; sin locales de Intl (formato manual, RNF-U-05/E-06); permitido teclado con máscara.

### 5.7 `SubirArchivo`

- Drag & drop + clic; valida tipo por whitelist de extensión y tamaño (20 MB por defecto; RB-034 sanitización del nombre).
- Muestra progreso, miniatura generada por canvas (256 px WebP, anexos de orden) y loader por carga.

### 5.8 `ConfirmDialog`

- Para «Eliminar <título>?» contorno: título «¿Confirmar eliminación?»; cuerpo con consecuencia («Esta acción no se puede deshacer»); botones «Cancelar» / «Eliminar» (destructive, destructive).
- Para «Limpiar logs de auditoría» cuerpo pregunta si requiere descarga previa (RF-069) `[Inferida]`.

### 5.9 `PermissionGate` + hooks

- `<PermissionGate code="dCliente">` y `usePermiso('aOrden')` leen el set del contexto de sesión; recursos ocultos no se ejecutan.
- Al navegar a ruta sin permiso: `PermisoGuard` redirige a `/` con toast «No tiene permiso para acceder a este módulo.» (RF-006/RB-006) `[Inferida mensaje]`.

### 5.10 `PageHeader` / `EmptyState` / `ErrorState`

- `PageHeader`: título H1 + subtítulo opcional + acciones alineadas a la derecha (botón primario «Nuevo …» condicionado por permiso).
- `EmptyState`: icono suave + «Aún no hay <entidad plural>.» + CTA «Agregar <entidad>» si hay permiso.
- `ErrorState`: mensaje genérico «Ocurrió un error al cargar los datos.» + detalle técnico trunco + «Reintentar» (jamás mensajes crudos de la BD al usuario; los códigos mapeados viven en `shared/lib/errores.ts`, ADR-010).

### 5.11 Motor PDF (impresiones y reportes)

- Componente `VistaPreviaPDF`: iframe/blob + botones «Descargar PDF» y «Volver» (RF-066).
- Encabezado por página: logo (`empresa.url_logo`) + nombre + CNPJ/IE + dirección + teléfono/correo (RB-005, RF-082). Pie: «Página N de M» + fecha de emisión `dd/mm/aaaa`.
- Datos tabulados con `jspdf-autotable`: columnas etiquetadas en español; importes 2 decimales; A4; lote de 200 filas (RNF-C-02, RNF-P-02).
- Identidad visual sobria: encabezado con barra fina `--primary` de 4 px `[Inferida]`.

### 5.12 Toasts (`sonner`)

- Éxito (verde) «✓ <acción> realizada con éxito.»; error (destructive) con el texto traducido; duración 4 s; apilables hasta 3 `[Inferida]`.

---

## 6. Patrones de pantalla por familia

### 6.1 Listado (`<módulo>` index)

```
PageHeader («Clientes», botón «Nuevo cliente»)
FiltroBar (búsqueda + filtros del módulo)
Card > DataTablePaginado (+ paginación)
```

Acciones de fila: **Ver → ficha**, **Editar → modal/ficha**, **Eliminar → ConfirmDialog**, **Imprimir/facturar/enviar** según módulo (`<PermissionGate>`).

### 6.2 Ficha con sub-recursos (cliente, orden, venta, usuario, permisos)

```
PageHeader (identidad + acciones del documento: Facturar | Imprimir | Enviar por correo)
Tabs:
  - «Datos» (formulario principal)
  - sub-recursos (Productos/Servicios/Equipos/Anexos/Vínculos…)
Pie de documento: Valor total (Lectura) + Estado (Badge)
```

Regla: **toda sub-tabla usa el mismo patrón 6.1 en miniatura** (líneas agregadas vía RPC con confirmación de stock, E-01).

### 6.3 Maestro simple (servicios, garantías, categorías, cuentas, marcas inline, permisos, documentos, emails, auditoría)

Listado + `ModalFormulario`; sin páginas de ficha dedicadas.

### 6.4 Formularios de configuración (empresa, cuenta portal)

- Formulario único en Card, con zonas de solo lectura explícitas (correo/documento de portal, E-05) y nota de resolución.
- Guardar con validación doble (zod + mensajes server traducidos).

### 6.5 Generador de reportes

- Elige familia → elige modo → define filtros → vista previa en iframe → descargar.
- Controles acotados a lo que SP exige: nada de filtros-fantasma no especificados (RF-064) — todos los inputs del formulario corresponden a un filtro real de `reporte_obtener`.

---

## 7. Accesibilidad

| # | Requisito | Aplicación |
|---|---|---|
| A11Y-1 | Navegación por teclado completa | Modales con foco inicial y retorno; Tab en tablas vía `roving` no obligatorio — enlaces de fila + menú de acciones |
| A11Y-2 | Color nunca como única señal | Badges siempre con texto: «Aguardando Piezas», «Atrasado», «fallido», etc. |
| A11Y-3 | Contraste AA en texto y badges (≥ 4.5:1 cuerpo, ≥ 3:1 grande) | tokens §2.1 elegidos para cumplirlo |
| A11Y-4 | Labels asociados (`htmlFor`) para todo input | shadcn `Label` + `FormField` |
| A11Y-5 | Roles ARIA de Dialog/AlertToast provistos por shadcn | Sin ARIA manual salvo en tablas (`role="table"`) |
| A11Y-6 | Foco visible (`focus-visible` ring 2 px `--primary`) | global |

---

## 8. Copywriting (glosario de textos UI)

Las frases de la interfaz se normalizan para evitar variaciones. Fuente única en `shared/lib/errores.ts` + constantes por feature.

| Contexto | Texto canónico |
|---|---|
| Eliminar | «¿Confirma que desea eliminar <entidad>? Esta acción no se puede deshacer.» |
| Restricción FK (RB-022) | «El registro tiene relaciones asociadas; no puede eliminarse.» |
| Duplicado | «Ese valor ya está registrado.» |
| Stock (E-01) | «Stock insuficiente. Disponible: X.» |
| Facturar segunda vez (RB-003/004) | «La orden ya fue facturada.» / «La venta ya fue facturada.» |
| Login fallido | «Correo o documento no coinciden» (portal) / «Credenciales inválidas.» (panel) |
| Usuario inactivo/expirado (RB-023/024) | «Su usuario está inactivo.» / «Su usuario ha expirado.» |
| Portal sin datos | «Aún no tiene órdenes registradas.» / «Aún no tiene compras registradas.» |
| Cambio de correo/documento portal (E-05) | «Para cambiar su correo o documento, contacte al taller.» |
| Permiso negado | «No tiene permiso para realizar esta acción.» |
| Guardado | «✓ Guardado con éxito.» / «✓ Cliente guardado.» (por entidad) |
| Envío por correo (RF-026) | «La orden fue enviada a la cola de emails.» |
| Procesar cola | «Se procesó la cola de emails.» |
| Vencimiento | «El movimiento está vencido.» |

---

## 9. Rendimiento y percepción

| Requisito | Mecanismo UX |
|---|---|
| RNF-P-01 (≤ 2 s P95) | skeletons inmediatos; debounce en búsquedas; `staleTime` 30 s en listados; paginación server-side |
| RNF-P-03 (bundle) | `React.lazy` por módulo; carga diferida de jsPDF solo en pantallas de PDF |
| RNF-U-03 (10 k filas) | Jamás `select('*')` sin límite en UI; todas las tablas paginadas |
| Optimismo | Solo para acciones idempotentes simples (badges de estado visual); todo lo atómico (stock, facturar) muestra spinner en el botón y **deshabilita doble envío** (RNF-A-01) |

---

## 10. Especificación visual del documento PDF (módulo compartido `shared/lib/pdf`)

```
┌────────────────────────────────────────────────────────────┐
│ [Logo]  TALLER <nombre>                    Emitido: dd/mm/aaaa
│         CNPJ: 00.000.000/0000-00 · IE: 000.000.000.000
│         Calle 000, Barrio — Ciudad/Provincia
│         Tel.: (00) 0000-0000  ·  contacto@taller.com        │
├────────────────────────────────────────────────────────────┤
│  Título del documento: «Orden de Trabajo #<id>»
│  Cuerpo: datos del documento (cliente, fechas, estado…)
│  Tabla(s): líneas con columnas etiquetadas en español,
│            importes 2 dec., subtotales + VALOR TOTAL
│  (garantía / laudo / observaciones si aplican)              │
├────────────────────────────────────────────────────────────┤
│  Página 1 de N                              Pie: <empresa>  │
└────────────────────────────────────────────────────────────┘
```

Se aplica a: impresión de orden, venta, garantía, 6 familias de reportes y documentos del portal (un único estilo — RB-005, RNF-C-02, RNF-P-04).

---

## 11. Estados y microinteracciones clave (resumen del catálogo)

| Flujo | Microinteracción |
|---|---|
| Agregar producto a orden/venta (RB-002) | Al confirmar cantidad: spinner en fila → si stock < cantidad: modal de error con «Stock insuficiente. Disponible: X.» y sugerencia «Cambiar estado a *Aguardando Piezas*» `[Escalado E-01]` → si ok: fila aparece con subtotal, stock del catálogo se refresca (badge «Stock bajo» si cruza el mínimo, RF-016) |
| Facturar (RB-003/004) | Botón «Facturar» disabled con tooltip cuando `facturado=true`; modal con forma de pago/categoría/cuenta → toast + Badge «Facturada» + vínculo «Ver movimiento» al Financiero (RF-047) |
| Cambiar estado de orden (RF-021) | Select con confirmación inline al pasar a Finalizado (sugiere `fecha_final` de hoy, editable) |
| Marcar pagado (RB-014) | Toggle en fila → si pagado=true exige fecha de pago en un mini-modal |
| Enviar correo (RF-026) | Modal con destinatario precargado (`clientes.correo`), asunto editable, «Enviar a la cola» → toast; en `/emails` verá el registro `pendiente` |
| Editor de permisos (RB-029) | Checkboxes a/e/d/v/r/c; al guardar se recalculan menús sin recarga (`PermisoProvider` invalida `auth_perfil`) |
| Login portal (RB-012) | Timeout/401 → mensaje genérico; no especifica cuál campo falló |

---

## 12. Wireframes de referencia (texto)

### 12.1 Ficha de orden (SC-10)

```
┌ Órdenes de trabajo / orden #id          [Facturar] [Imprimir] [Enviar por correo] ┐
│ Estado: [Select Presupuesto▾(badged)]   Facturada: (No facturada)
│ ┌── Datos ────────────────────────┐ ┌── Fechas ────────────────┐
│ │ Cliente* [Autocomplete]         │ │ Inicial* [01/03/2027]    │
│ │ Técnico  [Autocomplete]         │ │ Final    [__/__/____]    │
│ │ Garantía [Autocomplete garantías│ └──────────────────────────┘
│ │ Descripción producto [textarea] │
│ │ Defecto [textarea]              │
│ │ Observaciones [textarea]        │
│ │ Laudo técnico [textarea]        │
│ └─────────────────────────────────┘
│ [Productos | Servicios | Equipos | Anexos]
│   Agregar producto [Autocomplete salida=true] Cantidad [1] Precio [R$ 0,00] [Agregar]
│   ┌ Descripción ─ Cant ─ Precio ─ Subtotal ─ [×] ┐  ← mutaciones vía RPC (RB-002)
│ VALOR TOTAL: R$ 0,00 (calculado en BD, solo lectura)
└──────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Portal — panel del cliente (SC-P2)

```
┌ logo · Mi cuenta · Cerrar sesión ┐
│  ¡Hola, <nombre>!                │
│  [Mis últimas órdenes]  [Mis últimas compras]
│   · #id 01/03/2027 [Finalizado] R$ 250,00  [Ver] [Imprimir]
│   · #id 05/03/2027 [En Proceso] R$ 100,00  [Ver]
└──────────────────────────────────┘
```

---

## 13. Trazabilidad UX

| Sección de este documento | Cubre |
|---|---|
| §2 tokens / §3 layouts | RNF-U-01…03, SP §DISEÑO |
| §4 badges | RB-010/015/025/026 |
| §5 componentes | SP §DISEÑO (tablas, formularios, modales, paginación), RF-011/012 (búsqueda/paginación), RF-029 (autocompletado), RF-025/050/052 (archivos), RB-005/RF-065/066/082 (PDF), RB-006 (permisos UI), RB-033 (validación doble), RB-022 (mensajes) |
| §6 patrones | estructura de los 17 módulos (`SCREEN_CATALOG.md`) |
| §7 accesibilidad | RNF accesibilidad `[Inferida]` |
| §8 copy | RB-022/014/015/023/024/029, RF-075/079, E-01/05 |
| §9 rendimiento | RNF-P-01/03, RNF-U-03 |
| §10 PDF | RB-005, RF-065/066/082, E-06 (formato) |
| §11 microinteracciones | RB-002/003/004/014/017/018/019, RF-016/021/026/047, E-01 |
| §12 wireframes | SC-10, SC-P2 |

**Declaración de alcance**: esta especificación no agrega módulos, procesos, tablas ni reglas fuera de SP. Todo elemento marcado `[Inferida]` es la opción más simple consistente con SP; los escalamientos E-01…E-09 heredados de `ARCHITECTURE.md` §16 condicionan los comportamientos indicados en §6.2, §8 y §11 de esta fuente.
