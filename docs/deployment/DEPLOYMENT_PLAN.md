# Plan de Despliegue y Rollback — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0015 — Deployment Plan (AG-017 Deployment Manager) |
| Fecha | 2026-11-05 |
| Fuente de verdad de negocio | `docs/requirements/SOURCE_PROMPT.md` (17 módulos, sin cambios) |
| Documentos de base | `docs/deployment/DEVOPS.md` (TASK-0014) · `docs/database/MIGRATIONS.md` (TASK-0006) · `docs/qa/PLAN_PRUEBAS_TASK-0010.md` (TASK-0010) · `docs/architecture/ARCHITECTURE.md` · `docs/database/RLS_POLICIES.md` |
| Stack obligatorio | React 19 + TypeScript + Vite 5 + Tailwind CSS 4 + shadcn/ui + Supabase (PostgreSQL, Auth, Storage, RLS) · PDF con jsPDF · Interfaz en español |
| Estado | **PREPARADO — NO EJECUTADO**. Este plan no despliega nada por sí mismo: el paso a producción requiere **aprobación humana explícita** (Formulario del §9). |

---

## 1. Alcance y principio rector

Este documento define **cómo se despliega y cómo se revierte** el Sistema Taller en cada entorno, con dos principios innegociables:

1. **RB-001 — No eliminar datos de producción durante pruebas.** Cada entorno usa un proyecto Supabase separado; las pruebas de QA se ejecutan contra QA/dev, nunca contra prod. El seed (`supabase/seed.sql`) es idempotente y **nunca** se aplica sobre producción con datos existentes.
2. **Despliegue a producción solo con autorización humana explícita**, ligada a: proyecto, versión, commit, artefacto (con huella), entorno, estrategia, plan de rollback y riesgos (Formulario §9). Sin ese formulario firmado, **no se ejecuta el despliegue**.

**Conservación del alcance:** el despliegue no agrega, quita ni renombra módulos ni tablas. Los 17 módulos obligatorios (Autenticación administrativa, Panel principal, Clientes, Productos, Servicios, Órdenes de trabajo, Ventas, Garantías, Financiero, Archivos/Documentos, Usuarios, Permisos, Informes/Reportes, Auditoría, Cola de emails, Portal del cliente, Configuración de empresa) y las 23 tablas del modelo en español se despliegan tal como están en `supabase/migrations/`, verificados por `tests/esquema/alineacion-prompt.test.ts`.

---

## 2. Arquitectura de despliegue

```
┌──────────────────────────────┐          ┌─────────────────────────────────────┐
│  Frontend SPA (dist/, estático)│  HTTPS   │  Proyecto Supabase del entorno      │
│  hosting estático + rewrites  │ ───────▶ │  Postgres (RLS) + Auth + Storage    │
│  a index.html                 │          │  (buckets privados: anexos-orden,   │
│                               │          │  documentos, comprobantes, logos)   │
└──────────────────────────────┘          └─────────────────────────────────────┘
```

- El frontend es una SPA estática; el host debe hacer **rewrites de todas las rutas a `index.html`** (react-router) y servir cabeceras seguras: CSP que permita `https://<proyecto>.supabase.co`, HSTS, `X-Content-Type-Options: nosniff`.
- La anon key `VITE_SUPABASE_ANON_KEY` es pública por diseño: la protección real es **Row Level Security** (migración `0003_rls.sql`, 23/23 tablas). **Nunca** exponer `service_role` ni secretos SMTP en el frontend (Vite solo difunde variables con prefijo `VITE_`).
- Los datos de ejemplo (seed) y la CLI de Supabase se ejecutan fuera de CI, por el operador autenticado.

---

## 3. Entornos

| Entorno | Proyecto Supabase | Origen del build | Migraciones | Seed | Despliegue |
|---|---|---|---|---|---|
| Desarrollo local | Proyecto dev | `npm run dev` | Aplicadas por el desarrollador | `seed.sql` permitido | Manual |
| QA / previsualización | Proyecto QA dedicado | Artefacto `dist/` del CI | 0001→0005 obligatorias | `seed.sql` obligatorio (datos de ejemplo mínimos) | Carga manual del artefacto |
| **Producción** | Proyecto prod dedicado | Build etiquetado (`npm run build`) con `.env.local` de prod | 0001→0005 obligatorias | **Prohibido** (RB-001) | Manual; **solo con Formulario §9 aprobado** |

Zona horaria recomendada de la base: `America/Sao_Paulo` (E-06). Formatos `dd/mm/aaaa` y 2 decimales son responsabilidad de la UI (RB-005/RB-008), no de la base.

---

## 4. Cadencia, versionado y trazabilidad

| Ítem | Convención |
|---|---|
| Versionado | SemVer sobre `package.json` (`0.0.0` actual); release de producción etiquetado `vX.Y.Z` |
| Cadencia de Frontend | Por push a `main` en QA; a producción por release manual aprobado |
| Cadencia de Base de datos | Solo a producción en un release aprobado, junto con (o antes de) su frontend compatible |
| Artefacto frontend | `sistema-taller-dist` (upload-artifact del CI, retención 7 días) + build local etiquetado para prod |
| Trazabilidad mínima del release | etiqueta git + SHA del commit + SHA-256 de `dist/index.html` y del bundle principal + versión de migraciones aplicadas |
| Registro de auditoría | El propio sistema registra acciones (`logs_auditoria`: usuario, tarea, fecha, hora, IP) — se audita también la operación de despliegue desde la cuenta de servicio |

---

## 5. Pipeline y gate de calidad (lo que debe estar verde antes de desplegar)

Pipeline actual (`.github/workflows/ci.yml`, **CI no despliega** — solo valida y construye):

1. `npm ci` — instalación exacta desde `package-lock.json`.
2. `npm run lint` (oxlint).
3. `npx tsc -b` — verificación de tipos.
4. `npm run test` (vitest run) — suite en `src/test/` y `tests/` (unitario, integración con Supabase simulado, conservación del SOURCE_PROMPT).
5. `npm run build` (= `tsc -b && vite build`) → `dist/` + upload-artifact.
6. Job `migraciones`: validación estática de `supabase/migrations/0001–0005` (existencia, orden, no vacíos). **No** conecta a ninguna base.

> Nota de esta sesión (AG-017): la ejecución de comandos (shell) no está disponible en el entorno de preparación, por lo que `npm test` no se corrió localmente aquí; el gate obligatorio es la corrida del CI en el commit a desplegar. Si el CI está verde en ese SHA, el gate 5.1 queda satisfecho.

### 5.1 Gate de aprobación de despliegue (Go/No-Go)

**NO-GO automático** si cualquiera falla:

| # | Verificación | Evidencia |
|---|---|---|
| G1 | Pipeline CI verde en el SHA a desplegar | Run del CI con checkmark |
| G2 | Certificado de Calidad vigente del release (QA TASK-0010 suite completa en el SHA, incluyendo `tests/esquema/alineacion-prompt.test.ts` = 17 módulos y 23 tablas intactas) | Informe QA firmado |
| G3 | Integridad del artefacto: SHA-256 del `dist/` construido coincide con el registrado en el formulario | `sha256sum dist/index.html dist/assets/index-*.js` |
| G4 | Migraciones 0001–0005 aplicadas y verificadas en el entorno destino (checklist §6.3) | Salida del operador |
| G5 | Sin secretos en el repo vs. `git status` limpio; `.env*` git-ignorado; sin `service_role` en el bundle (`grep -r "service_role" dist/` vacío) | Comandos del checklist §7 |
| G6 | Rollback ensayado/validado en QA (§8.4) y plan de rollback firmado en el formulario | Formulario §9 |
| G7 | Confirmación escrita del aprobador humano (punto 9 del formulario) | Formulario §9 |

**Estrategia de despliegue:** **Rolling/replace one-shot con ventana de baja programada** para el frontend (publicación atómica del `dist/` nuevo; el sitio estático se reemplaza en segundos) y **topología compatible hacia adelante** para la BD (migraciones aditivas; ver §6.4). Para el primer despliegue a producción se asume ventana de mantenimiento con aviso previo a los usuarios.

---

## 6. Procedimiento de despliegue (operador)

### 6.1 Fase 0 — Preparación (antes de tocar entornos)

1. Elegir el SHA candidata (commit en `main` con CI verde). Crear tag `vX.Y.Z`.
2. Construir el artefacto de prod: `npm ci && npm run build` con `.env.local` apuntando al Supabase de **producción** (`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`).
3. Calcular y registrar huellas: `sha256sum dist/index.html dist/assets/index-*.js > SHA256SUMS.txt` (no versionar el archivo; conservarlo en el registro del release).
4. Validar certificado de calidad (G2) y completar el Formulario §9 con **riesgos y rollback** (aprobación queda pendiente hasta la fase 5).

### 6.2 Fase 1 — Base de datos (siempre ANTES que el frontend que la usa)

Orden estricto de migraciones (idempotencia no garantizada entre pasadas repetidas — no repetir):

1. `supabase/migrations/0001_init.sql`
2. `0002_schema.sql` (visa/índices/correcciones; incluye tabla `sesiones`)
3. `0003_rls.sql` — **obligatoria antes de exponer el frontend** (RLS en las 23 tablas)
4. `0004_negocio.sql` (triggers, RPCs de stock/facturación/auditoría/sesiones)
5. `0005_storage.sql` (buckets privados `anexos-orden`, `documentos`, `comprobantes`, `logos`)
6. `supabase/seed.sql` — **solo dev/QA**; en producción con datos existentes **nunca** (RB-001 y guard interno del seed: si existe fila de `empresa`, no resiembra nada)

Ejecución por el operador autenticado con Supabase CLI fuera del repo (las claves viven en el entorno del operador, no en CI).

**Si el entorno destino ya tiene las migraciones aplicadas:** omitir esta fase salvo que el release incluya migraciones nuevas; en tal caso aplicar solo las numeraciones faltantes en orden.

> Estado conocido (MIGRATIONS.md §5): la tabla `sesiones` se materializa pero la escritura depende de la Edge Function de login (`auth/sesiones` / `portal-login`); sin ella la tabla queda vacía (la política de lectura ya está lista). Esto **no bloquea** el despliegue de BD, pero sí la verificación funcional de sesiones (§6.4, V6).

### 6.3 Fase 2 — Verificación de base de datos (checklist obligatoria)

- [ ] 23 tablas presentes con nombres en español (`clientes`, `productos`, `servicios`, `ordenes_trabajo`, `productos_orden`, `servicios_orden`, `ventas`, `items_venta`, `garantias`, `movimientos_financieros`, `categorias`, `cuentas`, `anexos`, `documentos`, `marcas`, `equipos`, `equipos_orden`, `usuarios`, `permisos`, `empresa`, `logs_auditoria`, `cola_emails`, `sesiones`).
- [ ] RLS habilitado y con políticas en 23/23 tablas; helpers `rol_sesion`, `tiene_permiso`, etc. creados.
- [ ] RPCs críticas desplegadas: `ajustar_stock`, `orden_agregar/quitar_producto`, `orden_cambiar_cantidad_producto`, `venta_agregar/quitar_item`, `venta_cambiar_cantidad_item`, `orden_facturar`, `venta_facturar`, `mov_marcar_pagado`, `limpiar_logs`, `sesion_registrar/cerrar/purgar`.
- [ ] Buckets privados existentes: `anexos-orden`, `documentos`, `comprobantes`, `logos`.
- [ ] Primer usuario administrador creado (Supabase Auth + fila en `public.usuarios` con grupo **Administrador**).
- [ ] Fechas/hora del servidor coherentes con `America/Sao_Paulo`.

### 6.4 Fase 3 — Frontend

1. Publicar el contenido de `dist/` en el hosting estático con **rewrites a `index.html`** y cabeceras: CSP permitiendo `https://<proyecto>.supabase.co`, HSTS, `nosniff`.
2. Verificación funcional mínima post-despliegue (ceremonia "smoke" sobre prod):
   - V1 Login administrativo (correo + contraseña) y cierre de sesión.
   - V2 Panel principal carga resumen según permisos del usuario conectado.
   - V3 Clientes/Productos/Servicios listan y permiten búsqueda (en producción solo **visualizar** registros existentes: RB-001 prohíbe escribir datos de prueba en prod; las pruebas de escritura se hacen en QA).
   - V4 Órdenes y ventas listan y paginan; botón "Facturar" deshabilitado si `facturado=true`.
   - V5 Reportes PDF generan con logo y datos de la empresa (módulo Empresa configurado).
   - V6 Portal del cliente: ingreso correo + documento (si la Edge Function `portal-login` está desplegada; si no, documentar feature deshabilitada en el acta del release).
   - V7 Auditoría registra las acciones de esta verificación (usuario, tarea, fecha, hora, IP).
   - V8 Fechas en `dd/mm/aaaa` y valores con 2 decimales en todas las pantallas visitadas.
3. Anotar resultado en el registro del release (form §9, campo "Resultado").

**Secuencia en cambios de BD + frontend:** migraciones primero (son aditivas y el frontend anterior sigue funcionando), frontend después. **Rollback inverso:** frontend primero (volver al artefacto anterior), BD por restauración (§8.2).

---

## 7. Validación de integridad del artefacto y del repo

Comandos de verificación (operador, antes de publicar):

```bash
# 1) Repo limpio, sin secretos versionados
git status --porcelain                     # debe estar vacío de cambios no intencionales
git ls-files | grep -E "\.env" || true     # no debe listar .env reales (solo .env.example)

# 2) El bundle NO contiene claves service_role ni secretos
grep -R "service_role" dist/ || echo "OK: sin service_role en el bundle"
grep -R "SUPABASE_SERVICE" dist/ || echo "OK: sin service secret en el bundle"

# 3) Huella del artefacto a publicar
sha256sum dist/index.html dist/assets/index-*.js | tee SHA256SUMS.txt

# 4) El artefacto de QA y el de prod provienen del mismo SHA con solo .env distinto
#    (comparar nombre de bundle: dist/assets/index-<hash>.js debe coincidir entre builds limpias)
```

La anon key es pública por diseño y su presencia en el bundle no es un hallazgo; la protección es RLS (G5 solo vigila secretos **privados**).

---

## 8. Plan de Rollback

Objetivo de recuperación (RTO/RPO): **RTO ≤ 30 min** para el frontend (publicación del artefacto anterior); **RTO ≤ 60 min** para la BD vía restauración point-in-time de Supabase. **RPO ≤ 5 min** para prod (PITR habilitado en el proyecto Supabase de producción — verificar en Fase 0; si el plan del proyecto no incluye PITR, tomar snapshot manual previo a cada release: `supabase db dump`).

### 8.1 Rollback de frontend (caso más común, sin pérdida de datos)

1. `git checkout vX.Y(-1)` o descargar el artefacto anterior (`sistema-taller-dist` del CI del SHA previo).
2. Reconstruir o reutilizar el `dist/` del release anterior (conservar cada release en `releases/<tag>/dist/` en el hosting).
3. Publicar el `dist/` anterior (reemplazo atómico); invalidar CDN si aplica.
4. Verificación smoke V1/V2/V4/V8.
5. El frontend anterior es **compatible hacia atrás con las migraciones aditivas ya aplicadas**, por lo que este rollback es seguro sin tocar la BD.

### 8.2 Rollback de base de datos (situación grave: datos corrompidos o migración dañina)

Las migraciones **no se revierten automáticamente** (no hay `down` scripts): el rollback de BD es por **restauración**.

1. Contener: poner la app en modo lectura (o pantalla de mantenimiento) para evitar escrituras durante la restauración.
2. Restaurar **point-in-time** a `t0 = instante previo al inicio de la fase 1` (Supabase Dashboard → Database → Backups / PITR), o cargar el snapshot `supabase db dump` del release.
3. Re-aplicar, **solo si eran compatibles**, las migraciones previas al release (0001–0005 ya contenidas en el snapshot).
4. Verificar checklist §6.3 (23 tablas, RLS 23/23, RPCs, buckets) y `logs_auditoria` para confirmar el punto de corte.
5. Notificar: los datos escritos entre `t0` y el rollback se pierden → registrar qué se perdió (desde `logs_auditoria` y `cola_emails` del snapshot conservado) y avisar al aprobador.

### 8.3 Rollback de Storage

Los buckets son privados y su vida útil es mayor que la del release; no se revierten. Si una subida del release corrompió objetos, restaurar los objetos afectados desde la copia del bucket (Supabase Storage retention / snapshot del dump).

### 8.4 Ensayo de rollback (obligatorio antes del primer despliegue a producción)

- En QA: desplegar versión candidata, ejecutar rollback de frontend (§8.1) y verificar smoke.
- En QA: simular incidente de BD (marcar una migración como aplicada con efecto no deseado en un clon) y practicar la restauración PITR con datos sintéticos del seed.
- Registrar duración real para calibrar RTO.

### 8.5 Criterios de activación del rollback

- Smoke post-despliegue falla en V1 (login) o V4 (listados/facturación) → rollback inmediato de frontend.
- Reportes de corrupción/efecto en datos tras migraciones → rollback de BD (§8.2) tras confirmación del aprobador.
- Duda razonable de seguridad (clave expuesta, RLS deshabilitado) → rollback inmediato + rotación de claves + incidente documentado.

---

## 9. Formulario de aprobación de despliegue a PRODUCCIÓN (obligatorio)

> **Sin este formulario completo y firmado por el aprobador humano, NO se ejecuta el despliegue a producción** (G7). El preparador (AG-017) presenta este plan y espera la autorización explícita; el ejecutor registra el resultado.

| Campo | Valor (a completar) |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Versión / tag | `v____.__.__` |
| Commit (SHA) | ____________________ |
| Artefacto | `dist/` build del commit; huellas SHA-256: ____________________ |
| Entorno | ☐ QA ☐ **Producción** |
| Estrategia | Replace one-shot con ventana programada; migraciones aditivas antes del frontend |
| Alcance conservado | 17 módulos / 23 tablas según SOURCE_PROMPT.md — sin cambios (G2) |
| Plan de rollback | Este documento §8; artefacto anterior retenido en `releases/<tag>/dist/`; PITR configurado (RPO ≤ 5 min, RTO ≤ 60 min) |
| Riesgos identificados | 1) Edge Function `portal-login`/`auth/sesiones` pendiente (TASK-0004) → portal de cliente puede quedar inoperativo (mitigación: desplegarla o aceptar explícitamente en este formulario). 2) Idempotencia limitada de migraciones → aplicar cada numeración una sola vez en orden. 3) Ventana de baja ≤ 30 min en el primer release. 4) Rollback de BD implica pérdida de escritos desde `t0` (aceptado / no aceptado: ______) |
| Aprobador (nombre, rol, fecha/hora) | ____________________ |
| Confirmación | ☐ **APROBADO — se autoriza el despliegue a producción tal como está descrito en este documento** |
| Resultado del despliegue (post-ejecución) | ☐ Éxito ☐ Rollback de frontend ☐ Rollback de BD — notas: ____________ |

---

## 10. Riesgos y mitigaciones (registro)

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | Portal del cliente sin Edge Function de login (dependencia TASK-0004) | Media | Alto para módulo 16 | Desplegar la función en este release o aceptar el gap explícitamente en §9 |
| R2 | Migración re-aplicada por error rompe el entorno | Baja | Alto | Orden estricto §6.2, una sola pasada; checklist §6.3; snapshot previo |
| R3 | Seed ejecutado por error en producción (RB-001) | Baja | Alto | Seed prohibido en prod; el propio seed tiene guard ("si existe `empresa`, no resiembra"); doble verificación del entorno antes de ejecutar |
| R4 | Frontend desplegado contra Supabase incorrecto (env mezclado) | Baja | Medio | `.env.local` por entorno; smoke V1/V4 con cliente conocido del entorno destino |
| R5 | Degradación de datos por bug de stock/facturación en prod | Baja | Alto | Partners de la BD (triggers/guards 0004) impiden: facturación doble, stock por update directo; QA de integración cubre los flujos |
| R6 | Secretos filtrados en el bundle/repo | Baja | Alto | G5 (grep sobre `dist/`), `.env*` git-ignorado, `service_role` solo en backend/operador |
| R7 | Cola de emails acumulando fallidos (SMTP no configurado en backend) | Media | Medio | Módulo Cola de emails expone estado y reintentos; monitorizar `fallido` post-release |

---

## 11. Checklist consolidado de Go-Live (una página)

- [ ] CI verde en el SHA (G1)
- [ ] Certificado de calidad vigente, incluye conservación de 17 módulos / 23 tablas (G2)
- [ ] Huellas SHA-256 del artefacto registradas y coincidentes (G3)
- [ ] Sin secretos privados en repo ni bundle (G5)
- [ ] Rollback ensayado en QA y firmado (G6)
- [ ] Formulario §9 aprobado por humano (G7) — **requerido solo para producción**
- [ ] Migraciones 0001–0005 aplicadas una sola vez, en orden (§6.2) + checklist §6.3
- [ ] PITR/snapshot disponible (RPO ≤ 5 min)
- [ ] Smoke prop §6.4 ejecutado y registrado
- [ ] Auditoría del sistema registrando la operación (V7)
- [ ] Pendientes conocidos documentados: portal/Edge Function (R1)

---

## 12. Entregable de esta tarea

| Archivo | Contenido |
|---|---|
| `docs/deployment/DEPLOYMENT_PLAN.md` | Este documento: arquitectura de despliegue, entornos, gate Go/No-Go, procedimientos del operador, integridad de artefacto, plan de rollback (frontend/BD/storage) con ensayo, formulario de aprobación humana, riesgos y checklist de go-live |

Módulos y reglas de negocio: **sin cambios** — se conservan los 17 módulos, las 23 tablas y todas las reglas de `docs/requirements/SOURCE_PROMPT.md`; este plan no agrega módulos ni funcionalidades nuevas.
