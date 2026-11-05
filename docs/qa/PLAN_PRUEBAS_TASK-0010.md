# Plan de Pruebas QA — TASK-0010 (AG-012)

Proyecto: **Sistema Taller** — fecha: 2026-11-05.
Fuente de verdad: `docs/requirements/SOURCE_PROMPT.md` (todos los módulos y reglas de negocio).
Alcance: suite de QA reproducible con **Vitest** (`npm test`), archivos en `tests/` y
`src/test/` (estos últimos ya existían de tareas previas), con Supabase simulado
(`tests/helpers/supabaseFalso.ts`) — **sin datos de producción en riesgo** (RB-001).

## 1. Estrategia

| Nivel | Carpeta | Qué cubre | Tecnica |
| --- | --- | --- | --- |
| Unitario (existente) | `src/test/**` | utilidades puras: dinero, fechas, validaciones, permisos, situación financiera, cola de emails, cliente Supabase | funciones puras |
| Unitario (nuevo) | `tests/unit/crud.test.ts` | fábrica CRUD compartida por todos los módulos (listar paginado, búsqueda, filtros, orden, obtener, crear, editar, eliminar, contar) + `llamarRpc` | Supabase simulado |
| Integración (nuevo) | `tests/integration/**` | flujos críticos de los servicios con contratos verificables | Supabase simulado + registro de llamadas |
| Conservación (nuevo) | `tests/esquema/alineacion-prompt.test.ts` | el esquema, las RPCs y las 17 pantallas coinciden con SOURCE_PROMPT.md (nada omitido ni inventado) | análisis del SQL real + módulos |

Principios:

- **Mock de Supabase** (`tests/helpers/supabaseFalso.ts`): replica el subconjunto
  usado por la app (PostgREST builder thenable, `rpc`, `functions.invoke`,
  `auth`, `storage`) y **registra todas las llamadas**, de modo que cada prueba
  verifica: nombre de RPC de la migración 0004, argumentos exactos, bucket de
  Storage, estado final de filas, y órdenes de estado de la cola de emails.
- **Sin red**: `vi.mock("../../src/lib/supabase")` sustituye el cliente; ninguna
  prueba toca un Supabase real ni datos de producción.
- Entorno `node` por defecto; `jsdom` solo para el portal del cliente (sesión
  con `localStorage`).

## 2. Flujos críticos cubiertos y su correspondencia con el SOURCE_PROMPT

### Órdenes de trabajo (§5)
- Alta: `validarOrden` rechaza sin cliente/usuario/estado/fecha establecida; mensajes en español.
- Estados del dominio `Presupuesto, Abierta, En Proceso, Finalizado, Cancelado, Aguardando Piezas`; estado inválido rechazado.
- **Stock (RB-002/017/020)**: `orden_agregar_producto` recibe orden, producto, cantidad y precio; `orden_cambiar_cantidad_producto` y `orden_quitar_producto` con sus argumentos; cantidad ≤ 0 se rechaza **antes** de la base.
- Líneas de servicio: subtotal con redondeo a 2 decimales (RB-019/extensión); servicios no tocan stock.
- Valor total = Σ subtotales (coincide con el trigger f_recalcular_total_orden).
- **Facturación única (RB-003/027)**: `orden_facturar` con sus 5 parámetros; segundo intento bloqueado por la BD sube como error en español.
- **Envío por correo**: inserta en `cola_emails` con `estado='pendiente'` y encabezados `orden:<id>`; orden inexistente → «Orden inexistente.»
- **Anexos**: subida al bucket privado `anexos-orden` con ruta `\<orden\>/<uuid>-<nombre sanitizado>`; baja borra el objeto y la fila.

### Ventas (§6)
- Alta con fecha por defecto = hoy; fecha ISO inválida rechazada.
- Descuento ≥ 0 (RB-019: `valor_total = Σsubtotales − descuento`, no menor que cero — caso límite probado).
- **Stock por RPC**: `venta_agregar_item` / `venta_cambiar_cantidad_item` / `venta_quitar_item` con argumentos exactos.
- **Facturación única (RB-004/027)**: `venta_facturar` con parámetros; reintento bloqueado en BD.

### Financiero (§8)
- Reglas de alta: descripción obligatoria; tipo ∈ {ingreso, egreso}; valor > 0; **RB-014** pagado exige fecha de pago.
- Edición parcial (solo descarta la descripción) con rechazos.
- **Filtros por situación** (todos/previsto/atrasado/realizado/pendiente) según regla de la vista `v_movimientos_situacion`.
- **Totales por período con 2 decimales** (ingresos, egresos, saldo), vencidos, pendientes y paginación en memoria.
- `mov_marcar_pagado` con argumentos exactos.
- Listados auxiliares devuelven **solo** categorías/cuentas activas.

### Cola de emails (§14)
- Alta con validación de destinatario/cc/cco/mensaje (errores en español); estado inicial `pendiente`.
- **Procesar cola**: transición pendiente → enviando → enviado; con fallo → `fallido` + causa en `encabezados` (reintento posterior).
- **Sin Edge Function la cola no se cuelga;** estados en pantalla; estados fuera del dominio rechazados; eliminar.

### Autenticación administrativa (§ «Autenticación y sesiones»)
- Credenciales inválidas → «Correo o contraseña incorrectos.» (traduce el error de Supabase).
- Guards: usuario sin fila/inactivo → `signOut` + «Usuario inexistente o inactivo.»; grupo de permisos inactivo → mensaje específico.
- Login exitoso: expone **códigos de actividad** del grupo (los usa el menú) y llama `sesion_registrar` (12 h admin); sin RPC de sesiones el login no se bloquea.
- Cerrar sesión: `sesion_cerrar` + `signOut`.

### Portal del cliente (§15, RB-032/033)
- Ingreso por **correo + documento** con mensajes del prompt; coincidencia insensible a mayúsculas; vía Edge Function `portal-login` hace `setSession`.
- **Expiración de sesión**: 24 h; sesión expirada descartada y borrada de `localStorage`; sin sesión → null.
- El cliente solo ve **sus** órdenes/ventas/detalles (filtra `cliente_id`; ajeno → null).
- **Correo/documento inmutables** (E-05/RF-079) con mensaje explícito; solo campos permitidos se actualizan.
- Cerrar sesión borra la sesión local y hace `signOut`.

### CRUD genérico (contrato compartido por Clientes/Productos/Servicios/…)
- Listar: paginado, `count exact`, páginas, búsqueda `q` ilike-OR, filtros (vacíos ignorados), orden.
- obtener (null si no existe) / crear (PK autogenerada) / editar / eliminar / contar con filtros.
- `llamarRpc`: resultado, traducción de errores, RPC no desplegada → null.

### Conservación del SOURCE_PROMPT (`tests/esquema`)
- **23 tablas** del modelo de datos (nombres en español) presentes en 0001/0002.
- **15 RPCs de negocio** de 0004 (stock, facturar ×2, marcar pago, logs, sesiones, permisos, stock manual).
- Vista `v_movimientos_situacion` (filtros financieros).
- Códigos de actividad §11: 6 acciones (a/e/d/v/r/c) × **14 módulos exactos** = 84 códigos.
- Las **17 pantallas** de los módulos obligatorios existen en `src/pages/`.

## 3. Fuera de alcance explícito de esta tarea

- Componentes React/shadcn en profundidad (requiere `@testing-library/react` + jsdom en pantalla; los entregables de QA de esta tarea se centran en servicios/reglas).
- RLS real contra PostgreSQL/Supabase (requiere coordinación de proyecto; el mock local no puede validar políticas de RLS).
- PDFs: `src/lib/pdf.ts` depende de jsPDF en navegador; cobertizado solo por la prueba de referencia de la base esquema.
- No se ejecutan pruebas contra datos de producción (regla «No eliminar datos de producción durante pruebas»).

## 4. Cómo ejecutar

```bash
npm test        # vitest run (config: vitest.config.ts)
```

## 5. Estado de ejecución (importante)

⚠️ **Las pruebas fueron creadas pero NO se han ejecutado en este entorno**: el
ejecutor de comandos (`shell`) fue rechazado por el sistema de permisos de esta
sesión (se intentó `npm test`, `npx vitest run`, incluso `npm --version`).
Por política de AG-012, no se declara PASS sin ejecución: el estado de la
entrega es **«escrita y revisada estáticamente, pendiente de ejecución»**.
Quien integre la tarea debe correr `npm test` y volcar el resultado en el
reporte; cualquier rojo debe resolverse antes de cerrar TASK-0010.
