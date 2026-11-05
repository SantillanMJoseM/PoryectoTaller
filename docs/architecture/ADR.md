# Architectural Decision Records — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0003 — Architecture Design |
| Autor | AG-005 Software Architect |
| Fecha | 2026-11-05 |
| Versión | 1.0 |
| Fuente de verdad | `docs/requirements/SOURCE_PROMPT.md` (SP) |
| Complemento | `ARCHITECTURE.md` (§ referencias), `COMPONENT_DIAGRAM.md` |

**Estados:** `Aceptado` = decisión vigente de arquitectura · `Aceptado condicionado` = vigente pero atada a la aprobación de un escalado (E-xx en `ARCHITECTURE.md` §16) · `Propuesto` = requiere confirmación de AG-001/AG-004 · `Rechazado` = alternativa documentada que no se adopta.

**Regla de integridad:** ningún ADR agrega módulos, tablas de negocio ni procesos fuera de SP. Los ADRs solo deciden *cómo* se implementa lo que SP/RF/RB/RNF ya exigen.

---

### Índice

| ADR | Título | Estado |
|---|---|---|
| 001 | SPA sobre Supabase como backend; sin servidor propio | Aceptado |
| 002 | Vite + React 19 + TypeScript estricto, arquitectura por características | Aceptado |
| 003 | Autenticación administrativa con Supabase Auth (hash bcrypt) y perfil en `usuarios` | Aceptado |
| 004 | Portal del cliente: sesión de tipo `cliente` emitida por Edge Function (correo + documento) | Aceptado condicionado (E-09/R-2) |
| 005 | Materialización de la tabla `sesiones` junto a Supabase Auth | Aceptado |
| 006 | Modelo de permisos: códigos SP en JSONB + helper `tiene_permiso()` + claims cacheados | Aceptado |
| 007 | "Base de datos robusta": reglas duras como constraints + RPC transaccionales | Aceptado |
| 008 | Política de stock ante cantidad insuficiente: bloqueo transaccional | Propuesto (bloquea E-01) |
| 009 | Facturación de orden/venta: RPC idempotente + índice parcial único | Aceptado |
| 010 | Capa de acceso a datos: repositorios tipados + TanStack Query | Aceptado |
| 011 | UI: shadcn/ui + Tailwind v4 con kit de listado paginado propio | Aceptado |
| 012 | Generación de PDF: jsPDF + autoTable con motor único compartido | Aceptado |
| 013 | Storage: buckets privados, `ruta` autoritativa, URLs firmadas y miniaturas en cliente | Aceptado |
| 014 | Cola de emails: Edge Function + pg_cron + adaptador de proveedor | Aceptado |
| 015 | Auditoría: triggers SQL + `request.headers` para la IP | Aceptado |
| 016 | Fechas, moneda y zona horaria centralizadas (no `Intl` para `dd/mm/aaaa`) | Aceptado condicionado (E-06) |
| 017 | Nomenclatura física: español, resolución de la colisión `estado` en `usuarios` | Aceptado |
| 018 | Estrategia y herramientas de prueba (unit / pgTAP / E2E) | Aceptado |
| 019 | Validación compartida con zod (L1) espejo de los CHECK (L2) | Aceptado |
| 020 | Eliminaciones: `ON DELETE RESTRICT` y sin borrado lógico fuera de `estado` | Aceptado condicionado (E-03) |

---

## ADR-001 — SPA sobre Supabase como backend; sin servidor propio

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** SP fija el stack: React + TypeScript + Tailwind + shadcn/ui en el frente y "Backend y base de datos: Supabase (PostgreSQL, Auth, Storage, Row Level Security)". Las reglas de negocio críticas (RB-002 stock, RB-003/004 facturación única) exigen atomicidad multi-tabla (RNF-A-01) y autorización efectiva aunque se ataque la API directamente (RB-006, RNF-S-02). RNF-M-01 prohíbe introducir frameworks backend propios.

**Decisión.** Aplicación de página única (SPA) React que consume Supabase por tres vías: (1) PostgREST sobre tablas y **RPC**, (2) Auth (JWT), (3) Storage. La lógica de negocio dura vive en PostgreSQL (ADR-007). Los procesos que necesitan secretos corren en **Supabase Edge Functions** (ADR-014). No existe capa intermedia propia (Node/Express/Deno server).

**Alternativas descartadas.**
- *Backend Node/Express dedicado*: viola RNF-M-01 y SP; duplica autorización y abre una segunda fuente de verdad de reglas. Rechazado.
- *Next.js/SSR*: SP y RNF describen un panel administrativo con sesión; SSR no aporta beneficio y complica la separación de reinos de sesión (RB-032). Rechazado.
- *Lógica de negocio en el cliente (JS)*: rompería RB-033 (validación doble) y RNF-A-01. Rechazado.

**Consecuencias.** (+) Un único punto de verdad transaccional; menos superficie desplegable; RLS como autorización ineludible. (−) La lógica "dura" es SQL: curva para el equipo y necesidad de pruebas en BD (ADR-018); acoplamiento al proveedor Supabase (mitigado porque el esquema es PostgreSQL estándar y PostgREST es sustituido solo por otra API generada).

**Trazabilidad.** SP §STACK; RNF-M-01; RNF-A-01; RB-006; RNF-S-02; RF-001…082 (contenedor). **Ref.** `ARCHITECTURE.md` §3, §5.

---

## ADR-002 — Vite + React 19 + TypeScript estricto, arquitectura por características

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** El repo ya está inicializado con Vite 5, React 19, TS 7, Tailwind v4 (`@tailwindcss/vite`), alias `@ → src`. SP impone React+TS. El sistema tiene 17 módulos de superficie grande (23 tablas, 5 familias de líneas, 6 reportes). RNF-P-03 pide división de bundle por ruta; RNF-M-01 pide TypeScript estricto.

**Decisión.** Conservar Vite/React/TS. Organizar el código en **características verticales**, una carpeta por módulo SP (`src/features/<modulo>`), cada una con `pages/ components/ data/ model/ index.ts`. Reglas de dependencia verificables por lint: `features/* → shared/*` permitido; `features/A → features/B` **prohibido** (solo a través de `shared` o del registro de rutas). Estado de servidor en TanStack Query (ADR-010). Carga perezosa por ruta (`React.lazy`) para el presupuesto de bundle.

**Alternativas descartadas.**
- *Capas horizontales* (`components/`, `pages/`, `services/` globales): como el prototipo actual; con 17 módulos genera acoplamiento y hace difícil la trazabilidad módulo→componente. Rechazado.
- *Nx / monorepo*: complejidad sin beneficio para un solo deployable. Rechazado.
- *Redux/Zustand*: el estado es de servidor, no de aplicación. Rechazado.

**Consecuencias.** (+) Un desarrollador puede trabajar en un módulo sin tocar los otros 16; el mapa de rutas = lista de módulos de SP (verificable); tests por feature. (−) Boilerplate por feature y necesidad de un `index.ts` estricto como API pública; se requiere una tarea de andamiaje antes del coding de módulos.

**Trazabilidad.** SP §STACK; RF-001…082 (17 módulos); RNF-M-01; RNF-P-03. **Ref.** `ARCHITECTURE.md` §6.1, `COMPONENT_DIAGRAM.md` §2–§4.

---

## ADR-003 — Autenticación administrativa con Supabase Auth y perfil en `usuarios`

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** RF-001/RF-002/RB-011: login por correo + contraseña, hash seguro bcrypt/argon2, nunca texto plano. El modelo SP define la columna `usuarios.contraseña`. Supabase Auth almacena `encrypted_password` (bcrypt) en el esquema `auth`, fuera de `public`. RF-006/RF-058 exigen que el perfil y su grupo de permisos gobiernen el acceso. RNF-S-07 prohíbe exponer secretos en el frente.

**Decisión.**
1. La **identidad** es `auth.users` (correo único, password con bcrypt gestionado por Auth). La **columna de SP** `usuarios.contraseña` se satisface por ese mecanismo: `public.usuarios` **no** almacena hash; su PK `id_usuario` coincide con `auth.users.id`.
2. Alta/edición/baja de identidades solo desde el módulo Usuarios mediante la Edge Function `admin-usuarios` (única con `service_role`), que deja la contraseña en el formulario y nunca la devuelve.
3. En el login, un `POST` hook/EF fija en `app_metadata`: `rol='administrador'`, `usuario_id`, `permisos=[códigos]` (ADR-006) y registra la sesión (ADR-005).
4. Bloqueos de negocio aplicados server-side en el flujo de autenticación: `usuarios.estado_usuario = false` (RF-056/RB-023), `fecha_expiracion` vencida (RF-057/RB-024), grupo `permisos.estado = false` (RB-023) → mensajes en español.

**Alternativas descartadas.**
- *Hash propio en `public.usuarios.contraseña` + verificación en EF*: duplica Auth, expone un camino de sesión propio y contradice "no inventar" (la cláusula de inferencia de SP apunta a la implementación más simple y consistente). Rechazado.
- *Supabase Auth con `raw_user_meta_data` editable por el usuario*: riesgo de escalada de privilegios; por eso los claims de permiso se fijan en `app_metadata`, que el cliente no puede escribir. Rechazado.

**Consecuencias.** (+) RF-002/RNF-S-01 cumplidos con un componente auditado; cero hashes en `public`, en logs o en el bundle; reset de contraseña posible sobre la base de Auth sin inventar flujo. (−) El equipo debe aceptar que "la columna `contraseña`" vive en `auth.users.encrypted_password`: queda documentado en este ADR y en la matriz de trazabilidad de BD. (−) Se necesita la EF `admin-usuarios` para operaciones de identidad.

**Trazabilidad.** RF-001, RF-002, RF-004, RF-054…058; RB-011, RB-023, RB-024, RB-036; RNF-S-01, RNF-S-07, RNF-S-08; HU-001, HU-002, HU-032. **Ref.** `ARCHITECTURE.md` §9.1.

---

## ADR-004 — Portal del cliente: sesión de tipo `cliente` emitida por Edge Function

**Estado:** Aceptado condicionado (necesita PoC; riesgo R-2) · **Fecha:** 2026-11-05

**Contexto.** SP: "Portal de cliente separado: ingreso por correo electrónico + documento del cliente. Si coinciden con un cliente registrado, crear sesión de cliente". RB-032/RNF-S-03 exigen **tipos de sesión incompatibles**: una sesión de portal jamás alcanza datos administrativos, y solo ve lo propio. La autenticación estándar de Supabase no acepta "correo + documento" como credencial.

**Decisión.**
1. Credencial del portal = par (`clientes.correo`, `clientes.documento`) validado por la EF `login-portal` con `service_role` (única que puede buscar en `clientes` sin sesión).
2. Al coincidir, la EF asegura una identidad de portal (`auth.users`) con `app_metadata = {rol:'cliente', cliente_id}` — email interno derivado (`portal+<id_cliente>@taller.local`) para no chocar con usos administrativos del mismo correo — y emite la sesión mediante `admin.generateLink` + `verifyOtp`, devolviendo `access_token`/`refresh_token` al SPA.
3. RLS separa reinos: ninguna política de tabla administrativa incluye la rama `es_cliente()` salvo las de lectura/escritura de los propios datos del cliente (`clientes`, `ordenes_trabajo`, `ventas`, `anexos`, `garantias`, `empresa` para encabezado de PDF).
4. Documentos impresos del portal se obtienen por RPC acotadas (`portal_detalle_orden`, `portal_detalle_venta`) que verifican `cliente_id = cliente_actual()` dentro de la función.
5. Edición de cuenta excluye `correo` y `documento` (E-05, RF-079), reforzado por el trigger `tg_cliente_no_credenciales` (rechaza el cambio si la sesión es de cliente) para no depender de la UI.

**Alternativas descartadas.**
- *Rol `anon` + "sesión" en `localStorage` sin JWT*: imposible de hacer cumplir en RLS; violaría RNF-S-02/S-03. Rechazado.
- *Custom JWT con terceros (tercer emisor de tokens)*: requiere confiar claves externas en la configuración del proyecto y un emisor adicional; más superficie secreta que la EF. Descartado como principal, conservado como **plan B**.
- *Magic link por correo al cliente*: cambia el flujo de SP (exige abrir el email) y no usa el `documento`. Rechazado.

**Consecuencias.** (+) RF-075 y RB-012 implementados sin credenciales débiles ni puertas traseras; el portal es un reino real, no una UI oculta. (−) La emisión programática de sesión depende de capacidades administrativas de Auth: **PoC obligatoria en el primer sprint**; si se limita, se activa el plan B (custom JWT). (−) Duplicación controlada de identidad: un cliente puede tener `clientes` + identidad de portal; la sincronización es la EF y el trigger de alta/baja de clientes.

**Trazabilidad.** RF-075…080; RB-012, RB-032; RNF-S-02, RNF-S-03; HU-044…046. **Ref.** `ARCHITECTURE.md` §9.1, §10.1.

---

## ADR-005 — Materialización de la tabla `sesiones` junto a Supabase Auth

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** SP incluye la tabla `sesiones` ("tabla de sesiones de base de datos") y RF-005/RF-003/RF-004 piden sesión persistente con expiración y cierre server-side. Supabase Auth ya persiste sesiones en `auth.sessions`, pero el esquema `auth` no es editable por migraciones propias y SP exige la tabla en el modelo. OQ-06 pedía resolver esta duplicación.

**Decisión.** `public.sesiones` como **registro de sesiones del sistema** (no duplicado de tokens):

```
sesiones(id_sesion uuid PK, -- = identificador de sesión de Auth
         usuario_id uuid NULL FK usuarios, cliente_id uuid NULL FK clientes,
         tipo text CHECK (tipo IN ('administrador','cliente')),
         inicio_sesion timestamptz, expiracion timestamptz, ip text, user_agent text,
         activa boolean)
```

- Escrita por `sesion_registrar()` al emitir sesión (login admin: hook; login portal: EF) y cerrada por `sesion_cerrar()` en el logout (junto con `auth.signOut()`, que revoca el refresh token server-side).
- `sesion_purgar()` (cron) marca `activa=false` al vencer.
- Función `tiene_sesion_activa()` disponible para políticas RLS de operaciones **de escritura** (defensa en profundidad), sin exigirla en lecturas masivas por costo (RNF-P-01).

**Alternativas descartadas.**
- *Trigger sobre `auth.sessions`*: el esquema `auth` es propiedad de `supabase_auth_admin`; crear triggers no está soportado por el flujo de migraciones del proyecto. Rechazado.
- *No crear la tabla y "considerar `auth.sessions` suficiente"*: incumpliría SP §MODELO DE DATOS (23 tablas) y RF-005. Rechazado.

**Consecuencias.** (+) Tabla 23 del modelo presente y navegable; visibilidad de sesiones activas; cierre verificable. (−) Riesgo de divergencia Auth↔`sesiones`, mitigado por el job de purga y por escribir siempre en el mismo flujo que emite la sesión; se documenta que la autoridad del token es Auth.

**Trazabilidad.** RF-003, RF-004, RF-005; RB-013; RNF-S-08; HU-002, HU-003. **Ref.** `ARCHITECTURE.md` §9.1, E-08.

---

## ADR-006 — Modelo de permisos: códigos SP en JSONB + `tiene_permiso()` + claims cacheados

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** RF-059…061/RB-029: vocabulario cerrado de 6 actividades (a, e, d, v, r, c) × 14 módulos cubiertos (Cliente, Producto, Servicio, Orden, Venta, Garantía, Movimiento, Archivo, Usuario, Permiso, Respaldo, Auditoría, Email, Empresa), formato `<act><Módulo>`; SP permite texto con comas **o** JSON. RB-006: la denegación debe aplicarse "aunque se invoque la API directamente". RNF-P-01: la evaluación no puede ser cara en cada consulta.

**Decisión.**
1. `permisos.permisos` en **JSONB** con array de códigos: `["aCliente","vOrden","eOrden"]`. Permite contención (`?`, `@>`) sin `LIKE` y sin tabla intermedia nueva (SP no la define).
2. Función `public.tiene_permiso(codigo)` (`STABLE`, `SECURITY DEFINER`, `search_path` fijado) que resuelve usuario → grupo → códigos, exigiendo `usuarios.estado_usuario`, `fecha_expiracion` válida y `permisos.estado = true` (RB-023). Al ser `DEFINER` y propiedad del dueño de las tablas, eluye RLS y **evita recursión** dentro de las políticas de `usuarios`/`permisos`; las políticas no subconsultan su propia tabla.
3. Cacheo en el JWT: al iniciar sesión se escribe `app_metadata.permisos = [códigos]`; `tiene_permiso` lee el claim si existe y, si falta o está vacío, cae a la consulta a tabla. `permisos_guardar()`/`admin-usuarios` propagan el cambio a las identidades del grupo (sesiones nuevas y, para caducidad corta, re-evaluación en el próximo refresh).
4. Aplicación triple: **menú/botón** (UI), **RLS** por tabla/acción, **RPC** L4 (`if not tiene_permiso('eOrden') then raise`). Un único registro `shared/domain/permisos.ts` define la matriz código↔módulo↣etiqueta en español; la pantalla Permisos se genera desde ese registro.
5. Códigos del módulo **Respaldo** quedan visibles en el editor y **sin acción** en el sistema (no se inventa pantalla), conforme RF-060 CA3/E-08.

**Alternativas descartadas.**
- *Texto con comas + `position(codigo in permisos)`*: frágil (subcuerdas, sin índice). Rechazado (SP lo permitía, pero es inferior).
- *Tabla `permiso_codigos` normalizada*: agregaría una tabla fuera del modelo SP. Rechazado.
- *RBAC con roles de Postgres por usuario*: no se alinea con el vocabulario de códigos SP ni permite gestión desde el módulo Permisos. Rechazado.

**Consecuencias.** (+) Semántica SP exacta; autorización real en datos; costo O(1) por fila en la mayoría de las consultas. (−) El set de permisos cacheado puede quedar obsoleto durante la vigencia del token (≈60 min): aceptado como ventana de riesgo baja y mitigado con propagación inmediata al editar el grupo (riesgo R-3); las operaciones de escritura usan además la comprobación en tabla.

**Trazabilidad.** RF-006, RF-009, RF-059…061; RB-006, RB-023, RB-029, RB-031; RNF-S-02; HU-034…036. **Ref.** `ARCHITECTURE.md` §6.4, §9.2.

---

## ADR-007 — "Base de datos robusta": constraints + RPC transaccionales

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** RNF-A-01 exige que facturar y ajustar stock sean atómicos; RB-002/003/004/017/018/019/020/021 son invariantes de datos; RB-033 prohíbe reglas duras solo en la UI; RB-002 pide explícitamente "prohibida la escritura directa de `productos.stock` desde el cliente".

**Decisión.**
1. **L2**: `CHECK`, `UNIQUE`, FK `RESTRICT` y triggers como última defensa de cada invariante (estados de orden, estados de email, totales ≥ 0, `pagado → fecha_pago`, empresa única).
2. **L4**: toda operación compuesta es una **función RPC** `SECURITY DEFINER` con `SET search_path = public, pg_temp`: `orden_agregar_producto`, `orden_quitar_producto`, `orden_cambiar_cantidad_producto`, `venta_agregar_item`, `venta_quitar_item`, `orden_recalcular_total`, `venta_recalcular_total`, `orden_facturar`, `venta_facturar`, `auditar`. El SPA solo puede llamarlas por nombre (PostgREST `/rpc/`); no escribe tablas línea ni `stock` directamente.
3. Control de escritura de columnas derivadas: trigger `tg_stock_no_directo` sobre `productos.stock` exige el GUC transaccional `app_permite_stock_write='on'`, fijado únicamente dentro de las RPC; cualquier otro intento falla con `raise`. Totales se recalculan por trigger en `productos_orden/servicios_orden/items_venta` llamando a la función única de recálculo (evita dos caminos divergentes, riesgo R-4).
4. Snapshot de líneas (RB-021): `descripcion/precio/servicio` se copian en la línea y no se reescriben al editar el catálogo; el recálculo usa **solo** los valores de la línea.
5. El cliente nunca concatena SQL: solo `select/insert/update/delete` tipados por PostgREST o `rpc()` (RB-034).

**Alternativas descartadas.**
- *Orquestación desde el SPA con múltiples llamadas*: imposible de hacer atómica desde el navegador (RNF-A-01 fallaría ante desconexión). Rechazado.
- *Reglas duplicadas en una capa intermedia propia*: contraviene ADR-001/RNF-M-01. Rechazado.
- *Triggers para todo (sin RPC)*: los triggers solos no devuelven el resultado ni validan permisos de forma legible; se combinan, pero el punto de entrada es la RPC. Descartado como único mecanismo.

**Consecuencias.** (+) Invariantes garantizadas con concurrencia (fila `FOR UPDATE`); lógica reutilizable por EF y SPA; prueba de propiedad posible en BD. (−) SQL aumenta; el equipo debe dominar funciones/triggers y pgTAP; las RPC requieren documentación de firma (generada en `database.types.ts`).

**Trazabilidad.** RB-002/003/004/017/018/019/020/021; RNF-A-01; RF-017/018/022/023/024/028/033/034/035; HU-011/015/019/022/023. **Ref.** `ARCHITECTURE.md` §5, §8, §10.2, §10.3.

---

## ADR-008 — Política de stock ante cantidad insuficiente: bloqueo transaccional

**Estado:** **Propuesto — escalado E-01 (bloquea coding de Productos/Órdenes/Ventas)** · **Fecha:** 2026-11-05

**Contexto.** OQ-01 de TASK-0001: "Stock insuficiente al agregar producto a orden/venta: ¿se advierte y permite o se bloquea?". RB-020 fija `CHECK (stock >= 0)` como última defensa; el análisis recomienda "advertir y permitir" por coherencia con el estado SP **Aguardando Piezas**; SP no define el comportamiento y prohíbe inventar procesos (por ejemplo, reservas de stock están explícitamente fuera de alcance, `BUSINESS_RULES.md` §7).

**Análisis arquitectónico.** "Advertir y permitir" con `stock >= 0` vigente es **insostenible sin crear un mecanismo nuevo**: si la línea descuenta N > stock, el dato viola el CHECK; si se permite stock negativo, viola RB-020; si se "reserva", se introduce un proceso que SP y el análisis excluyen. Las tres variantes exigen enmendar RB-020 o ampliar alcance.

**Decisión (propuesta).** **Bloqueo** en la RPC: `orden_agregar_producto`/`venta_agregar_item` hacen `SELECT … FOR UPDATE` del producto y, si `cantidad > stock`, abortan con `RAISE EXCEPTION 'insuficiente_stock' USING HINT = 'Disponible: X'`; el SPA traduce a «Stock insuficiente. Disponible: X.» El usuario puede igualmente:
- guardar la orden con estado **Aguardando Piezas** (estado SP) y agregar la línea cuando el insumo ingrese al catálogo, y/o
- ajustar el stock desde Productos (RF-015) cuando corresponda.

La regla queda encapsulada en **una única función auxiliar** `stock_puede_descontarse(p_producto, p_cantidad)`, de modo que si AG-001 elige "permitir", el cambio se limita a esa función + el CHECK + la prueba de propiedad.

**Alternativas descartadas (documentadas para AG-001).**
- *(B) Permitir y dejar stock negativo*: requiere eliminar `CHECK (stock >= 0)` → contradice RB-020 y hace invisible el faltante en Productos.
- *(C) Permitir con stock floor en 0*: rompe el invariante `stock_final = stock_inicial − Σ salidas + Σ entradas` (verificación exigida en RF-017 CA2/RB-002).
- *(D) Reservas por orden*: proceso no definido en SP (no inventar).

**Consecuencias.** (+) Datos siempre coherentes; invariante verificable; el faltante se gestiona con un estado que SP ya prevé. (−) Fricción operativa en talleres con repuestos que llegan tarde: el técnico debe crear la orden, ponerla en "Aguardando Piezas" y agregar la línea al recibir el material. **Requiere confirmación explícita de AG-001.**

**Trazabilidad.** RF-017, RF-018, RF-030, RF-037; RB-002, RB-020; OQ-01; HU-011, HU-015, HU-022. **Ref.** `ARCHITECTURE.md` §16 E-01, §10.2.

---

## ADR-009 — Facturación de orden/venta: RPC idempotente + índice parcial único

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** RB-003/RB-004: una orden y una venta se facturan **una sola vez**; al facturar se crea el movimiento financiero y se marca `facturado = true`. RF-028/RF-035 y RB-027 fijan el doble vínculo (`lanzamiento_id` en el documento; `venta_id` en el movimiento). No existe "desfacturar" (no inventar procesos).

**Decisión.** `orden_facturar(p_id, p_forma_pago, p_fecha_vencimiento, p_categoria, p_cuenta)` y `venta_facturar(...)`:
1. `SELECT … FOR UPDATE` del documento (serializa llamadas concurrentes);
2. si `facturado OR lanzamiento_id IS NOT NULL` → `RAISE` con mensaje «La orden ya fue facturada.» / «La venta ya fue facturada.»;
3. verifica permiso `eOrden`/`eVenta`;
4. inserta `movimientos_financieros` (`tipo='ingreso'`, `valor = valor_total`, `cliente_id`, `forma_pago`, `categoria_id`/`cuenta_id` si se aportan y pasan RB-016, `venta_id` en el caso de venta, `pagado=false`);
5. actualiza el documento con `lanzamiento_id` y `facturado=true`;
6. audita (RB-009).
Todo en una transacción (la función es la transacción). Refuerzo L2: índice **parcial único** `ON ordenes_trabajo(lanzamiento_id) WHERE lanzamiento_id IS NOT NULL` (y el análogo de ventas) para que ni un bug o una EF con `service_role` puedan producir dos facturas. Sin UI de anulación: la corrección se hace manualmente en Financiero (RF-028 CA3).

**Alternativas descartadas.**
- *Bandera única sin índice*: dos clics concurrentes sin `FOR UPDATE` podrían crear dos movimientos. Rechazado.
- *`generar factura` como documento propio con tabla nueva*: SP no define tabla de facturas; agregarla violaría "no improvisar". Rechazado.
- *Desfacturar*: SP no lo contempla; además exigiría borrar el movimiento (integrity/auditoría). Rechazado y documentado en `BUSINESS_RULES.md` §7.

**Consecuencias.** (+) RB-003/004 verificables con prueba de concurrencia; doble vínculo coherente; auditoría de la acción. (−) El error humano de facturación solo se corrige editando el movimiento, lo que deja el documento marcado `facturado=true`: aceptado por alcance.

**Trazabilidad.** RF-028, RF-035, RF-042; RB-003, RB-004, RB-016, RB-027, RB-009; RNF-A-01; HU-019, HU-023. **Ref.** `ARCHITECTURE.md` §8, §10.3, §7.3.

---

## ADR-010 — Capa de acceso a datos: repositorios tipados + TanStack Query

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** RNF-U-03 (paginación server-side en todo listado), RNF-P-01/P-02 (≤ 2 s P95, prohibido traer tablas completas), RNF-M-01 (TS estricto) y el estado actual del prototipo (`supabase.from(...).select('*')` con `any` en `SimpleCrud.tsx`).

**Decisión.**
1. Tipos del esquema generados a `src/shared/supabase/database.types.ts` con `supabase gen types typescript --local`, versionados y regenerados en CI (falla si el esquema cambia y el tipo no se regeneró).
2. `data/<entidad>.repositorio.ts`: funciones puras tipadas que contienen los nombres físicos de tablas/columnas y las llamadas `.range()`, `rpc()`; ningún componente importa `supabase` directamente (regla de lint).
3. `data/<entidad>.queries.ts`: hooks de **TanStack Query** (`useClientesListado({filtros, pagina})`, `useOrden(id)`, `useAgregarProductoOrden()` con invalidaciones declaradas explícitamente en un mapa `invalidaciones.ts`).
4. Paginación server-side universal: componente `DataTablePaginado` recibe `page/pageSize/onPageChange/total` desde el hook; la búsqueda se aplica como `ilike` en el repositorio (RF-011/RF-029).
5. Sin caché para operaciones de escritura (la RPC responde el estado nuevo y se invalida); `staleTime` 0 en stock y panel para evitar lecturas engañosas (RF-016).

**Alternativas descartadas.**
- *Llamadas directas desde componentes* (estado actual): no escala a 17 módulos, imposibilita pruebas y repite loading/errores. Rechazado.
- *RTK Query / SWR*: SWR no ofrece invalidaciones por mutación tan declarativas para RPC encadenadas; RTK arrastra un store global innecesario. Descartados.
- *ORM (Drizzle/Prisma)*: RNF-M-01 no lo contempla y RLS se beneficiaría del driver oficial de PostgREST. Rechazado.

**Consecuencias.** (+) Un solo lugar donde cambia el esquema físico; tipos exactos de las 23 tablas; paginación y filtros consistentes en todos los listados. (−) Dos librerías nuevas (`@tanstack/react-query`) y ~1 archivo extra por entidad (plantilla generada). (−) Hay que disciplina de invalidación (mitigado por mapa central y tests de componente).

**Trazabilidad.** RF-011, RF-012, RF-029; RNF-U-03, RNF-P-01, RNF-P-02, RNF-M-01; D-06. **Ref.** `ARCHITECTURE.md` §6.3.

---

## ADR-011 — UI: shadcn/ui + Tailwind v4 con kit de listado paginado propio

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** SP impone Tailwind + shadcn/ui y "panel administrativo clásico" con barra lateral/superior, tablas, formularios, modales y paginación (RNF-U-02/U-03), responsive y en español (RNF-U-01). El repo tiene 9 componentes `ui/` base y `components.json` con style `base-nova` y alias `@/`.

**Decisión.**
1. Mantener la configuración shadcn existente y **añadir** `pagination, tabs, command, popover, dropdown-menu, sonner, checkbox, radio-group, sheet, tooltip, skeleton`.
2. Kit de aplicación en `shared/components/`: `AdminLayout` (sidebar colapsable + topbar con usuario y "Cerrar sesión"), `PageHeader`, **`DataTablePaginado`** (encabezado, columnas definidas, acciones por permiso, vacío/carga/error), `FiltroBar`, `ModalFormulario` (dialog + RHF/zod), `Autocomplete` (command + `useAutocompletado` con debounce 150 ms sobre las RPC `busqueda_*`), `CampoMoneda`, `CampoFecha` (dd/mm/aaaa), `ConfirmDialog` (reemplaza `confirm()` nativo del prototipo), `PermissionGate`, `SubirArchivo` (drag&drop + miniatura).
3. Los 17 módulos se construyen **componiendo** ese kit; ningún módulo implementa su propia tabla o paginación.
4. Textos de UI: constantes en español dentro de cada feature (`model/textos.ts`), sin sistema i18n (idioma único, SP).
5. Accesibilidad base RNF-U-06: los primitivos shadcn aportan roles/foco; axe-core en las rutas críticas de CI.

**Alternativas descartadas.**
- *Librería de componentes alternativa (MUI/AntD/Chakra)*: prohibido por RNF-M-01 ("no librerías UI que dupliquen shadcn"). Rechazado.
- *CSS Modules o styled-components*: duplica Tailwind y no aporta al patrón de panel. Rechazado.
- *Plantillas "admin dashboard" de terceros (templates)*: introducen dependencias y rutas no alineadas con los 17 módulos SP. Rechazado.

**Consecuencias.** (+) Coherencia visual y de interacción en los 17 módulos con poco código; cumplimiento literal de RNF-U-02/03; el kit hace que la paginación y los permisos sean "por defecto", no opcionales. (−) Inversión inicial en el kit (tarea de andamiaje); responsividad de tablas densas exige decisión de UX por módulo (columnas prioritarias + detalle en ficha) para 360 px.

**Trazabilidad.** RNF-U-01…06; RF-011, RF-012, RF-029; SP §STACK/Diseño; HU-005…007, HU-020. **Ref.** `ARCHITECTURE.md` §6.5, `COMPONENT_DIAGRAM.md` §2–§4 (kit `shared/components`).

---

## ADR-012 — Generación de PDF: jsPDF + autoTable, motor único compartido

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** SP §STACK: "usar una librería compatible (jsPDF o react-pdf) manteniendo el mismo contenido y formato de los reportes". RF-065/RB-005: encabezado con datos y logo de la empresa, datos tabulados, paginación. RF-066: ver en línea y descargar. RNF-P-04: **un único motor** para Informes, orden, venta, garantía y portal. `jspdf@4.2` ya está instalado.

**Decisión.** Motor `shared/lib/pdf/`:
1. `definirDocumento({ encabezado, columnas, filas, pie })` → `DocumentoDef`.
2. `pdf.generar(def)` usa **jsPDF** (A4, márgenes, fuente) + **jspdf-autotable** con `didDrawPage` para repetir encabezado/pie en **cada** página (RF-065 CA) y numeración "página N".
3. El encabezado se lee de `empresa` en cada generación (`empresa_obtener()`) — sin hardcode (RB-005) — incluyendo el logo descargado de Storage/`url_logo` como `dataURL` (RF-082).
4. Formatos por la capa `shared/lib/formato.ts` (dd/mm/aaaa, 2 decimales) — el PDF no formatea por su cuenta.
5. Datos paginados desde BD (`reporte_obtener(..., pagina, 200)`) alimentando `autoTable` en lotes (RNF-P-02); sin `doc.html()` (evita inyección RB-034).
6. Salida: `output('bloburl')` para vista previa en `<iframe>` y `save()` para descarga; el portal usa el mismo motor con datos ya acotados por RLS (RF-078).

**Alternativas descartadas.**
- *react-pdf*: orientado a renderizar PDFs existentes en pantalla; para **producir** documentos con paginación requeriría `pdf-lib`/otro writer. SP lo permite como opción, pero jsPDF es el más simple y ya está instalado. Descartado.
- *HTML → PDF (html2canvas/print CSS)*: calidad tipográfica y paginación impredecibles; pesa en bundle. Rechazado.
- *PDF en servidor (EF con pdf-lib)*: agrega una ruta con secretos y una cola nueva de documentos, fuera del alcance. Descartado (queda como plan B si el volumen de reportes crece).

**Consecuencias.** (+) Un motor, cuatro contextos, mismo snapshot → mismo PDF (verificación RNF-P-04); cero dependencias de visor. (−) Las plantillas se programan en JS (no HTML/CSS), con lo que el diseño de los documentos se mantiene como código; se exige un test de "snapshot de datos → contados de páginas y campos presentes".

**Trazabilidad.** RF-027, RF-036, RF-040, RF-065, RF-066, RF-078, RF-082; RB-005, RB-007, RB-008; RNF-P-02, RNF-P-04, RNF-C-02; HU-018, HU-024, HU-026, HU-039, HU-048. **Ref.** `ARCHITECTURE.md` §6.6, §10.5.

---

## ADR-013 — Storage: buckets privados, `ruta` autoritativa, URLs firmadas, miniaturas en el cliente

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** SP exige `anexos(anexo, miniatura, url, ruta)`, `documentos(documento, descripcion, archivo, ruta, url, categoria, tipo, tamaño)`, `movimientos_financieros.anexo` y `empresa.url_logo`; RF-025/048/049…053 piden adjuntar, descargar y organizar. RB-031/RNF-S-02: nada accesible sin permiso.

**Decisión.** Cuatro buckets privados (`anexos-orden`, `documentos`, `comprobantes`, `logos`) con políticas de Storage derivadas del mismo helper de permiso (`tiene_permiso`). Convención:
- `ruta` = `<bucket>/<id-entidad>/<uuid>-<nombre-sanitizado>` → **campo autoritativo**.
- `url` = URL firmada de 60 min **regenerada al listar/abrir** (no se depende de una URL vieja; SP no fija semantics de persistencia de `url`).
- `miniatura` = `<ruta>.thumb.webp` (objeto hermano) para imágenes; otras tipologías usan un ícono por extensión. Se genera en el navegador con `<canvas>` (máx. 256 px), evitando dependencias de imagen en Edge Runtime.
- `tamanio` = bytes leídos del `File`; `tipo` = MIME; `archivo` = nombre original sanitizado.
- `empresa.url_logo` es la única URL pública (bucket `logos` público en lectura, escritura restringida) porque el motor PDF la consume en cualquier sesión.
- Descarga siempre por `download()` de la EF/SPA con URL recién firmada (RF-052).
- Límite 20 MB y lista blanca de extensiones `[Inferida]`, validado en L1 y en la política de Storage (tamaño).

**Alternativas descartadas.**
- *Buckets públicos y `url` permanente*: filtración de datos de órdenes/documentos (viola RNF-S-02); descartado excepto para el logo.
- *Miniatura base64 en la columna `miniatura`*: hincha la tabla y las consultas de listado (RNF-P-01). Descartado.
- *Generación de miniatura en Edge Function*: sin librería de imagen nativa en Deno; requeriría un worker externo no contemplado por SP. Descartado.

**Consecuencias.** (+) Permiso efectivo también para archivos; SP cubierto campo a campo; `ruta` sobrevive a la rotación de URLs. (−) `url` almacenada puede caducar: se aclara que es informativo y siempre se regenera; los enlaces enviados por email se construyen al momento del envío (RF-026).

**Trazabilidad.** RF-025, RF-048, RF-049…053, RF-082; RB-031, RB-034; RNF-S-02; HU-016, HU-030, HU-031. **Ref.** `ARCHITECTURE.md` §6.7, §10.6.

---

## ADR-014 — Cola de emails: Edge Function + pg_cron + adaptador de proveedor

**Estado:** Aceptado (proveedor pendiente: E-02) · **Fecha:** 2026-11-05

**Contexto.** RF-070…074: crear emails (`para, cc, cco, mensaje, encabezados`), 4 estados exactos (RB-015), procesar la cola, reintentar fallidos y eliminar. RNF-A-02: el fallo del proveedor **no** puede afectar la operación de negocio. RB-036: secretos SMTP jamás en el bundle. OQ-01 (parte email): el proveedor no está especificado.

**Decisión.**
1. Escritura inicial por RPC `cola_encolar_email(...)` (o desde `orden_enviar_email`, RF-026) con `estado='pendiente'` y `fecha` automática → la operación de negocio termina ahí (RNF-A-02).
2. `encabezados` (columna de SP, `text`) guarda JSON: `{asunto, reintentos_max, intentos, ultimo_error, adjunto_ruta}`. Así no se agregan columnas fuera del modelo SP (requisito §4) y quedan datos para RF-073.
3. **EF `cola-emails-procesar`** disparada por `pg_cron` cada 2 min: toma `pendiente` con `FOR UPDATE SKIP LOCKED LIMIT 20`, marca `enviando`, envía a través del **adaptador `Mailer`** (interfaces idénticas para SMTP o Resend; la implementación se elige por variable de entorno), y termina en `enviado` o `fallido` (+`intentos`). Transiciones restringidas por `CHECK` según RB-015.
4. **EF `cola-emails-reintentar`** (15 min): `fallido → pendiente` mientras `intentos < 3`; además botón "Reintentar" (manual) y "Procesar ahora" en la pantalla del módulo (RF-072/073).
5. Pantalla del módulo Cola de emails: listado paginado con filtro por estado, acciones reintentar/eliminar (RF-074) y auditoría de envíos/eliminaciones (RB-009).
6. Sin envío transaccional: la EF se ejecuta fuera de la transacción de negocio; si el proveedor está caído, el resto del sistema funciona.

**Alternativas descartadas.**
- *Envío directo desde el navegador con credenciales SMTP*: imposible y violaría RB-036. Rechazado.
- *Cola en memoria del SPA o `setTimeout`*: pierde mensajes al cerrar la pestaña; no cumple "procesar cola/reintentar". Rechazado.
- *Tablas de job adicionales (pgmq, etc.)*: elemento nuevo fuera de SP; `cola_emails` ya es la cola. Rechazado.
- *Forzar proveedor concreto (p. ej. Resend)*: elige un detalle no fijado por SP; se mantiene agnóstico y se escala E-02.

**Consecuencias.** (+) RF-071/072/073 verificables; desacople total del proveedor; retries acotados y auditables. (−) Dependencia de `pg_cron`/`supabase functions schedule` (disponible en el plan usado) y de una pasarela de correo real para pruebas E2E: en QA se prueba contra un SMTP de test (Mailpit) y el modo "proveedor no configurado" deja las filas en `fallido` con `ultimo_error`.

**Trazabilidad.** RF-026, RF-070…074; RB-015, RB-009, RB-036; RNF-A-02; OQ-01; HU-017, HU-042, HU-043. **Ref.** `ARCHITECTURE.md` §10.4, §11, E-02.

---

## ADR-015 — Auditoría: triggers SQL + IP desde `request.headers`

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** RF-067/RF-068/RF-069 y RB-009/RB-028: `logs_auditoria(usuario, tarea, fecha, hora, ip)`, registro **automático** (CA2: "no confiado a la UI"), listado paginado y limpieza. La tabla SP tiene 5 campos de negocio: no hay `tabla`/`record_id`/`action` separados, y **no** podemos añadir columnas de negocio fuera del modelo.

**Decisión.**
1. Función común `public.auditar(p_usuario text, p_tarea text)` (`SECURITY DEFINER`) que calcula `fecha`/`hora` en la zona local (ADR-016) y la `ip` desde `current_setting('request.headers', true)::json ->> 'x-forwarded-for'` (PostgREST expone los headers; se toma el primer token) con fallback `'s/d'`.
2. **Trigger genérico** `tg_auditar` (`AFTER INSERT/UPDATE/DELETE`) instalado en las tablas maestras y transaccionales (`clientes, productos, servicios, ordenes_trabajo, ventas, garantias, movimientos_financieros, documentos, usuarios, permisos, empresa, cola_emails`), que compone `tarea` en español con el identificador — p. ej. `Actualizar orden 3f2a… (estado=Finalizado)` — sin crear columnas nuevas.
3. Las acciones **compuestas** (facturar, cambio de estado, ajustar stock por línea, limpiar logs, procesar/reintentar email, login/logout) se auditan con `auditar()` desde la propia RPC/EF, con redacción de negocio, no solo la operación de fila.
4. `logs_auditoria` es **append-only** para el usuario: `insert` permitido solo a funciones definer/EF; `select` con `vAuditoria`; `delete` solo por `limpiar_logs()`, que **primero** registra la limpieza (RF-069 CA) y permite descargar el CSV previo `[Recomendada]`.
5. Lista cerrada de "acciones relevantes" adoptada literalmente de `ARCHITECTURE.md` §9.3; se prueba con test por acción (fila con los 5 campos presentes).

**Alternativas descartadas.**
- *Auditar desde el SPA*: RF-067 CA2 lo prohíbe; una llamada directa a la API dejaría huecos. Rechazado.
- *Auditar por CDC/`pg_audit`*: no mapea a "usuario/tarea" de negocio ni a los 5 campos SP. Descartado.
- *Añadir columnas `tabla`, `accion`, `record_id`*: excede el modelo SP; la información va dentro de `tarea`. Rechazado.

**Consecuencias.** (+) RB-009 verificable; imposible de evadir escribiendo por API; IP real. (−) El `tarea` es texto libre: el filtrado por módulo se hace por convención de prefijo (documentada) y no por columnas; `request.headers` puede faltar en invocaciones internas (cron) → `ip='s/d'` y `usuario='sistema'`, comportamiento aceptado y documentado.

**Trazabilidad.** RF-067, RF-068, RF-069; RB-009, RB-028; RNF-S-09; HU-040, HU-041. **Ref.** `ARCHITECTURE.md` §8, §9.3, §12.

---

## ADR-016 — Formato de fechas, moneda y zona horaria centralizados

**Estado:** Aceptado condicionado (valores numéricos: E-06) · **Fecha:** 2026-11-05

**Contexto.** RB-007 (`dd/mm/aaaa`), RB-008 (2 decimales), RNF-U-05 (formateador centralizado), RNF-C-03 (almacenar UTC, mostrar zona local, "hoy" de vencidos en zona local), y el modelo SP con campos brasileños (CNPJ/IE/CPF/RG) sin símbolo de moneda fijado.

**Decisión.**
1. `shared/lib/formato.ts`: `formatoFecha`, `formatoFechaHora`, `parseFechaInput`, `formatoMoneda`, `redondear2`. Regla de lint: **prohibido** `toISOString().slice`, `toLocaleDateString` o `Intl` para render de fecha de negocio — `dd/mm/aaaa` se compone manualmente para que el locale del navegador no altere el formato (RF-U-05 verificable por grep/QA).
2. Almacenamiento: `date` para fechas de negocio, `timestamptz` para registros; nunca cadenas con hora.
3. Zona local: `SET timezone` en la BD + constante `ZONA_LOCAL` (`America/Sao_Paulo` `[Inferida]`); "hoy" para RB-025/RB-026 y `logs_auditoria.fecha/hora` se calculan en BD con esa zona.
4. Moneda: default **R$** con separadores `1.234,56` `[Inferida]`, en una única constante editable (sin nueva tabla ni columna en SP); los campos económicos usan `numeric(12,2)` y los totales siempre los produce Postgres.
5. Parámetros de sesión (RNF-S-08): access token 60 min, refresh silencioso, re-login tras 12 h de inactividad en el panel; portal ≤ 24 h.
6. Confirmación pendiente con AG-001 (E-06): símbolo y zona.

**Alternativas descartadas.**
- `Intl.DateTimeFormat` con locale: depende del navegador y puede producir `mm/dd` o punto milar distinto; rechazado para fechas (se admite solo para el separador de moneda, con `maximumFractionDigits: 2`).
- Formato en cada pantalla (como el prototipo): imposible de auditar contra RNF-U-05. Rechazado.
- Guardar hora local en `timestamp` sin zona: ambiguo en DST y rompe RNF-C-03. Rechazado.

**Consecuencias.** (+) RB-007/RB-008 cumplidos por construcción y verificables con un test unitario; un cambio de símbolo/moneda es una línea. (−) Render fuera de `Intl` implica mantener un formateador propio (mínimo) y una regla de lint.

**Trazabilidad.** RB-007, RB-008, RB-013, RB-025, RB-026, RB-028; RNF-U-05, RNF-C-03, RNF-S-08; RF-044, RF-046. **Ref.** `ARCHITECTURE.md` §6.5, §7.1, E-06.

---

## ADR-017 — Nomenclatura física: español y resolución de la colisión `estado`

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** SP: "MODELO DE DATOS (PostgreSQL, nombres en español)". El prototipo contiene una **colisión real**: `usuarios` declara `estado text` (región, dentro de la dirección) y `estado boolean` (activo/inactivo) → Postgres rechaza la migración (`42701`). También `documentos.tamaño` con `ñ`, y `usuarios.contraseña` cuya columna física no se materializa (ADR-003). `FUNCTIONAL_REQUIREMENTS.md` §4.1 delegó la nomenclatura física a diseño.

**Decisión.**
1. Regla general: **los nombres físicos son literalmente los de SP** (tablas y columnas en español, snake_case, sin prefijos de módulo).
2. `usuarios`: `estado text` (región/provincia, parte de la dirección) + **`estado_usuario boolean`** (activo/inactivo). Etiqueta UI: «Estado (activo/inactivo)» (RF-056); la etiqueta «Estado» del bloque de dirección se conserva en la ficha.
3. `documentos.tamaño` → columna física **`tamanio`** (sin `ñ`); etiqueta UI «Tamaño» (evita identificadores comillados en SQL, vistas y generators de tipos).
4. `usuarios.contraseña`: no materializada en `public`; satisfecha por `auth.users.encrypted_password` (ADR-003). La matriz de conformidad BD↔SP lo explicita.
5. PK `id_<entidad>` de SP, tipo `uuid`. Las vistas/funciones propias usan prefijo `v_`/`fn_` y nunca colisionan con nombres SP.
6. Toda renominación física queda registrada en la matriz `SP columna → columna física` del entregable de BD; la UI, los PDF y los emails usan **siempre** los términos SP en español.

**Alternativas descartadas.**
- *Renombrar a inglés (`is_active`, `status`, `size`)*: viola SP explícitamente. Rechazado.
- *Un solo `estado` en `usuarios`* (elegir uno de los dos significados): perdería un campo que SP lista dos veces con sentidos distintos. Rechazado.
- *Usar `estado` booleano y renombrar la región a `provincia`*: válido, pero `provincia` ya existe en `empresa`; mantener `estado` (región) alinea con `clientes`, que SP define igual. Descartado por consistencia.

**Consecuencias.** (+) Migración aplicable (corrige D-01); cero ambigüedad entre "estado de dirección" y "estado de usuario"; trazabilidad SP↔física completa. (−) Dos columnas con raíz `estado` en una tabla: se documenta en el diccionario de datos y en el formulario (secciones separadas).

**Trazabilidad.** SP §MODELO DE DATOS (23 tablas); RF-054, RF-056, RF-049…053; FUNCIONAL_REQUIREMENTS §4.1; defectos D-01/D-10. **Ref.** `ARCHITECTURE.md` §7.1.

---

## ADR-018 — Estrategia y herramientas de prueba (unit / pgTAP / E2E)

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** RNF-M-02 fija la suite mínima: lógica de negocio, RLS por tabla/rol y E2E de los 3 flujos críticos. RB-001 prohíbe usar producción en pruebas. El repo ya define `vitest` (`npm test`) y `jsdom`.

**Decisión.** Cuatro niveles con herramientas concretas:
1. **Unit (Vitest)**: funciones puras de dominio (`subtotal`, totales, regla RB-026, parser de códigos, formateadores) y hooks con Testing Library.
2. **Propiedades (Vitest + generadores)**: invariante de stock de RB-002 ante secuencias arbitrarias alta/edición/baja de líneas (RF-017 CA2).
3. **BD/RLS (pgTAP, `supabase test db` sobre instancia local con seed)**: por cada una de las 23 tablas → 3 casos (anon sin permiso, admin sin el código, cliente de portal) + pruebas de concurrencia de `facturar` (RB-003/004), CHECK (RB-010/014/015/019/020/030) y `RESTRICT` (RB-022).
4. **E2E (Playwright)** contra `supabase start` local: (a) crear → facturar orden, (b) crear venta con descuento y ver stock, (c) login portal → ver y imprimir orden. Datos del seed, nunca producción (RB-001).
5. **Puertas de CI**: `tsc --noEmit`, `oxlint`, `vitest run`, `supabase test db`, `playwright test` (rama), `vite build` con presupuesto de bundle y escaneo `gitleaks` (RNF-S-07).
6. Seeds reproducibles con `supabase db reset` (RNF-M-04); datos de prueba identificables y limpiables (RB-001).

**Alternativas descartadas.**
- *Sólo E2E*: no cubre la matriz RLS×código con costo razonable (RB-006 exige matriz). Descartado como único nivel.
- *Tests de BD con `psql -f` ad-hoc*: sin aserciones ni reportes; pgTAP es estándar. Descartado.
- *Cypress*: Playwright ya cubre y es más ligero para este stack. Descartado.

**Consecuencias.** (+) Cada RB tiene un mecanismo de verificación explícito (matriz de `BUSINESS_RULES.md` §6); la cobertura de RLS es sistemática. (−) Mantiene dos runtimes de prueba (node/jsdom + Postgres local) y requiere Docker en CI.

**Trazabilidad.** RNF-M-02, RNF-S-02, RNF-A-01, RB-001, RB-006; RF-017, RF-028, RF-035, RF-067, RF-075. **Ref.** `ARCHITECTURE.md` §14.

---

## ADR-019 — Validación compartida con zod (L1) espejo de los CHECK (L2)

**Estado:** Aceptado · **Fecha:** 2026-11-05

**Contexto.** RB-033/RNF-S-04: "validar formularios en frontend **y** backend", sin que ninguna regla dura dependa de L1. El frente necesita mensajes en español y formularios con líneas dinámicas (órdenes/ventas).

**Decisión.** Un schema **zod por formulario** en `features/<m>/model/`, usado por: (a) React Hook Form (`zodResolver`), (b) tipos derivados (`z.infer`), (c) la matriz de reglas `shared/domain/reglas.ts` que lista, para cada constante validada (longitudes, rangos, enumeraciones de estados, formato de documento), dónde está su espejo SQL. Cada schema **declara sus límites como spec de los CHECK** de la migración y pgTAP prueba el rechazo enviando datos inválidos **saltando la UI** (RNF-S-04). Validaciones de unicidad (correo, documento, `empresa` única) y de reglas multi-fila (descuento ≤ subtotal, RB-019) se delegan a BD/RPC y se mapean a mensajes por código de error (ADR-010 §`errores.ts`).

**Alternativas descartadas.**
- * Yup/ajv*: zod tiene la mejor integración con RHF/shadcn y genera tipos. Descartado.
- *Solo validación HTML/nativa*: no cumple RB-033 ni da mensajes consistentes en español. Rechazado.
- *Validar solo en BD*: UX pobre (recarga/roundtrip por cada error). Descartado.
- *Validación "inteligente" en el SPA sin CHECK*: reglas duras en L1, prohibido por RNF-S-04. Rechazado.

**Consecuencias.** (+) Doble validación real y trazable; tipos únicos para formularios; los errores de BD se traducen a lenguaje de negocio. (−) Mantener en sincronía dos artefactos (schema y CHECK); se mitiga con la matriz `reglas.ts` y con un test que recorre la matriz y verifica que cada regla declarada exista en la migración.

**Trazabilidad.** RB-033; RNF-S-04, RNF-S-05; RF-010/015/020/032/041/054; HU-005, HU-013, HU-027. **Ref.** `ARCHITECTURE.md` §5, §12.

---

## ADR-020 — Eliminaciones: `ON DELETE RESTRICT` y sin borrado lógico fuera de `estado`

**Estado:** Aceptado condicionado (E-03, ex OQ-03) · **Fecha:** 2026-11-05

**Contexto.** SP pide "eliminar" en los CRUD pero no define una política de borrado; RB-022 infiere `RESTRICT`; el modelo tiene FK entrantes en clientes/productos/servicios/usuarios/garantías. La alternativa "borrado lógico" para todos los maestros tampoco está en SP (solo unos pocos tienen columna `estado`).

**Decisión.**
1. `ON DELETE RESTRICT` general; `CASCADE` únicamente en las tablas línea/hijas directas (`productos_orden`, `servicios_orden`, `items_venta`, `anexos`, `equipos_orden`), cuya existencia depende del documento padre (el padre se elimina solo si es posible según su propia regla).
2. Eliminar un maestro referenciado → error atrapado (`23503`) → «El registro tiene órdenes/ventas/movimientos asociados; no puede eliminarse.» (RF-010 CA2).
3. Baja lógica **solo** donde SP ya define `estado`: `usuarios`, `permisos`, `categorias`, `cuentas`, `marcas` (RF-056, RF-059, RF-047). No se inventa `activo` en clientes/productos/órdenes/ventas.
4. Reglas específicas: orden/venta **facturada** no se elimina (barrera L4 con mensaje; `[Recomendada]` pero necesaria para no romper RB-027); grupo de permisos con usuarios asignados no se elimina, se desactiva (RF-059).
5. Toda eliminación queda auditada (ADR-015).

**Alternativas descartadas.**
- *Borrado lógico universal*: agrega semántica no definida en SP (filtros "mostrar inactivos" en cada listado) y contradice la cláusula anti-invención. Descartado; queda a disposición de AG-001 (E-03).
- *`ON DELETE CASCADE` general*: destruiría histórico operativo al borrar un cliente (viola el espíritu de RB-001 "no eliminar datos" y la trazabilidad de órdenes). Rechazado.
- *Borrado flexible (`SET NULL`)*: dejaría órdenes sin cliente. Rechazado.

**Consecuencias.** (+) Histórico íntegro; comportamiento predecible y probado por pgTAP; coincide con RF-010/015/019/032/038 CA. (−) El operador que quiera "dar de baja" un cliente con historial debe editar o anular su uso (sin borrado); se documenta en el manual de QA. Riesgo de confusión con "eliminar" en la UI: el botón queda deshabilitado con tooltip explicativo `[Inferida]`.

**Trazabilidad.** RB-022; RF-010, RF-015, RF-019, RF-020, RF-032, RF-038, RF-054, RF-059; OQ-03; HU-005, HU-034. **Ref.** `ARCHITECTURE.md` §7.1, §16 E-03.

---

## Registro de decisiones y pendientes

| ID | Tema | ADR | Estado / responsable de aprobación |
|---|---|---|---|
| D-1 | Stack y estilo | 001, 002 | Aceptado |
| D-2 | Autenticación admin / identidades | 003 | Aceptado |
| D-3 | Portal (credenciales + emisión de sesión) | 004 | Aceptado; **PoC obligatoria sprint 1** |
| D-4 | Tabla `sesiones` | 005 | Aceptado (cierra OQ-06) |
| D-5 | Permisos (JSONB + RLS + claims) | 006 | Aceptado (cierra RF-061) |
| D-6 | Reglas duras en BD | 007 | Aceptado |
| D-7 | Stock insuficiente | 008 | **Pendiente AG-001 (E-01)** |
| D-8 | Facturación única | 009 | Aceptado |
| D-9 | Capa de datos + paginación | 010 | Aceptado |
| D-10 | Kit de UI | 011 | Aceptado |
| D-11 | Motor PDF (jsPDF) | 012 | Aceptado |
| D-12 | Storage / miniaturas | 013 | Aceptado |
| D-13 | Cola de emails | 014 | Aceptado; **proveedor pendiente AG-001 (E-02)** |
| D-14 | Auditoría | 015 | Aceptado |
| D-15 | Fechas/moneda/zona | 016 | Aceptado; **símbolo/`tz` pendiente AG-001 (E-06)** |
| D-16 | Nomenclatura y colisión `estado` | 017 | Aceptado; **corrige defecto D-01 de la migración** |
| D-17 | Pruebas | 018 | Aceptado |
| D-18 | Validación | 019 | Aceptado |
| D-19 | Eliminaciones | 020 | Aceptado; **confirmación E-03** |
| D-20 | Política de borrado de credenciales en portal | — | Aceptado como E-05 (no editar `correo`/`documento`) |

**Violaciones/defectos detectados en el entregable previo que esta arquitectura corrige:** (1) `0001_init.sql` no es aplicable por columnas duplicadas (D-01); (2) RLS permissiva `using (true)` (D-02); (3) `anon read clientes … using (true)` expone el modelo de clientes y las credenciales del portal (D-03, crítico). Escalados como **E-09** a la tarea de base de datos con prioridad máxima.

**Cambios de alcance que esta arquitectura se niega a introducir** (por SP "no improvisar" y `BUSINESS_RULES.md` §7): facturas fiscales, desfacturar/anulación, reservas de stock, máquina de estados de orden, multi-empresa, pagos en el portal, tabla de categorías de archivo, pantalla de "Respaldo", notificaciones fuera de `cola_emails`.
