# Reporte de Aceptación — Frontend de Sistema Taller

| Campo | Valor |
|---|---|
| Tarea | Validación de aceptación del frontend (src/pages + estructura de soporte) |
| Fecha | 2026-11-06 |
| Alcance | 17 páginas en `src/pages/`, `src/App.tsx`, `src/main.tsx`, componentes compartidos (`CrudPage`, `Layout`, `ConfirmDialog`), `AuthContext` |
| Método | `npm run build` (intentado) + revisión estática línea a línea de todo `src/pages/**` y puntos de cruce (`App.tsx`, `Layout.tsx`, `AuthContext.tsx`, `CrudPage.tsx`, `ConfirmDialog.tsx`, `emailQueue.ts`, `reportes.ts`, `clientes.ts`) contra `docs/ux-ui/SCREEN_CATALOG.md` |
| Modificación de código | Ninguna (revisión de solo lectura) |

---

## 1. Estado de `npm run build`

**No ejecutado — limitación del entorno.** En esta sesión no interactiva, la ejecución de comandos de shell (`npm run build`, `npx vitest run`, incluso `ls`) fue rechazada por el sistema de permisos con el error:
`permission.rejected: This non-interactive run cannot ask the user for permission, so the request was rejected.`

Evidencias indirectas relevantes:

- El directorio `dist/` existe pero está **vacío** (glob sobre `dist/**/*` devuelve 0 archivos): no hay artefacto de build instalado en el estado actual del árbol.
- Los scripts de `package.json` están definidos correctamente (`build: vite build`, `lint: oxlint`, `test: vitest run`) y sus dependencias dev están presentes en `devDependencies`.
- Nota de riesgo: `npm run build` es solo `vite build`, **sin `tsc --noEmit`**, por lo que un build exitoso no garantiza tipado estricto; ver defecto N-4.

**Pendiente explícito:** volver a ejecutar `npm run build` y `npm run test` en un entorno con permisos de ejecución antes de cerrar la aceptación.

---

## 2. Módulos verificados

Cobertura vs catálogo de pantallas (`docs/ux-ui/SCREEN_CATALOG.md` M1–M17): **17/17 pantallas implementadas**, más la plantilla y el router.

| Módulo | Archivo | Verificación | Observaciones |
|---|---|---|---|
| M1 Login administrativo | `LoginPage.tsx` | OK | Validación de campos vacíos, error de credenciales, enlace a `/portal` (coordinación ambas entradas). |
| M2 Panel principal | `Dashboard.tsx` | OK | Resumen (órdenes abiertas, stock bajo, pendientes/vencidos), atajos filtrados por permiso con `CODIGOS_RUTA`. |
| M3 Clientes | `Clientes.tsx` | OK / Obs. A-10 | Detalle con vínculos (componente `Vinculos`). |
| M4 Productos | `Productos.tsx` | OK | Alerta de stock bajo (vista + columnas), ajuste directo de stock con confirmación y validación de delta ≠ 0. |
| M5 Servicios | `Servicios.tsx` | OK | CRUD vía `CrudPage`. |
| M6 Órdenes de trabajo | `Ordenes.tsx` (1166 líneas) | OK / Obs. A-12 | Estados del prompt, líneas de productos/servicios con stock por RPC, equipos, anexos, envío por correo, PDF (jsPDF) y facturación única con `cabeFacturar()`. |
| M7 Ventas | `Ventas.tsx` (706 líneas) | OK | Ítems con stock, descuento, facturación única, impresión, filtros por rango de fechas. |
| M8 Garantías | `Garantias.tsx` | OK | CRUD + `pdfGarantia` con encabezado de empresa. |
| M9 Financiero | `Financiero.tsx` (575 líneas) | OK | Filtros período/situación/tipo, totales del período, marcar pagado (RPC), vencidos. |
| M10 Archivos/Documentos | `Documentos.tsx` | OK | Carga con metadatos, tamaño legible, descarga con URL firmada, eliminar con archivo físico. |
| M11 Usuarios | `Usuarios.tsx` | OK / Def. A-2, A-3 | Contraseña solo vía credencial hasheada (función de borde); nunca se guarda en claro. |
| M12 Permisos | `Permisos.tsx` | OK / Def. A-4, A-5, A-6 | Matriz de códigos (a/e/d/v/r/c × módulos), desactivación cuando hay usuarios asignados. |
| M13 Informes/Reportes | `Reportes.tsx` | OK / Obs. A-9 | 6 tipos filtrados por `puede(r*)`, PDF "Ver" y "Descargar", vista previa de 12 filas. |
| M14 Auditoría | `Auditoria.tsx` | OK / Def. A-7 | Listado + limpiar logs con confirmación (`dAuditoria`). |
| M15 Cola de emails | `Emails.tsx` | OK / Def. A-1 | Estados pendiente/enviando/enviado/fallido, procesar, reintentar, eliminar. |
| M17 Config. de empresa | `Empresa.tsx` | OK | RB-030 un registro único, logo ≤ 5 MB con vista previa, campos bloqueados sin permiso. |
| M16 Portal del cliente | `Portal.tsx` (622 líneas) | OK / Obs. A-11 | Acceso correo+documento, pestañas órdenes/compras/cuenta, impresión PDF, restricción mail/documento no editables. |
| Plantilla / routing | `App.tsx`, `Layout.tsx`, `main.tsx` | OK | Guards de sesión y permisos (`Guard`, `RutaPermisos`), menú filtrado, wildcard → `/`, `StrictMode`. |
| CRUD genérico | `CrudPage.tsx` | OK | Búsqueda, paginación, validación de obligatorios, payloads tipados por tipo de campo, confirmaciones. |

Verificaciones transversales positivas:

- Índice de accesibilidad de sesión: `puede(codigos)` coincide con `RutaPermisos` y `Layout` (códigos de actividad consistentes).
- `confirmarEliminar`/`eliminar` deshabilitan el diálogo durante `ocupado` en todos los módulos.
- Sin ningún `console.log` residual ni texto en portugués en las 17 páginas; textos consistentes en español.
- Iconos lúcido importados en la mayoría de los casos existen; `TrashIcon`, `SearchIcon`, etc., usados tras importación (sin import muerto detectado en páginas, salvo el ya existente en reportes no aplicable).

---

## 3. Defectos y observaciones

**A-1 (MEDIO — bug funcional): el autoproceso de la cola de emails nunca arranca.**
`emailQueueService.iniciarAutoproceso()` (src/services/emailQueue.ts:170-186) está definido pero **no existe ningún call site** en `main.tsx`, `App.tsx`, `Layout.tsx` o `Emails.tsx` (grep de `iniciarAutoproceso\(` → único match la definición). Aun así, la pantalla Emails afirma al pie: "el autoproceso del navegador envía la cola cada minuto" (src/pages/Emails.tsx:265). En la práctica los envíos solo ocurren al pulsar "Procesar cola" o como efecto de encolar una orden. **Corrección sugerida:** invocar `iniciarAutoproceso` en el montaje de la app (con `AUTOPROCESO_ACTIVADO` ya lo gobierna).

**A-2 (BAJO — formato): declaración en una sola línea en Usuarios.**
src/pages/Usuarios.tsx:75 — `export default function Usuarios() {  const { puede } = useAuth();` comparte línea (residuo de formateo). Afecta legibilidad y puede disparar reglas de estilo.

**A-3 (BAJO — UX/navegación): paginación sin tope en Usuarios.**
src/pages/Usuarios.tsx:314-321 — el footer de página permite "Siguiente" indefinidamente: `listar` de usuarios solo informa `{ lista, total }` (sin `paginas`) y el botón no se deshabilita con `pagina * 10 >= total`; se pueden pedir páginas vacías. Los demás módulos validan contra `paginas`.

**A-4 (BAJO — tipado): `any` en Permisos.**
src/pages/Permisos.tsx:114 — `const alternarTodo = (c: any)`; debería tiparse contra `ACCIONES[number]`.

**A-5 (BAJO — arquitectura): acceso directo a Supabase desde la página de Permisos.**
src/pages/Permisos.tsx:170 — el borrado de grupo hace `supabase.from("permisos").delete()` inline en el componente en lugar de pasar por `permisosService.eliminar`, rompiendo la capa de servicios y perdiendo la traducción de errores (`mensajeError`). El resto del módulo sí usa el servicio.

**A-6 (COSMÉTICO): mensaje importante sin estilo de alerta.**
src/pages/Permisos.tsx:200 — el aviso "el grupo X tiene N usuarios asignados: fue desactivado en lugar de eliminado" se muestra como `text-muted-foreground` (gris), no como error/advertencia destacada.

**A-7 (BAJO): búsqueda de Auditoría solo filtra la página actual.**
src/pages/Auditoria.tsx:37-50 — el filtro `q` se aplica client-side sobre los 15 registros de la página pedida; cambiar `q` no dispara recarga del servicio ni abre resultados fuera de la página visible. La búsqueda queda funcionalmente limitada a una página.

**A-8 (COSMÉTICO): `index.html` en inglés y título genérico.**
index.html:2 — `lang="en"` pese a que toda la UI está en español (debería ser `lang="es"`); `<title>` es el genérico `sistema-taller-app`. El favicon sí existe (`public/favicon.svg`).

**Observaciones (no defectos bloqueantes):**

- **A-9:** src/pages/Reportes.tsx:261-274 — el filtro "Tipo de movimiento" del reporte financiero reutiliza el campo `filtros.estado` (el servicio lo interpreta en reportes.ts:232). Funciona, pero queda semánticamente impuro si `FiltrosReporte` gana un campo `estado` real de financiero.
- **A-10:** src/pages/Clientes.tsx:109 — la descripción del módulo promete "vinculación con órdenes, ventas, financiero y garantías", pero el componente `Vinculos` muestra órdenes, ventas, movimientos y **equipos** (sin garantías; el servicio consulta `v_cliente_vinculos` según src/services/clientes.ts:6-73). Ajustar el texto o el detalle.
- **A-11:** src/pages/Portal.tsx:74 — tras un ingreso correcto se hace `window.location.reload()`; funciona, pero un cambio de estado sería más limpio (evita recarga completa).
- **A-12:** src/pages/Ordenes.tsx:240 — doble cast redundante `as Omit<...> as unknown as Omit<...>`; convendría un solo cast.

---

## 4. Limitaciones de esta validación

1. **No se ejecutaron** `npm run build`, `npm run lint` ni `npm run test` (permisos de shell denegados); la validación es estática. El árbol contiene 9 ficheros de test (unit/integration/esquema en `tests/` y 8 suites en `src/test/`) actualmente disponibles para la corrida pendiente.
2. No se verificó el comportamiento en runtime contra un Supabase real (RLS, RPC facturar/mov_marcar_pagado/enviar-email) — datos revisados solo vía servicios (`src/services/*`).
3. Sin prueba manual de accesibilidad ni navegación real en navegador.

---

## 5. Conclusión

- **Cobertura de módulos:** 17/17 pantallas del catálogo UX implementadas y estructuradas, con guards de sesión/permisos consistentes entre router, menú y acciones.
- **Bloqueantes:** ninguno detectado en revisión estática.
- **Condición de cierre:** ejecutar `npm run build` (+ `test`, `lint`) en un entorno con permisos de ejecución, y corregir A-1 (arranque del autoproceso de emails) antes del despliegue; el resto de hallazgos son de baja severidad.
