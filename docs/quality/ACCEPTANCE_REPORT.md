# Reporte de Aceptación Funcional Consolidado — Sistema Taller

| Campo | Valor |
| --- | --- |
| **Ámbito** | Sistema completo: frontend (17 pantallas), backend TS (servicios/lib), base de datos (migraciones 0001–0005 + seed) e integraciones (Supabase: Postgres/RLS/RPC, Storage, Auth, Edge Functions) |
| **Fecha** | 2026-11-06 |
| **Autor** | AG-012 — QA Automation Engineer (consolidación) |
| **Fuentes** | `acceptance_frontend.md`, `acceptance_backend.md`, `acceptance_db.md`, `acceptance_integration.md`, `PROJECT_STATUS.md`, inventario estático de `tests/**` y `src/test/**`, verificación directa de `supabase/migrations/0002_schema.sql` |
| **Código modificado** | Ninguno (solo lectura + este reporte) |
| **Veredicto** | ⚠️ **ACEPTACIÓN FUNCIONAL CONDICIONADA — NO APTO PARA DESPLIEGUE** mientras el bloqueante H-01 (BD) siga abierto y no exista evidencia de ejecución formal verificable de `npm test` y `npm run build` |

---

## 1. Estado de la ejecución de los comandos de validación

**Ambos comandos quedaron sin ejecutar en esta sesión.** El control de permisos del entorno no interactivo rechazó toda ejecución de shell (`npm test`, `npm run build`, incluso `echo`), con el error:

```
permission.rejected: This non-interactive run cannot ask the user for permission, so the request was rejected.
```

El mismo bloqueo está documentado de forma idéntica en los cuatro reportes parciales (frentend, backend, DB e integración). Como política de QA, **no se declaran PASS de pruebas ni de build no ejecutados formalmente**. Lo que sí se verificó estáticamente en esta sesión:

### `npm test`

- **No ejecutado en esta sesión.** Sin salida de Vitest no existe evidencia de aprobación; la cifra declarada es evidencia de proyecto, no de esta corrida.
- `PROJECT_STATUS.md` registra **«Tests: 151/151 passed»** como cierre técnico del proyecto. Esa cifra corresponde a una corrida previa, **no verificada aquí**.
- **Inventario estático confirmado en esta sesión**: 16 archivos de suite (`src/test/**` ×8, `tests/integration/**` ×6, `tests/unit/**` ×1, `tests/esquema/**` ×1) con exactamente **151 bloques de caso** (`it(...)`), sin `skip`, `only`, `todo` ni `each`. El conteo estático coincide con el 151 declarado — esto valida que la cifra declarada *es alcanzable*, no que la corrida fue exitosa.
- Desglose por suite: ver §4.

### `npm run build`

- **No ejecutado en esta sesión.**
- Evidencia contradictoria: `PROJECT_STATUS.md` declara «Build: OK», pero `dist/` se encuentra **vacío** (0 artefactos en el árbol actual). Un `vite build` exitoso habría regenerado artefactos; el estado actual sugiere limpieza posterior o que el build no se ejecutó en el estado actual del árbol.
- Nota de riesgo (ya señalada en aceptación frontend): el script es solo `vite build`, **sin `tsc --noEmit`**, por lo que un build verde no verifica tipado estricto.

- **Pendiente explícito (condición de cierre R-1):** ejecutar `npm test` y `npm run build` en un entorno con permisos de ejecución y anexar la salida cruda a este reporte antes de declarar cierre. La ejecución de estas tareas ha sido rechazada por el entorno en tres sesiones consecutivas; se recomienda revisar la configuración de permisos del agente o ejecutarlas fuera del contexto de agente.

---

## 2. Resultados por capa (consolidación de los 4 entregables de aceptación)

### 2.1 Frontend — `acceptance_frontend.md` → ✅ Aprobado con observaciones

- 17/17 pantallas del catálogo UX (M1–M17) implementadas y estructuradas; guards de sesión/permisos consistentes entre `App.tsx`, `Layout.tsx` y las páginas;
- Módulos con lógica más extensa (Ordenes 1166 líneas, Ventas 706, Financiero 575, Portal 622) verificados línea a línea sin bloqueantes.
- **Sin bloqueantes.** Hallazgos: A-1 (autoproceso de emails que nunca arranca — medio), A-2…A-7 (formato / tipado / UX menores), A-8 (cosmético `index.html`), observaciones A-9…A-12.

### 2.2 Backend — `acceptance_backend.md` → ✅ Aprobado con observaciones

- Reglas de negocio críticas conformes: RB-002/017/020 (stock vía RPC con guard), RB-003/004/027 (facturación única delegada a la BD), RB-014 (pagado ⇒ fecha_pago), RB-018/019 (totales espejo de triggers), RB-030 (empresa única), RB-032 (separación admin/portal), permisos §11, estados de orden, financiero §8, emails §14.
- Los 24 RPC de `0004_negocio.sql` referenciados por los servicios existen con igual nombre/firma.
- Hallazgos: O-01 (cola de emails no atómica → posible doble envío), O-02 (constante `BUCKETS` desalineada con 0005), O-03 (error silencioso en `ordenes.cambiarCantidadServicio`), O-04 (financiero: consulta sin límite + paginación en memoria), O-05…O-07 (menores/informativas).

### 2.3 Base de Datos — `acceptance_db.md` → ❌ Rechazado (bloqueante vigente)

- Verificación de esta sesión sobre el archivo: **H-01 sigue presente**. En `0002_schema.sql` L340–349, el `end as situacion;` (L348) cierra la sentencia y `from movimientos_financieros m;` (L349) queda huérfano → **syntax error**, la migración 0002 falla y aborta la cadena completa (0003–0005 + seed no se aplican). No existe migración de hotfix (`0006_…` ausente del repo).
- El diseño de 0003/0004/0005 y seed fue calificado conforme en revisión estática (RLS 23/23 tablas, cero políticas `anon`, RPC/stock/facturación correctos, seed idempotente), pero **su aplicabilidad está impedida por H-01**.
- H-02 (medio): el detector de FKs legacy compara `conkey` (attnums) contra `'producto_id'` (texto) — siempre falso; las FKs NO ACTION de 0001 no se eliminan y la política `ON DELETE SET NULL` de snapshots históricos queda opacada.
- Veredicto parcial: **rechazado hasta corregir H-01 (+idealmente H-02) y aplicar la cadena en un entorno real** con las consultas de verificación V1–V6 del reporte parcial.

### 2.4 Integración — `acceptance_integration.md` → ✅ Aprobado con condiciones

- Contratos alineados: 14 RPCs (0004), 22 tablas CRUD, 3 vistas, buckets de 0005 usados por literal, cliente Supabase único por `VITE_*`, barrel de servicios respetado por las 17 pantallas, AuthContext tejido con servicios y `puede()`.
- Sin bloqueantes; hallazgos: I-01 (URL firmada de 1 h persistida en BD — enlaces muertos tras 60 min en Ordenes/Documentos/Portal), I-02 (fila de sesión por cada recarga), I-03 (`onAuthStateChange` no refresca permisos/sesión del taller), I-04 (=O-03), I-05…I-09 (menores/informativas, incl. las 3 Edge Functions ausentes del repo).

---

## 3. Veredicto consolidado y condiciones de cierre

**Estado: aceptación funcional CONDICIONADA.** El sistema cumple el diseño funcional (módulos, reglas de negocio, permisos) según revisión estática, pero presenta un bloqueante de aplicabilidad de BD y una deuda de evidencia de ejecución. Antes de cerrar la aceptación se requiere:

| # | Condición | Origen | Severidad |
| --- | --- | --- | --- |
| C-1 | Corregir el syntax error de `v_movimientos_situacion` en `0002_schema.sql` (H-01) y re-aplicar la cadena completa de migraciones + seed en un entorno real (consultas V1–V6 de `acceptance_db.md`) | DB | 🔴 Bloqueante |
| C-2 | Corregir H-02 (FKs legacy no eliminadas; `SET NULL` opacada) en la misma remediación, idealmente `0006_hotfix_vistas_fk.sql` o enmienda de 0002 si no se aplicó en ningún entorno | DB | 🟠 Medio |
| C-3 | Ejecutar `npm test` y `npm run build` con permisos de shell y anexar salida como comprobación formal de este reporte | Todas | 🔴 Bloqueante de evidencia |
| C-4 | Corregir A-1: invocar `iniciarAutoproceso()` en el montaje de la app (hoy la pantalla Emails describe un autoproceso que nunca arranca) | Frontend | 🟡 Medio |
| C-5 | Corregir O-01: claim atómico pendiente→enviando en la cola de emails (riesgo de doble envío real) | Backend | 🟡 Medio |
| C-6 | I-01: no persistir URLs firmadas en `anexos.url` / `documentos.url`; firmar bajo demanda | Integración | 🟡 Medio |
| C-7 | I-02 / I-03: evitar fila de sesión por recarga; refrescar `sesion`/`permisos` en `onAuthStateChange` | Integración | 🟡 Medio-bajo |
| C-8 | O-03/I-04: capturar el `error` del UPDATE en `ordenes.cambiarCantidadServicio` (fallo silencioso) | Backend | 🟡 Medio |
| C-9 | O-02/I-05: alinear `BUCKETS` con los 4 buckets reales de 0005 | Backend/Integración | 🟢 Bajo (riesgo de divergencia) |
| C-10 | O-04: paginar el financiero en BD (v_movimientos_situacion) para volúmenes grandes | Backend | 🟡 Medio (rendimiento) |
| C-11 | O-05/O-06/O-07, A-2…A-8, H-03…H-07, I-06…I-09: backlog de mantenimiento | Varios | 🟢 Bajo |

Los hallazgos medios backend/DB comparten raíces con los de integración (O-02≡I-05, O-03≡I-04); se listan por separado para trazabilidad con cada reporte parcial.

---

## 4. Pruebas

### 4.1 Evidencia de ejecución

| Comando | Estado en esta sesión | Evidencia disponible |
| --- | --- | --- |
| `npm test` | ❌ No ejecutado (permisos de shell rechazados) | `PROJECT_STATUS.md`: «151/151 passed» (corrida previa, no reproducible aquí) |
| `npm run build` | ❌ No ejecutado (permisos de shell rechazados) | `PROJECT_STATUS.md`: «Build: OK»; `dist/` **vacío** (sin artefactos) |

**No se emite ningún porcentaje de cobertura ni veredicto de corrida** porque no existe salida de ejecución verificable en esta consolidación ni en los reportes parciales.

### 4.2 Inventario estático de suites (verificado por lectura; 151 bloques de caso)

| Suite | # casos (estático) | Qué valida |
| --- | --- | --- |
| `src/test/dinero.test.ts` | 7 | RB-017/019: redondeo 2 dec, subtotal, total con descuento ≥ 0, `parseMonto`, formato |
| `src/test/fechas.test.ts` | 11 | dd/mm/aaaa ↔ ISO, `hoyISO` local, rangos de período, `estaVencido` |
| `src/test/supabase.test.ts` | 4 | Buckets 0005, límite 20 MB, aviso sin `.env`, `rutaSegura` |
| `src/test/permisos.test.ts` | 8 | Códigos a/e/d/v/r/c, evaluación exacta/módulo, grupo inactivo |
| `src/test/smoke.test.ts` | 1 | Humo |
| `src/test/validaciones.test.ts` | 14 | Clientes/productos/movimientos/ordenes/emails; RB-014; traducción de hints BD |
| `src/test/financiero-utils.test.ts` | 10 | Situación realizado/atrasado/previsto/pendiente, totales, vencidos |
| `src/test/emailQueue.test.ts` | 7 | §14: estancados, reintento exponencial con tope, `encolarOrden`, `ciclo` |
| `tests/unit/crud.test.ts` | 14 | Fábrica CRUD: paginación, búsqueda con escape, mapeo `Paginado<T>`, errores en español |
| `tests/esquema/alineacion-prompt.test.ts` | 7 | Alineación de tablas/funciones/vistas/14 módulos·6 acciones/17 pantallas contra SOURCE_PROMPT y migraciones |
| `tests/integration/autenticacion.test.ts` | 8 | Login fake-DB, guards de usuario/grupo inactivo, `sesion_registrar/cerrar` |
| `tests/integration/ordenes.test.ts` | 14 | RPCs de stock, `orden_facturar`, anexos a `anexos-orden`, `cola_emails` |
| `tests/integration/ventas.test.ts` | 9 | RPCs de ítems, `venta_facturar`, única facturación impuesta por BD |
| `tests/integration/financiero.test.ts` | 13 | Filtros período+situación, `mov_marcar_pagado`, paginación en memoria |
| `tests/integration/emails.test.ts` | 10 | Estados de cola, Edge `enviar-email`, reintentos |
| `tests/integration/portal.test.ts` | 14 | Login correo+documento (Edge y fallback), whitelist de campos, sesión 24 h |
| **Total** | **151** | Coincide con lo declarado en `PROJECT_STATUS.md` |

Caveat metodológico: el inventario cuenta **declaraciones de caso** por lectura (sin `skip/each`), lo cual valida la consistencia de la cifra declarada; la **aprobación** de esos 151 casos solo la acredita la salida de Vitest pendiente (C-3).

### 4.3 Huecos de cobertura recomendados (no cubiertos por la suite actual)

1. Propiedad de doble-claim en `emails.procesar` (O-01/C-5): no existe test que exija atomicidad pendiente→enviando.
2. `ordenes.cambiarCantidadServicio` con UPDATE rechazado (O-03/C-8): el caso de error silencioso no está testado.
3. Regeneración de URLs firmadas tras expiración (I-01/C-6) y borrado silencioso de Storage (I-06).
4. Duplicación de filas de sesión por recarga (I-02/C-7).
5. Contrato request/response de las Edge Functions `enviar-email`, `portal-login`, `crear-usuario-admin` (I-08): no existe `supabase/functions/` en el repo.
6. **Pruebas contra Supabase real:** RLS, migraciones aplicadas y flujos RPC (stock/facturación) — el bloqueante H-01 impide actualmente toda esta capa; es la brecha crítica de la fase de despliegue.

---

## 5. Registro consolidado de defectos

### 🔴 Bloqueantes

| ID | Origen | Ubicación | Descripción |
| --- | --- | --- | --- |
| H-01 | DB (`acceptance_db.md`) | `supabase/migrations/0002_schema.sql` L340–349 | **Syntax error** en `v_movimientos_situacion`: `end as situacion;` cierra la sentencia y `from movimientos_financieros m;` queda huérfano. 0002 falla y aborta la cadena completa (0003–0005 + seed no se aplican). **Verificado vigente en esta sesión por lectura del archivo; sin hotfix en el repo.** |
| C-3-evidencia | QA (esta consolidación) | — | `npm test` y `npm run build` sin ejecución verificable en 3 sesiones consecutivas por rechazo de permisos del entorno. Inaceptable como evidencia de cierre. |

### 🟠 / 🟡 Medios (ninguno bloquea por sí solo el cierre, deben resolverse antes de despliegue)

| ID | Origen | Ubicación | Descripción |
| --- | --- | --- | --- |
| H-02 | DB | `0002_schema.sql` L216–244 | Detector de FKs legacy defectuoso (compara attnums vs texto): las FKs NO ACTION de 0001 no se eliminan; `SET NULL` de snapshots históricos opacada en `items_venta`/`servicios_orden`. |
| A-1 | Frontend | `src/services/emailQueue.ts` L170-186 / `src/pages/Emails.tsx` | `iniciarAutoproceso()` sin call site: la cola solo se procesa manualmente pese a que la UI declara autoproceso cada minuto. |
| O-01 | Backend | `src/services/emails.ts` L59–97 | Transición pendiente→enviando no atómica (sin `.eq("estado","pendiente")`): doble procesamiento → doble envío real al cliente. |
| O-03 / I-04 | Backend/Integración | `src/services/ordenes.ts` L193–204 | Error del UPDATE en `cambiarCantidadServicio` ignorado → fallo silencioso, UI sin mensaje y subtotal sin recalcular. |
| O-04 | Backend | `src/services/financiero.ts` L71–101 | Consulta sin límite + filtrar/paginar en memoria (afecta Financiero y Panel con historia grande). Decisión documentada, requiere remedio a medio plazo. |
| I-01 | Integración | `ordenes.adjuntarAnexo`, `archivos.subir` | URL firmada de 3600 s persistida en `anexos.url`/`documentos.url`: enlaces muertos tras 1 h para pantallas/portal. |
| I-02 | Integración | `AuthContext` L61–87 | Fila nueva en `sesiones` en cada recarga de página (restauración de sesión no reutiliza la fila activa). |
| I-03 | Integración | `AuthContext` | `onAuthStateChange` no recarga `sesionActual()`/permisos: deriva de menú/`puede()` hasta F5 (mitigada por RLS en servidor). |
| C-3-build | QA | — | `dist/` vacío contradice «Build: OK» de PROJECT_STATUS; el script no incluye `tsc --noEmit` (sin verificación de tipado). |

### 🟢 Bajas / cosméticas / informativas (backlog)

| ID | Origen | Resumen |
| --- | --- | --- |
| A-2 | Frontend | Usuarios.tsx:75 declaración en una sola línea. |
| A-3 | Frontend | Paginación sin tope en Usuarios (páginas vacías). |
| A-4 | Frontend | `any` en `alternarTodo` (Permisos.tsx:114). |
| A-5 | Frontend | Permisos.tsx:170 accede a `supabase` inline, rompe capa de servicios. |
| A-6 | Frontend | Mensaje de desactivación de grupo sin estilo de advertencia. |
| A-7 | Frontend | Búsqueda de Auditoría limitada a la página visible. |
| A-8 | Frontend | `index.html` `lang="en"` y título genérico. |
| H-03 | DB | `pgcrypto` se crea en 0002 pero 0001 ya requiere `gen_random_uuid()` (portabilidad). |
| H-04 | DB | `limpiar_logs` excluye por litera de texto, no por id del auto-log. |
| H-05 | DB | Políticas permisivas del prototipo en 0001 (mitigado: 0003 dropea todas antes de crear el diseño definitivo). |
| H-06 | DB | `orden_facturar`/`venta_facturar` sin fail-fast semántico (`ya_facturada`); el mensaje del índice único no lo es. |
| H-07 | DB | Rama portal de `garantias_sel` usa EXISTS inline en vez de función definer. |
| O-02 / I-05 | Backend/Integración | `BUCKETS` en `lib/supabase.ts` declara `anexos` (inexistente); helpers de Storage sin usar. |
| O-05 | Backend | `ESTADOS_ORDEN` duplicada en `cambiarEstado`; parche frágil con `fecha_inicial` sentinel en `ordenes.editar`. |
| O-06 | Backend | `validarCliente` con `correo:""`; comas sin escapar en DSL de PostgREST (`crud.condicionBusqueda`, `financiero.ts:81`); `productos.editar` muta su parámetro. |
| O-07 | Backend | `emails.reintentar` sin demora; `ordenes.enviarPorCorreo` sin validar `para`; registro de sesión opcional en login; `panel.ordenesPorEstado` cuenta en memoria. |
| I-06 | Integración | `storage.remove` sin inspeccionar resultado → archivos huérfanos. |
| I-07 | Integración | Sesión local de portal sin verificación criptográfica (fallback dev); defensa en profundidad intacta vía RLS. |
| I-08 | Integración | Edge Functions `enviar-email`/`portal-login`/`crear-usuario-admin` no están en el repo (solo comments/docs). |
| I-09 | Integración | Barrel sin reexportar helpers de emailQueue; `emailQueue.listar` tipado `any`; `financiero.marcarPagado` con `?? undefined` vs `null`. |
| A-9…A-12 | Frontend | (No defectos) filtros semánticamente impuros, texto de vínculos vs detalle, `window.location.reload()` en portal, doble cast en Ordenes. |

---

## 6. Limitaciones de esta consolidación

1. **Shell bloqueado en todo el entorno de agente** (tres sesiones consecutivas): `npm test`, `npm run build`, `npm run lint` y cualquier comando quedaron sin ejecutar. Toda la validación es estática (lectura de código, migraciones, suites y reportes previos).
2. **Corrida de tests y build sin verificación independiente:** el 151/151 y «Build: OK» proceden de `PROJECT_STATUS.md`; el inventario estático (§4.2) confirma que la cifra 151 es consistente con el árbol, pero no constituye evidencia de éxito.
3. **Sin entorno de base de datos:** H-01/H-02 no se reproducen contra Postgres real (el propio H-01 lo impide); las consultas de verificación V1–V6 de `acceptance_db.md` siguen pendientes.
4. Sin pruebas de runtime en navegador (UX, accesibilidad, navegación real), sin pruebas de PDF y sin pruebas de las Edge Functions (que tampoco están en el repo).
5. Los veredictos por capa provienen de los reportes parciales (estáticos); esta consolidación cruzó hallazgos comunes, verificó vigencia del bloqueante H-01 por lectura directa y audita la suite, pero no introdujo nueva cobertura dinámica.

---

## 7. Conclusión

El sistema presenta un **estado funcional homogéneo y maduro** desde el punto de vista de diseño: 17/17 pantallas, reglas de negocio críticas implementadas y defendidas en la capa correcta (RPC/triggers/RLS), integraciones conectadas con cliente Supabase único y suite de 151 casos alineada con el árbol. Nada de esto cambia en esta consolidación respecto de los reportes parciales.

Sin embargo, la aceptación **no puede declararse cerrada** porque:

1. Existe un bloqueante vigente y verificado en esta sesión que impide aplicar la base de datos en cualquier entorno (H-01) — el sistema **no arranca de hecho contra su capa de datos**;
2. La única evidencia de ejecución (`npm test` 151/151, `npm run build`) proviene de un archivo de estado de proyecto y no ha sido reproducible en ninguna de las sesiones de QA por bloqueo del entorno — condición C-3.

Acción recomendada inmediata: aplicar el hotfix de 0002 (C-1, C-2), ejecutar las consultas de verificación V1–V6 contra un proyecto Supabase de prueba, y efectuar la corrida formal de `npm test` + `npm run build` (C-3) en un entorno con permisos; luego remitir C-4…C-10 como pre-condiciones de despliegue.

---

*Fin del reporte consolidado — AG-012 (QA Automation Engineer) · 2026-11-06*
