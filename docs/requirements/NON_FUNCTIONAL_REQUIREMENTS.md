# Requisitos No Funcionales — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0001 — Requirements Analysis |
| Autor | AG-004 Business Analyst |
| Fecha | 2026-11-05 |
| Versión | 1.1 — BORRADOR (v1.1: RNF-M-02 corregido a la serie real RB-001..RB-020 + RB-PARAM); depende de supuestos A-01..A-04 y OQ-01..OQ-06 de `FUNCTIONAL_REQUIREMENTS.md` §16 |

Clasificación: `[CONFIRMADA]` = impuesta por instrucciones del usuario; `[INFERIDA]` = supuesto a validar; `[RECOMENDADA]` = buena práctica propuesta. Cada RNF es **medible** con método de verificación explícito.

---

## 1. Usabilidad e idiomáticos

### RNF-U-01 Idioma de la interfaz `[CONFIRMADA]`
- Toda la UI, mensajes de validación, correos plantillas y documentos imprimibles en **español neutro**. Los datos del usuario se muestran tal como fueron capturados.
- **Verificación:** revisión de pantallas y exportaciones; 0 cadenas de UI en otro idioma.

### RNF-U-02 Experiencia operativa de mostrador `[INFERIDA]`
- Las 3 tareas más frecuentes (crear OT, buscar cliente, actualizar estado de OT) completables en ≤ 3 interacciones/clics desde la pantalla principal. Formularios con autocompletado de cliente/vehículo tras 2 caracteres.
- **Verificación:** prueba de usabilidad con usuario tipo (tarea cronometrada) en la semana de pruebas QA.

### RNF-U-03 Diseño responsivo `[INFERIDA]`
- UI funcional en escritorio ≥ 1280px (uso principal), tablet (mostrador) y móvil ≥ 360px para consulta (no para edición compleja). Stack Tailwind/shadcn: breakpoints estándar.
- **Verificación:** inspección en los 3 perfiles; sin scroll horizontal ni controles inaccesibles.

### RNF-U-04 Accesibilidad base `[RECOMENDADA]`
- Componentes shadcn/ui con foco visible, navegación por teclado en formularios principales y contraste WCAG 2.1 AA en texto de cuerpo.
- **Verificación:** axe-core en rutas críticas: 0 violaciones críticas; navegación de OT completa sin ratón.

---

## 2. Rendimiento

### RNF-P-01 Tiempos de respuesta de UI `[INFERIDA]`
- P95: carga de dashboard y listados (clientes, OT, inventario) ≤ 2 s con 10 000 OT históricas y 2 000 clientes. Guardado de formulario ≤ 1,5 s P95. Búsquedas tipo "starts-with" ≤ 1 s P95.
- **Verificación:** Lighthouse + script de carga (k6/Artillery o similar) con dataset semilla; métricas de navegador (Performance API).

### RNF-P-02 Paginación obligatoria `[RECOMENDADA]`
- Todo listado sirve páginas ≤ 50 registros vía RLS/Supabase `.range()`; ningún endpoint devuelve tablas completas.
- **Verificación:** revisión de consultas + prueba con 10k registros sin degradación (> 3 s).

### RNF-P-03 Rendimiento del bundle `[CONFIRMADA por stack]`
- SPA React/TypeScript: bundle inicial comprimido en gzip ≤ 300 KB; code-splitting por ruta.
- **Verificación:** reporte de build (`vite build`) + Lighthouse CI; presupuesto automatizado.

### RNF-P-04 Adjuntos `[INFERIDA]`
- Imágenes de ficha de ingreso (RF-010) ≤ 5 MB/archivo, ≤ 10/OT, en Supabase Storage; subida con feedback de progreso y miniatura diferida (lazy).
- **Verificación:** prueba de límite con archivo 5,1 MB (rechazado con mensaje claro).

---

## 3. Seguridad y privacidad

### RNF-S-01 Comunicación segura `[CONFIRMADA por stack]`
- Todo el tráfico sobre HTTPS/TLS 1.2+. Claves Supabase (anon key) solo públicas; operaciones privilegiadas con JWT de sesión; service key **únicamente** en Edge Functions/server, jamás en el cliente.
- **Verificación:** auditoría estática del bundle (grep por service key) + checklist AG-015.

### RNF-S-02 Autorización en el borde de datos (RLS) `[INFERIDA]`
- Ningún cliente puede leer/escribir datos de otro rol más allá de su permiso (RF-003); la autorización **no depende solo de la UI**: toda tabla tiene políticas RLS probadas.
- **Verificación:** suite de tests de RLS por tabla/rol (intentos directos vía API con JWT de rol bajo → 403/0 filas).

### RNF-S-03 Sesiones y credenciales `[RECOMENDADA]`
- Tokens Supabase con expiración ≤ 24 h y renovación silenciosa; inactividad ≥ 30 min exige re-login para roles que editan dinero (admin/recepción). Contraseñas ≥ 8 caracteres (política Auth de Supabase); nunca se almacenan en texto legible (gestionado por Supabase Auth).
- **Verificación:** prueba de expiración; revisión de política de password.

### RNF-S-04 Validación e inyección `[RECOMENDADA]`
- Entrada validada en cliente **y** servidor (constraints + RLS + tipos); sin concatenación SQL (PostgREST/pg-format); escapado de texto en export CSV contra fórmula CSV-injection (`=`, `+`, `-`, `@` al inicio).
- **Verificación:** pruebas de fuzzing básica en formularios; test dedicado de exportación con campos maliciosos.

### RNF-S-05 Privacidad de datos personales `[INFERIDA]`
- Solo se capturan datos personales necesarios para el servicio (identificación, contacto, placa). Acceso limitado por rol; exportación CSV de clientes solo a admin; derechos de eliminación/solicitud de borrado como proceso operativo (borrado lógico + purga por admin). `[PENDIENTE: normativa local según OQ-02]`
- **Verificación:** matriz de acceso revisada por AG-003; test de que recepcionista no exporta clientes.

### RNF-S-06 Registro de eventos de seguridad `[RECOMENDADA]`
- Intentos de acceso fallidos (login, 403 por RLS, intentos de anulación sin permiso) quedan en bitácora con usuario/IP/timestamp.
- **Verificación:** reproducción de 403 y consulta de bitácora.

---

## 4. Disponibilidad, confiabilidad y datos

### RNF-A-01 Disponibilidad objetivo `[INFERIDA]`
- Objetivo: 99,5 % mensual en horario del taller (dependiente de SLA de Supabase; el taller opera de día, ventanas de mantenimiento fuera de horario).
- **Verificación:** monitoreo externo (uptime ping a la app); informe mensual.

### RNF-A-02 Integridad transaccional `[INFERIDA — crítica de negocio]`
- Operaciones que tocan ≥ 2 tablas (entregar OT → factura → movimiento de stock) deben ser atómicas (RPC/transaction de Postgres o compensación explícita). Un fallo a mitad no deja stock descontado sin documento (ni viceversa).
- **Verificación:** test de inyección de fallo simulado (rollback); invariantes RB-006/007/018 comprobados tras la prueba.

### RNF-A-03 Copias de seguridad `[RECOMENDADA]`
- Backup automático diario de la base Supabase, retención ≥ 30 días; prueba de restauración trimestral documentada.
- **Verificación:** revisión de plan de Supabase + registro de prueba de restore (DevOps AG-016).

### RNF-A-04 Comportamiento ante fallo de servicios externos `[RECOMENDADA]`
- Caída de proveedor de email/storage: la operación de negocio principal (OT/inventario) continúa; notificaciones entran a cola de reintento (máx. 3, espera de 15 min no bloqueante).
- **Verificación:** mocking de fallo del proveedor en QA; el guardado de OT sigue exitoso.

### RNF-D-01 Retención y depuración `[INFERIDA]`
- Datos operativos y de auditoría (RF-036) retenidos ≥ 12 meses en línea; adjuntos pueden archivarse a storage de bajo costo tras 24 meses.
- **Verificación:** consulta de política + job de retención documentado.

---

## 5. Escalabilidad

### RNF-E-01 Carga concurrente `[INFERIDA A-04]`
- Soportar ≥ 10 usuarios autenticados concurrentes y ≥ 200 OT/mes sin degradar RNF-P-01. Modelo mono-sede; sin bloqueo de diseño para añadir sede futura (columna `sucursal_id` opcional). `[PENDIENTE OQ-04]`
- **Verificación:** prueba de carga k6 10 usuarios virtuales durante 10 min.

### RNF-E-02 Crecimiento de datos `[INFERIDA]`
- Índices en: placas, IDs de cliente, correlativos OT, fechas de OT, SKU. Listados operan ≤ RNF-P-01 con 5 años de datos simulados (≥ 60 000 OT).
- **Verificación:** `EXPLAIN ANALYZE` de consultas principales sobre dataset grande; índices declarados en migraciones.

---

## 6. Mantenibilidad y calidad de ingeniería

### RNF-M-01 Stack estricto `[CONFIRMADA]`
- React + TypeScript (strict) + Tailwind + shadcn/ui + Supabase; sin dependencias que dupliquen componentes UI. Lint + format en CI.
- **Verificación:** `tsc --noEmit` y ESLint en CI; revisión de package.json.

### RNF-M-02 Cobertura de pruebas `[RECOMENDADA]`
- Reglas de negocio (RB-001..RB-020 + RB-PARAM) y flujos críticos (OT, stock, dinero): cobertura ≥ 80 % en servicios/lógica y tests E2E de los 3 flujos principales (crear OT, entregar OT, ajuste de stock).
- **Verificación:** reporte de cobertura vitest + Playwright CI.

### RNF-M-03 Configuración de entorno `[CONFIRMADA por stack]`
- Secretos y URLs por variables de entorno (`VITE_SUPABASE_URL` pública; service keys solo servidor). `.env` fuera de git; plantilla `.env.example` obligatoria.
- **Verificación:** escaneo de repo (gitleaks o grep) — 0 credenciales versionadas.

### RNF-M-04 Observabilidad mínima `[RECOMENDADA]`
- Errores de cliente capturados (Sentry o Supabase logs); cada error en producción con trace ID para correlación con bitácora de servidor.
- **Verificación:** excepción sintética visible en panel durante demo de QA.

### RNF-M-05 Documentación `[CONFIRMADA por entregables]`
- README de setup, diagrama de estados de OT, diccionario de datos y guía de roles publicada en `docs/`.
- **Verificación:** un desarrollador nuevo sigue el README y levanta el proyecto en ≤ 30 min (prueba real).

---

## 7. Compatibilidad y despliegue

### RNF-C-01 Navegadores `[INFERIDA]`
- Soporte oficial: últimas 2 versiones de Chrome, Edge, Firefox, Safari (escritorio) y Chrome móvil/Safari iOS para consulta. IE11 no soportado.
- **Verificación:** matriz de smoke tests BrowserStack/similares.

### RNF-C-02 Impresión `[INFERIDA]`
- Documentos (RF-037) imprimibles en impresoras térmicas 80 mm **o** A4 según parámetro del taller; salida PDF como alternativa universal.
- **Verificación:** prueba física o vista previa PDF válida en Criterio QA.

### RNF-C-03 Reloj y zona horaria `[INFERIDA]`
- Timestamps almacenados en UTC (Postgres `timestamptz`); mostrados en zona local del taller (config RF-035). Correlativos y "hoy" se calculan en zona local.
- **Verificación:** test con servidor y navegador en TZ distintas; el día de la OT no cambia.

---

## 8. Escaladas dependientes de AG-001

| RNF afectada | Pregunta relacionada | Nota |
|---|---|---|
| RNF-S-05, RNF-D-01 | OQ-02 (país/normativa) | Requisitos legales de protección de datos y retención fiscal pueden endurecerse. |
| RNF-E-01, RNF-P-01 | OQ-04 (usuarios concurrentes) | Metas de carga son supuesto, no dato del usuario. |
| RNF-A-01 | Hosting/SLA Supabase plan contratado | Definir plan mínimo (Pro recomendado para backup diario). |

> RNF-C-02 térmica 80mm, RNF-M-02 ≥ 80 %, RNF-P-01 umbrales concretos: `[RECOMENDADA]`, pueden reducirse en negociación con AG-001 sin dañar la trazabilidad.
