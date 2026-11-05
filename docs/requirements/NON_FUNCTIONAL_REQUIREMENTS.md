# Requisitos No Funcionales — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0001 — Requirements Analysis |
| Autor | AG-004 Business Analyst |
| Fecha | 2026-11-05 |
| Versión | **2.0** — Rebasing contra la fuente de verdad. Sustituye a v1.1 (referenciaba RB/RF de un dominio no presente en SP; ver `FUNCTIONAL_REQUIREMENTS.md` §9) |
| Fuente de verdad | `docs/requirements/SOURCE_PROMPT.md` (SP) |
| Dependencias | RF-xxx (`FUNCTIONAL_REQUIREMENTS.md`), RB-001…RB-036 (`BUSINESS_RULES.md`), HU-xxx (`USER_STORIES.md`) |

Clasificación: `[CONFIRMADA]` = impuesta explícitamente por SP; `[INFERIDA]` = consecuencia mínima necesaria para operar lo que SP exige; `[RECOMENDADA]` = buena práctica del analista, negociable con AG-001 sin dañar el alcance. Todo RNF incluye **método de verificación**.

---

## 1. Idioma, usabilidad y presentación (SP §STACK: “Idioma de la interfaz: español”; “Diseño: responsive, tipo panel administrativo clásico…”)

### RNF-U-01 Idioma español en toda la interfaz `[CONFIRMADA]`
Toda la UI, mensajes de validación, nombres de módulo/columnas visibles, plantillas de email generadas por el sistema y documentos impresos/PDF en español. Los datos capturados se muestran tal cual.
- **Verificación:** recorrido QA de las 17 pantallas + PDF + email de muestra: 0 cadenas de sistema en otro idioma.

### RNF-U-02 Panel administrativo clásico responsivo `[CONFIRMADA]`
Layout con barra lateral/superior, contenido tipo panel administrativo, usable en escritorio y en tablet/móvil (responsive Tailwind).
- **Verificación:** inspección en 1280px / 768px / 360px de ancho: sin scroll horizontal roto, menú y tablas utilizables.

### RNF-U-03 Patrones de listado obligatorios: tablas, formularios, modales y paginación `[CONFIRMADA]`
SP exige explícitamente “tablas, formularios, modales y paginación”. Todo listado de los 17 módulos usa paginación server-side. Búsquedas con autocompletado cubiertas en RNF-U-04.
- **Verificación:** cada listado con ≥ 2 páginas de datos de ejemplo permite navegar; consultas usan `.range()`/`LIMIT` (revisión de código).

### RNF-U-04 Autocompletados `[CONFIRMADA — SP §FUNCIONALIDADES Órdenes]`
Búsquedas de tipo autocompletado con lista desplegable en: clientes, productos, servicios, usuarios y términos de garantía (formulario de orden) y en los selectores definidos por RF-047/RF-058.
- **Verificación:** escribir 2 caracteres → lista en < 500 ms con datos semilla; selección completa campos automáticamente (RB-021).

### RNF-U-05 Formato visual de datos `[CONFIRMADA — RB-007/RB-008]`
Fechas siempre `dd/mm/aaaa`; importes siempre 2 decimales. Un formateador centralizado en el frontend (no ad-hoc por pantalla).
- **Verificación:** test unitario del formateador; grep QA: no hay render de fecha sin formateador.

### RNF-U-06 Accesibilidad base `[RECOMENDADA]`
Componentes shadcn/ui con foco visible, navegación por teclado en formularios principales (orden, venta, login) y contraste AA en texto de cuerpo.
- **Verificación:** axe-core en rutas críticas: 0 violaciones críticas.

---

## 2. Rendimiento

### RNF-P-01 Tiempos de respuesta operativos `[INFERIDA]`
Para carga de taller pequeño/mediano (supuesto: ≤ 10 000 órdenes y 5 000 clientes históricos): listados y panel ≤ 2 s P95; guardado de formulario ≤ 1,5 s P95; autocompletado ≤ 1 s P95.
- **Verificación:** script de carga con dataset semilla + métricas Performance API del navegador. Umbrales negociables con AG-001.

### RNF-P-02 Queries acotados `[INFERIDA de RNF-U-03]`
Prohibido traer tablas completas al cliente: listados paginados; los reportes “rápidos (todos los registros)” se generan en backend/páginas y no cargan toda la tabla en memoria del navegador (streaming o paginación de generación PDF).
- **Verificación:** revisión de consultas (SELECT con LIMIT/`.range()`); generación de PDF de 500+ filas sin caerse.

### RNF-P-03 Bundle SPA moderado `[RECOMENDADA]`
React+TS con code-splitting por ruta; bundle inicial gzip ≤ 400 KB.
- **Verificación:** reporte `vite build` + presupuesto en CI.

### RNF-P-04 Generación de PDF `[CONFIRMADA — SP §STACK]`
Librería compatible **jsPDF o react-pdf**; “manteniendo el mismo contenido y formato de los reportes” (encabezado empresa + tabla + paginación, RB-005). Un único motor reutilizado por Informes, impresión de orden/venta/garantía y portal.
- **Verificación:** mismo snapshot de datos produce PDF visualmente idéntico en los 4 contextos; QA visual.

---

## 3. Seguridad (SP §SEGURIDAD, íntegra → RB-031…RB-036)

### RNF-S-01 Hash de contraseñas `[CONFIRMADA — RB-011]`
bcrypt/argon2 (o Supabase Auth con hash seguro equivalente). Nunca texto plano en BD, logs, respuestas ni frontend.
- **Verificación:** inspección del registro de usuario semilla: valor hasheado; grep de contraseñas en repo → 0.

### RNF-S-02 Row Level Security en todas las tablas `[CONFIRMADA — RB-031]`
RLS activado sobre las 23 tablas del modelo SP. Las políticas derivan: tipo de sesión (admin/cliente) y códigos de permiso (RB-006/RB-029). La denegación aplica aunque se consulte la API directamente.
- **Verificación:** suite de tests por tabla: JWT de cliente portal → solo sus filas en sus tablas permitidas; JWT admin sin `vCliente` → 0 filas/403 en `clientes`; anon → nada.

### RNF-S-03 Separación de roles administrador/cliente `[CONFIRMADA — RB-032]`
Tokens/claims distintos por tipo de sesión; el portal no puede alcanzar rutas/claims administrativos y viceversa (portal ≠ panel con UI oculta; es otro tipo de sesión).
- **Verificación:** intento de acceso a endpoint de panel con sesión de portal → 403 y 0 filas.

### RNF-S-04 Validación frontend + backend `[CONFIRMADA — RB-033]`
Cada formulario valida en el cliente (UX) y las mismas reglas se imponen en BD/backend (CHECK, FK, RPC). Ninguna regla dura (RB-008/010/017/018/019/020) existe solo en la UI.
- **Verificación:** pruebas de API enviando datos inválidos saltándose la UI → rechazo garantizado.

### RNF-S-05 Sanitización e inyección `[CONFIRMADA — RB-034]`
Entradas de texto libre (descripciones, laudo, mensaje de email, cliente_proveedor…) sanitizadas; salida escapada; sin SQL concatenado (solo PostgREST/SQL parametrizado); sin HTML inyectado renderizado.
- **Verificación:** fuzzing de formularios con payloads XSS/SQL; tests dedicados a campos de texto largo.

### RNF-S-06 Rutas privadas protegidas `[CONFIRMADA — RB-035]`
Rutas del panel y del portal requieren sesión válida del tipo correspondiente; sin sesión → redirección al login respectivo; la expiración (RB-013) desconecta.
- **Verificación:** acceso directo a `/ordenes` (etc.) sin token → login; con token vencido → login.

### RNF-S-07 No exponer credenciales en el frontend `[CONFIRMADA — RB-036]`
En el bundle solo `VITE_SUPABASE_URL` + `anon key` públicas. `service_role`, secretos SMTP y claves de proveedor de email: únicamente server-side (Edge Functions/variables del proyecto). `.env` fuera de git; `.env.example` versionado.
- **Verificación:** escaneo gitleaks/grep del repo y del bundle construido → 0 claves privadas.

### RNF-S-08 Parámetros de sesión `[INFERIDA — de RB-013]`
SP exige “sesión persistente con expiración” sin cifras. Default propuesto: access token 60 min con refresh silencioso; inactividad > 12 h re-login (admin); portal: expiración ≤ 24 h. Validar en diseño.
- **Verificación:** prueba de expiración simulada.

### RNF-S-09 Registro de eventos de seguridad `[RECOMENDADA]`
Logins fallidos y denegaciones de permiso relevantes se anotan en `logs_auditoria` (dentro del concepto SP de “acciones relevantes”, RB-009; la lista final se aprueba en diseño).
- **Verificación:** login fallido → fila de log con usuario intentado e IP.

---

## 4. Confiabilidad e integridad de datos

### RNF-A-01 Atomicidad de operaciones compuestas `[INFERIDA — RB-002/003/004]`
Las operaciones multi-tabla —facturar orden/venta (documento + movimiento + flags), agregar/quitar línea (línea + stock), limpiar cola procesada— se ejecutan en una transacción/RPC única. Un fallo intermedio no deja stock descontado sin línea (ni factura sin movimiento).
- **Verificación:** inyección de fallo en el segundo paso de `facturar_orden` → rollback completo comprobado por invariante.

### RNF-A-02 Cola de emails no bloqueante `[INFERIDA — SP §Cola]`
El fallo del proveedor de correo no interfiere con la operación de negocio (la orden se envía a cola igualmente); los emails quedan `fallido` para reintento (RF-073).
- **Verificación:** mocking de fallo SMTP: acción “enviar orden por correo” termina OK; la fila queda `fallido`/`pendiente` según estrategia y se reprocesa.

### RNF-A-03 Copias de seguridad `[RECOMENDADA]`
Backup automático diario de la base (plan Supabase Pro o volcado programado) y de Storage; retención ≥ 30 días; prueba de restauración documentada.
- **Verificación:** revisión de plan + registro de una restauración real. (Nota: coexiste con RB-001: ningún job toca datos de producción como “prueba” destructiva.)

### RNF-A-04 Disponibilidad `[RECOMENDADA]`
Objetivo orientativo 99,5 % mensual en horario operativo, dependiente del SLA del plan Supabase contratado.
- **Verificación:** monitoreo externo; informe mensual.

---

## 5. Escalabilidad

### RNF-E-01 Carga objetivo `[INFERIDA]`
Taller mono-sede: ≥ 10 usuarios administrativos concurrentes + sesiones de portal activas sin degradar RNF-P-01. Crecimiento previsto: 5 años de datos operativos.
- **Verificación:** prueba de carga 10 usuarios virtuales × 10 min (crear orden, listar, facturar).

### RNF-E-02 Índices y búsquedas `[INFERIDA — RF-011/029]`
Índices para: búsqueda de clientes (nombre, documento, correo), autocompletado de productos/servicios/usuarios/garantías, filtros financieros (fechas, estado `pagado`), `orden_id`/`venta_id`/`cliente_id` foráneos, unique de login/correo.
- **Verificación:** `EXPLAIN ANALYZE` de las consultas principales sin seq-scan sobre dataset semilla grande.

---

## 6. Mantenibilidad y calidad de ingeniería

### RNF-M-01 Stack estricto `[CONFIRMADA]`
React + TypeScript (modo strict) + Tailwind CSS + shadcn/ui + Supabase (PostgreSQL, Auth, Storage, RLS). No se introducen frameworks backend propios ni librerías UI que dupliquen shadcn. PDF: jsPDF o react-pdf (RNF-P-04).
- **Verificación:** `tsc --noEmit` + ESLint en CI; revisión de `package.json`.

### RNF-M-02 Pruebas `[CONFIRMADA por RB-001 + INFERIDA]`
Suite mínima: (a) lógica de negocio RB-002/003/004/017/018/019/020/021/025/026 con tests unitarios/de integración; (b) suite de RLS por tabla/rol (RNF-S-02); (c) E2E de los 3 flujos principales: crear→facturar orden, crear venta con stock, login portal y ver orden. Las pruebas usan datos de ejemplo mínimos en entorno aislado — **nunca producción** (RB-001).
- **Verificación:** cobertura de servicios/lógica ≥ 80 % `[RECOMENDADA]`; E2E verdes en CI.

### RNF-M-03 Configuración por entorno `[CONFIRMADA — RNF-S-07]`
URLs/claves públicas vía variables `VITE_*`; secretos solo server-side. Sin valores hardcodeados de proyecto en código.
- **Verificación:** escaneo de repo (gitleaks) → 0 credenciales versionadas.

### RNF-M-04 Semillas de datos `[CONFIRMADA — SP §ENTREGABLE “datos de ejemplo mínimos”]`
Migrations + seed versionados y reproducibles: empresa, grupo de permisos completo + un usuario, catálogo pequeño por módulo (clientes, productos, servicios, garantías, categorías, cuentas, marcas/equipos), una orden y una venta de ejemplo, un email en cola, un log.
- **Verificación:** `supabase db reset` (entorno local) levanta esquema y seed de extremo a extremo.

### RNF-M-05 Documentación `[INFERIDA del entregable]`
README de arranque (env vars, migraciones, seed), ERD de las 23 tablas y matriz de permisos publicada en `docs/`.
- **Verificación:** desarrollador nuevo levanta el proyecto siguiendo el README en ≤ 30 min (prueba real en QA).

---

## 7. Compatibilidad y despliegue

### RNF-C-01 Navegadores `[INFERIDA]`
Últimas 2 versiones de Chrome, Edge, Firefox, Safari (escritorio); navegadores móviles para el portal del cliente. Sin soporte IE11.
- **Verificación:** matriz de smoke tests.

### RNF-C-02 Impresión/PDF `[CONFIRMADA — funcionalidades de impresión SP]`
Impresión de orden, venta, garantía y reportes vía PDF descargable/visualizador (RNF-P-04); legible en A4 por defecto `[INFERIDA]` (SP fija “datos tabulados y paginación”, no el tamaño).
- **Verificación:** prueba de impresión de cada documento con empresa semilla; paginación correcta con > 1 página.

### RNF-C-03 Zona horaria y reloj `[INFERIDA]`
Almacenamiento `timestamptz` UTC; visualización en zona local del taller (país del entorno SP sugiere zona brasileña `[PENDIENTE — ver nota de moneda en RB-008]`); `logs_auditoria.fecha`/`hora` y “hoy” de vencidos (RB-025) calculados en zona local.
- **Verificación:** test con cliente en TZ distinta; la fecha dd/mm/aaaa mostrada no cambia de día.

---

## 8. Escalaciones dependientes de AG-001

| RNF afectada | Pregunta relacionada (ver `FUNCTIONAL_REQUIREMENTS.md` §8) | Nota |
|---|---|---|
| RNF-A-02, RNF-P-02 | OQ-01 (proveedor de email) | Elegir SMTP/Edge Function; no altera UI. |
| RNF-P-01, RNF-E-01 | Umbrales numéricos | Son supuestos de analista (`[INFERIDA]/[RECOMENDADA]`), negociables sin dañar trazabilidad. |
| RNF-A-03, RNF-C-03 | OQ + RB-008 (moneda/zona) | Entorno fiscal sugiere Brasil; confirmar símbolo y zona. |
| RNF-S-08 | RB-013 | SP fija “expiración” sin cifras; defaults propuestos requieren visto bueno. |

> Ningún RNF `[CONFIRMADA]` de esta lista puede recortarse sin enmendar SP. Los `[RECOMENDADA]` son negociables con AG-001.
