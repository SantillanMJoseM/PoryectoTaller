# Reporte de Aceptación — Integraciones (src/lib, src/contexts, src/services)

| Campo | Valor |
| --- | --- |
| **Ámbito** | `src/lib/**` (11 archivos), `src/contexts/AuthContext.tsx`, `src/services/**` (19 archivos + índice) |
| **Fecha** | 06/11/2026 |
| **Autor** | AG-011 — Integration Engineer |
| **Código modificado** | Ninguno (lectura / análisis estático; según instrucción NO se modificó código) |
| **Complementa** | `acceptance_backend.md` (reglas de negocio) — este reporte evalúa la integración entre capas y con Supabase |
| **Veredicto** | ✅ **APROBADO con observaciones** — los contratos de integración (cliente Supabase único, RPCs de 0004, buckets de 0005, Auth ↔ servicios ↔ UI, barrel de servicios) están conectados y alineados; se listan 4 hallazgos medios y varios menores, ninguno bloqueante |

---

## 1. Alcance y método

Validación estática de la integridad de las integraciones del sistema, verificando que:

1. El cliente de Supabase sea **único** y configurado por variables de entorno (`VITE_*`).
2. Los contratos externos (RPCs, tablas, buckets, Edge Functions) existan con el nombre exacto con que los consumen los servicios.
3. El contexto de sesión (`AuthContext`) esté correctamente tejido con `Auth` de Supabase, el servicio de autenticación y la UI.
4. La UI consuma los servicios por el punto de entrada único (`src/services/index.ts`) sin acoples dispersos.

Fuentes de verdad usadas para verificar cada contrato:

- `supabase/migrations/0001–0005` (schema, RLS, negocio, storage)
- `docs/requirements/SOURCE_PROMPT.md` y `docs/architecture/INTEGRACION_SUPABASE.md`
- `tests/helpers/supabaseFalso.ts` + `tests/integration/**` (contratos verificados los tests)

---

## 2. Mapa de integración

```
UI (pages/, components/)
  │  importan del barrel  «../../services»            (17 pantallas)
  │  importan utilidades de «../../lib/pdf|dinero|fechas|…»
  │  consumen useAuth() de src/contexts/AuthContext.tsx
  ▼
src/contexts/AuthContext.tsx ──► services/autenticacion.ts ──┐
        │  (sesion_registrar vía lib/crud.llamarRpc)         │
        ▼                                                    ▼
src/services/index.ts (barrel, punto de entrada único) ◄── src/services/*.ts
        │                                                    │
        ▼                                                    ▼
src/lib/crud.ts (CRUD genérico + llamarRpc)          src/lib/supabase.ts  ◄── ÚNICO cliente @supabase/supabase-js
src/lib/errores.ts (traducción de errores BD)        (url + anon key desde VITE_*)
src/lib/validaciones|dinero|fechas|financiero-utils|permisos
        │
        ▼
Supabase: Postgres+RLS (0003, 0004) · Auth · Storage (0005) · Edge Functions
```

### 2.1 Verificación de contratos contra las migraciones

| Contrato usado por los servicios | Definición en migración | Verificación | Estado |
| --- | --- | --- | --- |
| RPC `ajustar_stock(p_producto, p_delta)` — `productos.ajustarStock` | 0004 L201 | nombre y args coinciden | ✅ |
| RPC `orden_agregar_producto / orden_cambiar_cantidad_producto / orden_quitar_producto` — órdenes | 0004 | nombres y firma `p_orden/p_producto/p_cantidad/p_precio`, `p_linea/p_cantidad` | ✅ |
| RPC `orden_facturar(p_orden, p_fecha_vencimiento, p_forma_pago, p_categoria_id, p_cuenta_id)` | 0004 L353 | coincide | ✅ |
| RPC `venta_agregar_item / venta_cambiar_cantidad_item / venta_quitar_item / venta_facturar` | 0004 | coincide | ✅ |
| RPC `mov_marcar_pagado(p_movimiento, p_fecha_pago)` — `financiero.marcarPagado` | 0004 L423 | coincide | ✅ |
| RPC `sesion_registrar(p_tipo, p_sujeto[, p_duracion_horas])` / `sesion_cerrar(p_sesion)` / `sesion_purgar` — autenticación, sesionesService | 0004 L456/L483/L489 | coincide | ✅ |
| RPC `limpiar_logs` — `auditoria.limpiar` | 0004 L439 | coincide | ✅ |
| Tablas CRUD (`crearCrud`): usuarios, permisos, clientes, productos, servicios, ordenes_trabajo, productos_orden, servicios_orden, ventas, items_venta, garantias, movimientos_financieros, categorias, cuentas, documentos, anexos, cola_emails, logs_auditoria, sesiones, empresa, marcas, equipos, equipos_orden | 0001/0002 | todas con PK coincidentes con `tests/helpers/supabaseFalso.ts` | ✅ |
| Vistas `v_stock_alerta`, `v_cliente_vinculos`, `v_movimientos_situacion` | 0002/0004 | usadas por productos/reportes/clientes/financiero | ✅ |
| Bucket `documentos` (privado), `anexos-orden` (privado), `logos` (público, URL `getPublicUrl`) | 0005 L10–14 | usados con literales correctos por archivos/ordenes/empresa | ✅ (ver I-05: la constante `BUCKETS` de `lib/supabase.ts` declara `anexos`, que **no existe**) |
| Edge Functions `enviar-email`, `portal-login`, `crear-usuario-admin` | — (despliegue) | invocadas por emails/portal/autenticación | ⚠️ ver I-08 |

### 2.2 Integración `AuthContext` (src/contexts)

| Aspecto | Verificación | Estado |
| --- | --- | --- |
| Cliente Supabase | importa de `lib/supabase` (única fuente); no instancia ni duplica cliente | ✅ |
| Login | delega en `autenticacionService.iniciar` → `signInWithPassword` + carga `usuarios↔permisos` + guard de usuario/grupo inactivo (con `signOut` defensivo) | ✅ |
| Sesión persistente | al montar llama `sesionActual()` y recarga permisos vigentes; registra fila en `sesiones` vía RPC `sesion_registrar` **sin bloquear el login si la RPC falla** (try/catch) | ✅ (ver I-02) |
| Cambios de sesión | `onAuthStateChange` actualiza `user` y limpia `sesion` al cerrar; desuscribe en cleanup | ✅ (ver I-03) |
| Errores | `signIn` devuelte `mensajeError(error)` como texto (contrato UI: LoginPage muestra el string) | ✅ |
| Permisos en UI | expone `permisos` (array) y `puede(codigos)` alineada con `lib/permisos` (algún código, no todos); consumida por `App.tsx` (guards), `Layout.tsx` (menú) y 12+ pantallas | ✅ |
| Cierre | `signOut` cierra fila de sesiones (`sesion_cerrar`) y siempre desconecta la sesión de Supabase (`finally`) | ✅ |
| Consumo durable | `main.tsx` envuelve la app con `AuthProvider`; sin reintento infinito ni estados colgantes (`loading` se apaga en `finally`) | ✅ |

### 2.3 Integración de servicios con la librería (`src/lib`)

| Servicio | Usa de lib | Estado |
| --- | --- | --- |
| autenticacion | supabase, errores, crud (RPC), permisos (`tieneAlgunPermiso`), types | ✅ |
| clientes/productos | crud, errores, supabase (vistas), validaciones | ✅ |
| servicios/serviciosCRUD | crud, validaciones | ✅ |
| ordenes | crud, errores, fechas (`hoyISO`), supabase (Storage + cola_emails), dinero (`subtotalLinea`, `redondear`), validaciones | ✅ (ver I-04: `cambiarCantidadServicio` no captura el error del UPDATE; observación ya reportada como O-03 en backend) |
| ventas | crud, errores, fechas, supabase, validaciones (+`asegurarValido`) | ✅ |
| garantias | crud, validaciones | ✅ (ver I-09: instancia crud en cada llamada) |
| financiero | crud, errores, fechas, financiero-utils (misma regla de situación que la vista), validaciones | ✅ |
| archivos | crud, errores, fechas, supabase Storage | ✅ (ver I-01/I-06) |
| catalogos | crud | ✅ |
| usuarios | crud, errores, supabase, permisos (3 funciones), validaciones (`validarContrasena` reexportado) | ✅ |
| auditoria | crud, errores, supabase (inserción explícita de log) | ✅ |
| emails / emailQueue | crud, errores + Edge `enviar-email` | ✅ (doble-claim pendiente→enviando no atómico, ya reportado como O-01) |
| empresa | crud, supabase Storage (logos) | ✅ |
| panel | supabase, productos, financiero, errores | ✅ |
| portal | supabase (Edge `portal-login`, fallback local), errores | ✅ (ver I-07) |
| reportes | supabase, fechas, errores, empresa (`empresaService` + `cabeceraEmpresa`) | ✅ |

### 2.4 Integración fuentes de errores

Todos los módulos que consultan Supabase traducen errores con `lib/errores.mensajeError` (hints de 0004: `stock_insuficiente`, `empresa_unica`, `credenciales_inmutables`, `stock_guard`, `permiso_denegado`; códigos Postgres y patrones RLS). No se detectó ninguna consulta que devuelva el error crudo al usuario sin pasar por la traducción, salvo en `autenticacion.sesionActual` (retorna datos sin error tipado; aceptable) y en los casos silenciosos de Storage descritos en I-06.

---

## 3. Fortalezas destacadas

1. **Cliente Supabase único:** todos los módulos (17 servicios, AuthContext, la página Permisos) importan de `src/lib/supabase.ts`; no hay instancias paralelas ni claves hard-codeadas. `esSupabaseConfigurado`/`avisoConfiguracion` permiten pantallas de diagnóstico sin exponer secretos.
2. **Sin credenciales expuestas:** solo `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (`.env.example`). Las credenciales de usuario se crean con la Edge Function `crear-usuario-admin` (rol de servicio) y el servicio solo valida longitud mínima y delega; nunca hay SERVICE_ROLE en el frontend.
3. **Barrel de servicios respetado:** las 17 pantallas consumen `services/index.ts`; el único import directo en el árbol UI es `AuthContext → services/autenticacion.ts` (decision del diseño del TASK-0008, documentada). Cero acoples dispersos a módulos individuales.
4. **Lógica pura separada de I/O:** `dinero/fechas/financiero-utils/permisos/validaciones` no tocan Supabase — por eso el doble de pruebas puede simulirla (y `financieroService` reutiliza las mismas reglas que la vista `v_movimientos_situacion`, con nota de equivalencia).
5. **Contratos de DB alineados:** los 14 RPCs y 22 tablas usados por la capa TS existen con el mismo nombre/args en 0001–0005 (verificado por lectura, no solo por los tests).
6. **Doble fallback robusto en el portal y la cola de emails:** el portal degrada a sesión local si `portal-login` no está desplegada (documentada la limitación RLS); la cola de emails degrada a «fallido con causa» si `enviar-email` falta — nada rompe la UI.
7. **Sanitización de archivos:** nombres con UUID antepuesto y limpieza de caracteres (`rutaSegura` en supabase.ts, patrón repetido en archivos/ordenes/empresa), límites 20 MB (documentos/anexos) y 5 MB (logos con `image/*`).

---

## 4. Hallazgos

Severidades: 🔴 Alta (bloqueante de aceptación) · 🟡 Media (fix recomendado) · 🟢 Baja / informativa.

### I-01 🟡 — URL firmada (1 h) persistida en la base de datos

`ordenes.adjuntarAnexo` y `archivos.subir` generan una **URL firmada de 3600 s** y la guardan en la columna `url` del registro (`anexos.url`, `documentos.url`). Al cabo de una hora la URL muere; quien lea el campo (pantallas y portal) recibirá un enlace expirado. `archivos.descargar(id)` sí regenera la firma sobre demanda — el patrón correcto — pero no todos los consumidores redirigen por ese camino.

**Sugerencia:** guardar solo `ruta` en la fila y regenerar siempre la firma al mostrarse/descargarse (ofirmar con `firmarUrlBucket` de `lib/supabase.ts`); mantener `url` como caché de corta vida. **Impacto:** medio (pantallas Ordenes/Documentos/Portal tras 60 min).

### I-02 🟡 — Fila de sesión nueva en cada recarga de página

En `AuthContext` (líneas 61–87), al restaurar la sesión persistente (`sesionActual()`) el objeto devuelto **nunca trae `idSesion`** (el servicio `sesionActual()` no lo consulta), por lo que el contexto llama a `sesion_registrar` en **cada recarga** y sobrescribe `s.idSesion` en memoria. Cada inicio real de sesión ya registró otra fila en `iniciar()`. Resultado: acumulación de filas en `sesiones` (aunque el trigger/RPC `sesion_purgar` existe, no hay una vía automática exportada por la UI) y `signOut` solo cierra la última fila creadas.

**Sugerencia:** levantar la fila activa (`activa=true`) por usuario al restaurar en`sesionActual()` (o guardar `idSesion` con la sesión) para reutilizarla y no crear una nueva. **Impacto:** medio-bajo (datos operativos, no de negocio).

### I-03 🟡 — `onAuthStateChange` no refresca `sesion`/`permisos` del taller

El listener de `AuthContext` sincroniza `user` de Supabase pero no recarga `autenticacionService.sesionActual()` ni los permisos vigentes. Si la sesión se refresca, se desactiva al usuario o cambia su grupo desde otra pestaña, la UI sigue usando el menú/`puede()` de la carga original hasta F5 (y un `signOut` remoto sí limpia, pero desactivación o cambio de permiso no).

**Sugerencia:** para `SIGNED_OUT` limpiar; para otros eventos recargar `sesionActual()` (o al menos al volver a enfocar la pestaña). **Impacto:** medio-bajo (deriva de permisos, mitigadas por RLS en el servidor).

### I-04 🟡 — `ordenes.cambiarCantidadServicio`: error del UPDATE ignorado (duplica O-03 de backend)

En `src/services/ordenes.ts` L193–204 el `UPDATE` sobre `servicios_orden` **no captura `error`** (el `SELECT` previo sí). Un rechazo de RLS/permiso hace la operación silenciosa: la UI no recibe error y el subtotal queda desactualizado. Los demás métodos del mismo servicio sí lo traducen con `mensajeError`.

**Sugerencia:** capturar y lanzar `new Error(mensajeError(error))` igual al resto. **Impacto:** medio.

### I-05 🟢 — Constante `BUCKETS` desalineada (duplica O-02 de backend)

`lib/supabase.ts` integra Storage con `BUCKETS = { documentos, anexos }`, pero 0005 define `anexos-orden`, `documentos`, `comprobantes`, `logos`. En la práctica los servicios usan **literales correctos** (`"anexos-orden"`, `"documentos"`, `"logos"`) y los helpers de `lib/supabase.ts` (`subirAlBucket`, `firmarUrlBucket`, `descargarDelBucket`, `eliminarDelBucket`) quedan **sin usar** por esa desconexión; el `NombreBucket` derivado de la constante engaña a quien intente integrar con `anexos`.

**Sugerencia:** encajar `BUCKETS` a los 4 buckets reales y que ordenes/archivos/empresa lo usen como fuente única (hoy `rutaSegura`/`LIMITE_ALMACEN_BYTES` también se duplican en un servicio). **Impacto:** bajo (riesgo de divergencia futura, nada roto en runtime).

### I-06 🟢 — Resultados de `storage.remove` ignorados (borrado silencioso)

`archivos.eliminarConArchivo` y `ordenes.quitarAnexo` ejecutan `await supabase.storage.from(...).remove([ruta])` **sin leer el resultado**. Si el borrado del objeto falla (RLS de bucket, error de red), el flujo continúa y borra la fila de metadatos: queda un archivo huérfano sin referencia. Contraste con `eliminarDelBucket` de la propia lib, que es idempotente y distingue «not found» de un error real.

**Sugerencia:** inspeccionar el resultado del `remove` (error/estado) y avisar si el objeto físico no se borró, o reutilizar `eliminarDelBucket`. **Impacto:** bajo (costo de almacenamiento, no de negocio).

### I-07 🟢 — Sesión local del portal sin verificación criptográfica y fallback dependiente de RLS

`portal.ingresar` sin Edge `portal-login` guarda `SesionPortal` (con `idCliente`) en `localStorage` en claro. Cualquier usuario puede editar `idCliente` y la UI intentará consultar órdenes/ventas ajenas — la **RLS** (rama del portal de 0003) es la única barrera, correcta en servidor. Además, el fallback consulta `clientes` con el JWT anon: depende de que la política de 0003 acepte esa forma (`correo + documento` en el WHERE). Funciona con las políticas actuales, pero es un acoplamiento implícito a la política, no a una función.

**Sugerencia:** en producción desplegar `portal-login` (token con rol cliente en `app_metadata`); documentar el fallback como solo-desarrollo. **Impacto:** informativa (defensa en profundidad intacta).

### I-08 🟢 — Edge Functions referenciadas no están en el repositorio

`enviar-email`, `portal-login` y `crear-usuario-admin` se invocan con `supabase.functions.invoke`, pero no existe `supabase/functions/` en el repo (solo migraciones + seed). Los tres servicios degradan bien (estado `fallido` con causa / sesión local / mensaje de configuración), así que no hay fallo frontal, pero la Integración «SMTP del taller» queda **sin trazabilidad** del lado del código que aceptará esta API contract — solo está descrita en comentarios y `docs/deployment/*`.

**Sugerencia:** añadir el código (SQL o TS) de las tres funciones a la Fase 1 de verificación de despliegue, con contrato de request/response específico (especialmente `portal-login` con la forma `edge.session/access_token` que espera `setSession`). **Impacto:** informativa (checklist de despliegue).

### I-09 🟢 — Observaciones menores

- `garantias.asociarAOrden` y `servicios.autocompletar` instancian un `crearCrud` de 
íó en cada llamada; man con constantes según módulo (mayor estilo, mismo costo negligible).
- El barrel `services/index.ts` no reexporta `esCorreoEstancado` ni `segundosReintento` (emailQueue): los tests y un posible futuro UI las importan desde el archivo de módulo.
- `financiero.marcarPagado` pasa `p_fecha_pago: fechaPago ?? undefined`: la clave se elimina en la serialización y la RPC resuelve su default. Funcionalmente OK, pero `null` expresaría mejor la intención.
- `emailQueue.listar` está tipado como `(opciones?: any)` — downgrade local del contrato tipado de `Crud.listar`.
- Proveedor no verificado por lectura de código: `panel.ordenesPorEstado` trae todas las filas de `ordenes_trabajo` para contar en la memoria (ya notificado como O-07; repetido por completitud del mapa de integración).
- `ordenes.enviarPorCorreo` escribe directo en `cola_emails` sin validar `para` (a diferencia del camino `emailQueue.encolar → emailsService.crear`, que valida): dos rutas de escritura al mismo recurso con validaciones distintas.

---

## 5. Pruebas que cubren estas integraciones

Suite Vitest con datos simulados (`tests/helpers/supabaseFalso.ts`) que implementa el subconjunto real de la API usada por la capa de servicios (thenable chain, insert/update/delete, rpc, functions.invoke, auth, storage) y registra llamadas (`rpcLlamadas`, `subidas`, `llamadasAuth`) para verificar contratos:

| Archivo | Integración que valida |
| --- | --- |
| `tests/unit/crud.test.ts` | Fábrica `crearCrud`: paginación, búsqueda ilike con escape, mapeo a `Paginado<T>`, traducción de errores a español |
| `tests/integration/autenticacion.test.ts` | Login completo fake-DB: `usuarios↔permisos`, guard de usuario/grupo inactivo, `sesion_registrar/sesion_cerrar`, `crear-usuario-admin` |
| `tests/integration/ordenes.test.ts` | RPCs de stock (agregar/cambiar/quitar), `orden_facturar`, anexos a `anexos-orden`, `cola_emails` |
| `tests/integration/ventas.test.ts` | RPCs de ítems, `venta_facturar`, select embebido `clientes(nombre_cliente, documento)` |
| `tests/integration/financiero.test.ts` | Filtros período+situación, `mov_marcar_pagado`, categorías/cuentas |
| `tests/integration/emails.test.ts` | Estados pendiente→enviando→enviado/fallido, Edge `enviar-email`, cola con estancados |
| `tests/integration/portal.test.ts` | Login correo+documento (Edge y fallback), `actualizarPerfil` sin correo/documento |

> **⚠️ Estado de ejecución:** en esta sesión los comandos de shell (`npm test` / `npx vitest run`) fueron **rechazados por el control de permisos del entorno no interactivo** (mismo bloqueo registrado en `acceptance_backend.md`). La revisión es 100 % estática; los test files, el helper de simulación y PROJECT_STATUS.md («Tests: 151/151 passed») indican cobertura, pero la evidencia formal de ejecución de `npm test` queda como **acción pendiente** en un entorno con permisos.

**Huecos de cobertura recomendados:** propiedad de duplicación de sesión en cada recarga (I-02), descarte de URL firmada del I-01 (firmar tras 2 h y verificar), borrado silencioso en Storage (I-06), y contrato exacto request/response de las tres Edge Functions cuando existan en el repo (I-08).

---

## 6. Conclusión

Las integraciones están **sanamente conectadas**: un único cliente Supabase por variables de entorno, servicios consumidos por un barrel único, AuthContext tejido con Auth + permisos + sesiones, contratos de RPC/Storage alineados con las migraciones por nombre y firma, traducción de errores de negocio consistente desde `lib/errores`, y degradación documentada para las tres funciones de borde.

**Se aprueba la aceptación condicionada a:**

1. **I-01** — no persistir URLs firmadas (o reciclarlas) en `anexos`/`documentos`.
2. **I-02** — evitar el registro de una fila de sesión por recarga de página.
3. **I-03** — refrescar `sesion`/`permisos` al cambiar el estado de Auth de Supabase.
4. **I-04** — capturar el error del `UPDATE` en `ordenes.cambiarCantidadServicio` (duplica O-03).
5. **Evidencia formal** — ejecutar `npm test` en un entorno con permisos de shell y anexar el resultado a este reporte (bloqueado por el entorno en esta sesión).

Los hallazgos verdes (I-05 a I-09) no bloquean la entrega; conviene incluirlos en la iteración de mantenimiento del siguiente sprint.

### Inventario de evidencia

- Código inspeccionado (lectura): 11 archivos de `src/lib`, `src/contexts/AuthContext.tsx`, 19 de `src/services` + `index.ts`, migraciones `0001–0005`, `.env.example`, `PROJECT_STATUS.md`, 7 suites de test + helper `supabaseFalso`.
- Cruces verificados: 14 RPCs (0004), 3 Edge Functions (despliegue), 4 buckets (0005), barrel de servicios vs. imports de páginas (grep de imports).
- Archivo creado por este reporte: **solo** `docs/quality/acceptance_integration.md` (0 líneas de código modificadas).
