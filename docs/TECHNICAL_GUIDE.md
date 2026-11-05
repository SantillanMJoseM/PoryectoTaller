# Guía Técnica — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0016 — Documentación |
| Fuente de verdad | `docs/requirements/SOURCE_PROMPT.md` (SP) |
| Documentos complementarios | `docs/architecture/ARCHITECTURE.md`, `docs/database/DATA_MODEL.md`, `docs/database/MIGRATIONS.md`, `docs/database/RLS_POLICIES.md`, `docs/deployment/DEVOPS.md` |

Guía técnica de la implementación real contenida en este repositorio: stack vigente, estructura de código, modelo de datos, seguridad y operaciones. No se documentan como implementados componentes que no están en el repo (se señalan aparte en §8).

## 1. Stack (instalado en `package.json`)

| Componente | Versión | Uso en el proyecto |
|---|---|---|
| React | 19.3 | SPA del panel + portal |
| TypeScript | ~7.0 (strict) | todo el código de aplicación |
| Vite | 5.4 | build/dev server |
| Tailwind CSS | 4.3 | estilos (`@tailwindcss/vite`) |
| shadcn/ui (`@base-ui/react` + componentes en `src/components/ui`) | 1.9 / propios | input, button, card, table, dialog, select, badge, label, textarea |
| `@supabase/supabase-js` | 2.119 | único backend (Postgres + Auth + Storage) |
| `react-router-dom` | 7.18 | rutas y guards |
| `jspdf` | 4.2 | PDFs de reportes, órdenes, ventas, garantías |
| `lucide-react` | 1.69 | iconografía |
| oxlint / vitest | 1.90 / 4.1 | lint y pruebas |

## 2. Estructura del código

```
src/
  main.tsx, App.tsx         # bootstrap y ruteo con guards
  contexts/AuthContext.tsx  # sesión (Supabase Auth + ficha «usuarios» + permisos + «sesiones»)
  pages/                    # LoginPage, Dashboard, Portal + 14 módulos del panel
  components/               # Layout (sidebar/menú por permisos), CrudPage, SimpleCrud,
                            # ConfirmDialog, SimpleSelect, ui/* (shadcn)
  services/                 # capa de datos por módulo (ver §2.1)
  lib/                      # utilidades y contrato con Supabase (ver §2.2)
  test/                     # unitarias de utilidades puras
tests/                      # QA: integración/esquema con Supabase simulado
supabase/migrations/…       # 0001–0005 (esquema, RLS, negocio, Storage)
supabase/seed.sql           # datos de ejemplo idempotentes
```

### 2.1 Servicios (`src/services/`)

| Servicio | Módulo | Notas clave |
|---|---|---|
| `autenticacion.ts` | 1 | `iniciar/cerrar/sesionActual/puede`; registra fila en `sesiones` vía RPC `sesion_registrar`; `crearCredencial` para altas en Auth |
| `panel.ts` | 2 | `resumen()` (órdenes abiertas, stock bajo, últimas ventas, movimientos pendientes), `ordenesPorEstado()`, accesos rápidos |
| `clientes.ts` | 3 | CRUD + `autocompletar` + `vinculos` (órdenes/ventas/financiero/garantías) |
| `productos.ts` | 4 | CRUD + `alertaStock` (vistas de stock bajo) + `habilitadosSalida`/`autocompletar`; el stock lo mueve la BD |
| `servicios.ts` | 5 | CRUD + autocompletar |
| `ordenes.ts` | 6 | Listado filtrado, líneas de productos/servicios por RPC (stock), `cambiarEstado`, `facturar` (RPC `orden_facturar`), anexos (`anexos-orden`), `enviarPorCorreo` (desencola en `cola_emails`), impresión |
| `ventas.ts` | 7 | Listado filtrado, ítems por RPC (stock), descuento/total, `facturar` (RPC `venta_facturar`), impresión |
| `garantias.ts` | 8 | CRUD + `asociarAOrden` |
| `financiero.ts` | 9 | `listarFiltradas` (período/situación/tipo/cliente/categoría/cuenta/q + paginación + totales + vencidos), `marcarPagado` (RPC `mov_marcar_pagado`), `resumen` |
| `archivos.ts` | 10 | CRUD de `documentos`, subida/descarga/eliminación en bucket `documentos`, agrupación por categoría |
| `usuarios.ts` | 11 | CRUD de usuarios, `cambiarEstado`, `asignarPermiso`; `permisosService` (grupos), `sesionesService`; helpers `puedeAcceder/puedeVerModulo` |
| `reportes.ts` | 13 | `generar(tipo, filtros)`: clientes, productos, servicios, órdenes, ventas, financiero; rápidos y personalizados |
| `auditoria.ts` | 14 | `listarRecientes`, `registrar`, `limpiar` (RPC `limpiar_logs`) |
| `emails.ts` + `emailQueue.ts` | 15 | Encolar/procesar/reintentar/eliminar; estados pendiente/enviando/enviado/fallido; recuperación de estancados (~10 min), reintento exponencial 30·2^n s, autoproceso cada 60 s |
| `portal.ts` | 16 | Ingreso por correo+documento, mis órdenes/ventas, detalle e impresión, edición de perfil sin correo/documento, cerrar sesión |
| `empresa.ts` | 17 | Registro único, edición, logo en bucket `logos` (público) |
| `catalogos.ts` | transversal | Marcas, equipos y equipos de orden |

### 2.2 Librerías (`src/lib/`)

| Archivo | Contenido |
|---|---|
| `supabase.ts` | Cliente único; `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`; `avisoConfiguracion()`; helpers de Storage (subir/firmar URL 1 h/descargar/eliminar) y límite 20 MB |
| `crud.ts` | Fábrica genérica de CRUD (listar paginado, búsqueda, filtros, orden, obtener, crear, editar, eliminar, contar) + `llamarRpc` |
| `permisos.ts` | Códigos de actividad `a/e/d/v/r/c` × 14 módulos; `tienePermiso`, `tieneAlgunPermiso`, `normalizarCodigos` |
| `pdf.ts` | jsPDF: A4, encabezado de empresa, tabla con salto de página, pie con página/fecha; tipos texto/dinero/fecha/número |
| `fechas.ts` | Fechas ISO ↔ `dd/mm/aaaa`, `rangoPeriodo` (día/semana/mes/año/todos), `estaVencido` |
| `dinero.ts` | Formato con 2 decimales |
| `financiero-utils.ts` | Cálculo puro de **situación** (realizado/atrasado/previsto/pendiente), filtros, totales |
| `validaciones.ts`, `errores.ts`, `types.ts` | Validaciones en español, mapeo de errores, tipos del dominio |

## 3. Rutas y seguridad de rutas (`src/App.tsx`)

- `/login` — login administrativo (redirige a `/` si ya hay sesión).
- `/portal` — árbol público del cliente, separado del panel.
- Resto bajo `Guard` (exige sesión) dentro de `Layout`, y `RutaPermisos` (exige alguno de los códigos del módulo; ver tabla del README).
- `*` → redirige a `/`. La autorización definitiva es **RLS** en Supabase; los guards solo organizan la UI.

`AuthContext` expone `user`, `sesion` (ficha + permisos), `signIn/signOut` y `puede(codigos)`. Al restaurar sesión persistente registra la fila en `sesiones` (RPC `sesion_registrar`; fallo no bloqueante).

## 4. Modelo de datos

23 tablas en español, exactamente las del SP. Definidas en `supabase/migrations/`:

- **0001_init.sql** — tablas base: `empresa`, `permisos`, `usuarios`, `clientes`, `marcas`, `equipos`, `productos`, `servicios`, `garantias`, `categorias`, `cuentas`, `ordenes_trabajo`, `productos_orden`, `servicios_orden`, `equipos_orden`, `anexos`, `ventas`, `items_venta`, `movimientos_financieros`, `documentos`, `logs_auditoria`, `cola_emails`.
- **0002_schema.sql** — correcciones: `usuarios.estado`/`estado_usuario`, `permisos.permisos` como **jsonb** (códigos de actividad), índices únicos parciales (portal `uq_clientes_portal_par`, dedup de líneas), índices de búsqueda/paginación, tabla `sesiones` y vistas **`v_stock_alerta`**, **`v_movimientos_situacion`**, **`v_cliente_vinculos`**.
- **0003_rls.sql** — RLS en las 23/23 tablas; helpers `rol_sesion`, `usuario_actual`, `cliente_actual`, `es_administrador`, `es_cliente`, `tiene_permiso`, `es_cliente_duenio_orden/venta`; políticas por código de permiso + rama de portal.
- **0004_negocio.sql** — triggers de negocio y RPC (§5).
- **0005_storage.sql** — buckets `anexos-orden`, `documentos`, `comprobantes`, `logos` y políticas por permisos.

Datos de ejemplo en `supabase/seed.sql` (idempotente, RB-001: si existe la empresa, no resiembra; nunca modifica/elimina).

## 5. RPC y triggers (migración 0004)

La app invoca estas funciones SQL; **nunca** edita tablas compuestas con varias llamadas sueltas:

| RPC | Uso |
|---|---|
| `requerir_permiso` / `tiene_permiso` | control de permisos server-side |
| `ajustar_stock` | único camino para mover `productos.stock` |
| `orden_agregar_producto` / `orden_cambiar_cantidad_producto` / `orden_quitar_producto` | líneas de productos de una orden (con stock atómico; guard de stock en BD) |
| `venta_agregar_item` / `venta_cambiar_cantidad_item` / `venta_quitar_item` | ítems de venta (con stock) |
| `orden_facturar` / `venta_facturar` | facturación única: crea movimiento financiero y marca `facturado = true` (CHECK + índice único parcial) |
| `mov_marcar_pagado` | marca pago con fecha (RB-014) |
| `limpiar_logs` | vacía `logs_auditoria` |
| `sesion_registrar` / `sesion_cerrar` / `sesion_purgar` | gestión de la tabla `sesiones` |

Triggers: `empresa` única (RB-030), credenciales del portal inmutables (`tg_cliente_no_credenciales`), guard de stock, recálculo de `valor_total`, `fecha_final` al pasar a Finalizado, auditoría genérica `tg_auditar`.

## 6. Pruebas

Suite con **Vitest** (`npm test`, configuración en `vitest.config.ts`, entornos `node` por defecto y `jsdom` donde se usa `localStorage`):

| Carpeta | Qué cubre |
|---|---|
| `src/test/*.test.ts` | unitarias de utilidades puras: `dinero`, `fechas`, `validaciones`, `permisos`, `financiero-utils`, `emailQueue`, cliente Supabase, humo |
| `tests/unit/crud.test.ts` | fábrica CRUD + `llamarRpc` |
| `tests/integration/*.test.ts` | flujos críticos de autenticación, órdenes, ventas, financiero, portal y emails contra un **Supabase simulado** (`tests/helpers/supabaseFalso.ts`) sin red ni datos reales |
| `tests/esquema/alineacion-prompt.test.ts` | conservación: el SQL y las 17 pantallas coinciden con el SOURCE_PROMPT (nada inventado ni omitido) |

Plan completo y correspondencia con el SP: `docs/qa/PLAN_PRUEBAS_TASK-0010.md`. Comandos también disponibles: `npm run lint` (oxlint) y `npm run build` (`tsc -b` + build).

## 7. Variables de entorno

| Variable | Uso | Obligatoria |
|---|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | Sí (si falta, modo diagnóstico) |
| `VITE_SUPABASE_ANON_KEY` | clave `anon public` (pública por diseño) | Sí (idem) |
| `VITE_EMAILS_AUTO_PROCESAR` | `false` desactiva el autoproceso de la cola de emails en el navegador (cada 60 s) | No (activa por defecto) |

Plantilla: `.env.example` (copie a `.env.local`, git-ignorado). **Nunca** coloque `service_role` ni secretos SMTP en variables `VITE_`: solo llegan al bundle las `VITE_*`, y la protección real de los datos es RLS.

## 8. Componentes server-side requeridos en despliegue

Estos dos Edge Functions se **invocan** desde la app pero su implementación no está en este repositorio (no existe `supabase/functions/`); sin ellas el sistema degrada de forma controlada:

| Edge Function | Invocada por | Efecto si falta |
|---|---|---|
| `portal-login` | `portalService.ingresar` | El portal corre con sesión local (24 h): navega su panel, pero los datos con rama RLS de cliente no están disponibles |
| `enviar-email` | `emailQueueService.procesar` / `reintentar` | El envío real no ocurre; los correos quedan *pendiente* o pasan a *fallido* y pueden reintentarse tras desplegarla |

Contrato esperado (según el código que las invoca):

- `portal-login`: body `{ correo, documento }` → `{ session: { access_token, refresh_token }, cliente: { id_cliente, nombre_cliente } }`, con JWT con `app_metadata` `{ rol: 'cliente', cliente_id }` (RLS lo usa en `0003_rls.sql`).
- `enviar-email`: envía el correo (para/cc/cco/mensaje/encabezados) por SMTP del taller; la cola marca *enviado* o *fallido* según el resultado.

También conviene programar la purga de sesiones vencidas (`sesion_purgar`).

## 9. Reglas de negocio implementadas (resumen de verificación)

| Regla | Implementación |
|---|---|
| RB-001 no destruir datos en pruebas | seed idempotente con guard; pruebas solo contra Supabase simulado |
| RB-002/017/020 stock | solo vía RPC de líneas; guard en BD rechaza updates directos de `stock` |
| RB-003/004 facturación única | RPC `orden_facturar`/`venta_facturar` + CHECK/índice único parcial; UI deshabilita el botón |
| RB-014 pagado exige fecha de pago | validación en servicio + RPC `mov_marcar_pagado` |
| RB-018/019 totales | trigger SQL recalcula `valor_total`; venta `Σ subtotales − descuento` (≥ 0) |
| RB-005/008 formatos | `dd/mm/aaaa` y 2 decimales en toda la UI y en los PDF |
| RB-026 situaciones financiero | `situacion()` (front, coincide con vista `v_movimientos_situacion`) + 4 seeds de ejemplo |
| RB-030 empresa única | registro único con trigger |
| RB-031/032 permisos y roles separados | códigos de actividad en UI (`puede()`) y en políticas RLS; portal y panel con sesiones distintas |
| RB-009/028 auditoría | trigger genérico `tg_auditar` escribe `logs_auditoria`; módulo listando y limpiando |

## 10. Operación y despliegue

Resumen operativo (procedimiento completo en `docs/deployment/DEPLOYMENT_PLAN.md` y `DEVOPS.md`):

1. **Base de datos:** aplicar `supabase/migrations/0001…0005` (local: `supabase db reset`) y, opcionalmente, `supabase/seed.sql` para entorno de prueba.
2. **Primer administrador:** crear credencial en Supabase Auth + ficha en `public.usuarios` con grupo «Administrador».
3. **Frontend:** `npm run build` → publicar `dist/` (Netlify, Vercel u hosting estático) con las variables de §7 configuradas.
4. **Edge Functions:** desplegar `portal-login` y `enviar-email` (§8) para portal pleno y envío real de correos.
5. **Mantenimiento:** purgar sesiones expiradas (`sesion_purgar`), monitorear cola de emails y reintentar fallidos, revisar logs de auditoría.

Comandos rápidos:

```bash
npm run dev      # desarrollo
npm run build    # producción
npm run lint     # oxlint
npm run test     # vitest (unitarias + QA)
```

