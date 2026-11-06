# Checklist de Pre-Producción — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | AG-017 Deployment Manager — Validación de procedimiento de despliegue |
| Fecha | 2026-11-06 |
| Fuentes revisadas | `deploy.sh` · `.env.example` · `.github/workflows/ci.yml` · `.gitignore` · `package.json` · `docs/deployment/DEVOPS.md` (TASK-0014) · `docs/deployment/DEPLOYMENT_PLAN.md` (TASK-0015) · `supabase/migrations/` · `dist/` (artefacto actual) |
| Estado | **PREPARADO — NO DESPLEGADO**. Producción requiere aprobación humana explícita (Formulario §9 de DEPLOYMENT_PLAN.md). Este checklist NO despliega nada. |

---

## 1. Resultado de la validación del procedimiento (hallazgos)

Revisión del procedimiento actual antes de usar este checklist en un release:

| # | Hallazgo | Severidad | Evidencia | Acción recomendada |
|---|---|---|---|---|
| H1 | **Inconsistencia de nombre de archivo `.env` vs `.env.local`**: `deploy.sh` exige `.env`, pero `.env.example`, `DEVOPS.md` §2 y `DEPLOYMENT_PLAN.md` prescriben `.env.local`. Además `.gitignore` ignora `*.local` pero **no** `.env` a secas. | Media | `deploy.sh:5` · `.env.example:2` · `.gitignore:13` | Unificar. Opción A (recomendada): cambiar `deploy.sh` para verificar `.env.local`. Opción B: añadir `.env` a `.gitignore` y actualizar los docs. Mientras exista la discrepancia, el operador debe configurar **ambos** archivos o el build quedará sin `VITE_*` (app en modo diagnóstico). |
| H2 | **`npm run build` no verifica tipos**: `package.json` define `"build": "vite build"`, mientras `DEVOPS.md` §4 y `DEPLOYMENT_PLAN.md` §5 lo describen como `tsc -b && vite build`. En CI el paso existe aparte (`ci.yml:55-56`), pero un build local del operador con `deploy.sh` **no** pasa el type-check. | Media | `package.json:8` vs `ci.yml:55-62` | Cambiar el script a `"build": "tsc -b && vite build"`, o ejecutar `npx tsc -b && ./deploy.sh` siempre (anotado abajo como paso obligatorio). |
| H3 | **`deploy.sh` no ejecuta el gate de calidad**: solo hace `npm ci` + `npm run build`; no corre lint, tipos ni pruebas (vitest). El gate real es el CI verde (G1). | Baja | `deploy.sh` completo | Procedimiento válido **solo si** el CI está verde en el SHA; incorporado como precondición en §2 de este documento. |
| H4 | **Ruta de Node hardcoded** en `deploy.sh` (`/home/developer/.local/node/bin`): funciona en esta máquina, frágil en otro operador/CI. | Informativa | `deploy.sh:10` | Documentar requisito Node 22 (o ≥ 20) al inicio del script o del doc. |
| H5 | **Integridad del bundle actual: OK**. `grep -R "service_role"` y `SUPABASE_SERVICE` sobre `dist/` no arrojan coincidencias (G5 satisfecho para el artefacto presente). Verificar nuevamente sobre cada artefacto nuevo. | ✅ OK | `dist/` verificado 2026-11-06 | Repetir el comando en cada build (§5). |
| H6 | **Migraciones completas y numeradas**: presentes `0001_init.sql`–`0005_storage.sql` y `supabase/seed.sql`; el job `migraciones` del CI valida existencia/orden/no vacíos sin conectar a BD. | ✅ OK | `supabase/migrations/` recogido 2026-11-06 | Sin acción para el release; respetar orden estricto §6.2 de DEPLOYMENT_PLAN. |
| H7 | **`.env.example` sin secretos reales**: solo `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (pública por diseño) y flag opcional `VITE_EMAILS_AUTO_PROCESAR`. No hay `service_role` ni SMTP en el frontend. | ✅ OK | `.env.example` | Mantener la regla: nada sin prefijo `VITE_` se considera para el bundle. |

**Veredicto:** el procedimiento es **viable** para un despliegue controlado, condicionado a resolver H1 (nombre de archivo de entorno) y H2 (type-check local) según la acción recomendada, o a compensarlos con los pasos obligatorios de la §2.

---

## 2. Checklist operativo pre-despliegue

Marcar cada ítem con evidencia (SHA/run/comando) antes de solicitar aprobación.

### 2.1 Control de versiones y trazabilidad

- [ ] Commit candidata elegido en `main` con **CI verde** (G1): lint + `tsc -b` + `npm run test` + build — link del run: __________
- [ ] Certificado de Calidad vigente para ese SHA, incluyendo `tests/esquema/alineacion-prompt.test.ts` (17 módulos / 23 tablas intactas) (G2): informe __________
- [ ] Tag creado: `v____.__.__` (SemVer sobre `package.json`)
- [ ] Compensar H2: `npx tsc -b` ejecutado localmente sin errores __________ (omitible si el script `build` ya incluye `tsc -b`)
- [ ] `git status --porcelain` limpio; `git ls-files | grep -E "\.env"` lista solo `.env.example` (G5 parcial)

### 2.2 Variables de entorno del entorno destino

Variables que llegan al bundle (solo con prefijo `VITE_`, según `.env.example`):

| Variable | Obligatoria | Valor correcto para | Origen del valor |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Sí | URL del proyecto Supabase del entorno destino (QA o prod — **nunca mezclar**) | Dashboard Supabase → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Sí | `anon public` del proyecto destino (pública por diseño; la protección es RLS) | Dashboard Supabase → API → anon public |
| `VITE_EMAILS_AUTO_PROCESAR` | No | `false` para desactivar autoproceso de la cola de emails en el navegador (por defecto activa) | Decisión operativa del entorno |

Reglas:

- [ ] Copiar plantilla: `cp .env.example .env.local` (o `.env` según se decida para H1) y completar con el proyecto Supabase del **entorno destino**.
- [ ] **Prohibido** colocar `service_role`, claves SMTP o cualquier secreto privado en archivos `VITE_*`/el repo: solo el operador, fuera del repo/CI, usa credenciales del CLI de Supabase.
- [ ] Confirmar que el `.env*` de destino se corresponde con el entorno (mitigación de R4: smoke con un cliente conocido de ese entorno).
- [ ] `.gitignore` cubre el archivo usado (resolución de H1 aplicada o compensada).

### 2.3 Dependencias (con qué se construye y despliega)

- [ ] **Node 22 LTS** (fijado en CI vía `setup-node@v4`; ≥ 20 LTS debería funcionar) — documentar la versión usada: __________
- [ ] `npm ci` (instalación exacta desde `package-lock.json`; si falla el lockfile, regenerar localmente y re-abrir CI — no instalar sin lock)
- [ ] Cadena de build del release: `npm ci` → `npm run lint` → `npx tsc -b` → `npm run test` → `npm run build` → `dist/` (o equivalente vía CI verde + build local etiquetado)
- [ ] `./deploy.sh` ejecutado como envoltorio del build (requiere H1 resuelto o `.env` local presente; ver hallazgo H1)
- [ ] Supabase CLI disponible **solo en la máquina del operador** (nunca en CI; las claves viven fuera del repo)
- [ ] Hosting estático listo con: rewrites de todas las rutas a `index.html` (SPA react-router), CSP que permita `https://<proyecto>.supabase.co`, HSTS, `X-Content-Type-Options: nosniff`

### 2.4 Base de datos (fase 1 — SIEMPRE antes del frontend que la usa)

- [ ] Snapshot/backup previo tomado (ver §4) y registrado: __________
- [ ] Migraciones aplicadas **una sola vez, en orden estricto** (idempotencia no garantizada entre pasadas — no repetir): `0001_init.sql` → `0002_schema.sql` → `0003_rls.sql` (obligatoria antes de exponer el frontend) → `0004_negocio.sql` → `0005_storage.sql`
- [ ] `supabase/seed.sql` aplicado **solo** en dev/QA — **prohibido en producción** con datos existentes (RB-001; el seed además tiene guard interno si existe `empresa`)
- [ ] Checklist §6.3 de DEPLOYMENT_PLAN verificado: 23 tablas en español · RLS en 23/23 · RPCs críticas (`ajustar_stock`, `orden_facturar`, `venta_facturar`, etc.) · buckets privados (`anexos-orden`, `documentos`, `comprobantes`, `logos`) · primer usuario Administrador · zona horaria `America/Sao_Paulo`
- [ ] Gap conocido documentado: tabla `sesiones` queda vacía si la Edge Function de login (`auth/sesiones` / `portal-login`) no está desplegada (R1) — aceptarlo explícitamente en el formulario o desplegar la función

### 2.5 Artefacto del frontend (fase 2)

- [ ] `npm run build` con el `.env.local` del entorno destino → `dist/`
- [ ] Huellas registradas: `sha256sum dist/index.html dist/assets/index-*.js | tee SHA256SUMS.txt` (conservar en registro del release, no versionar) (G3)
- [ ] Bundle sin secretos privados: `grep -R "service_role" dist/` y `grep -R "SUPABASE_SERVICE" dist/` vacíos (G5 — la anon key es pública por diseño, no es hallazgo)
- [ ] Verificar que el bundle QA y el de prod provienen del mismo SHA (hash de bundle comparable entre builds limpias, solo cambia el `.env`)

### 2.6 Rollback preparado (condición de aprobación, G6)

- [ ] Release anterior retenido en el hosting: `releases/<tag>/dist/`
- [ ] Rollback de frontend ensayado en QA y verificado (§8.4 de DEPLOYMENT_PLAN): __________
- [ ] PITR habilitado en Supabase prod verificado (o snapshot manual obtenido si no hay PITR): __________
- [ ] Formulario §9 completo con riesgos, plan de rollback y **aprobador humano identificado** — el despliegue **no se ejecuta sin su confirmación escrita** (G7)

---

## 3. Smoke mínimo post-despliegue (referencia rápida)

Si falla V1 o V4 → rollback de frontend inmediato (§5, §8.5 de DEPLOYMENT_PLAN).

- V1 Login administrativo + cierre de sesión
- V2 Panel principal según permisos
- V3 Clientes/Productos/Servicios: listar y buscar (**solo visualizar en prod**)
- V4 Órdenes/Ventas: listar, paginar, facturar una sola vez
- V5 Reportes PDF con logo y datos de empresa
- V6 Portal del cliente (si Edge Function desplegada; si no, registrar feature deshabilitada)
- V7 Auditoría registra las acciones de esta verificación
- V8 Fechas `dd/mm/aaaa` y 2 decimales

---

## 4. Backup (obligatorio antes del release)

| Qué | Cuándo | Cómo | Dónde queda |
|---|---|---|---|
| Snapshot de BD | Fase 0, antes de tocar migraciones | PITR del proyecto Supabase de prod (verificar en Dashboard) o `supabase db dump` manual si el plan no incluye PITR | Registro del release + backup controlado |
| Artefacto frontend anterior | Fase 0 | Retener `dist/` del release anterior en `releases/<tag>/dist/` del hosting | Hosting |
| Secretos operativos | Permanente | Solo en el entorno del operador; nunca en el repo, CI o el bundle | Entorno del operador |

Objetivos (DEPLOYMENT_PLAN §8): **RPO ≤ 5 min** (PITR) · **RTO ≤ 30 min** frontend · **RTO ≤ 60 min** BD. Los buckets de Storage no se revierten; vida útil mayor que el release (restaurar objetos puntuales si fuera necesario).

---

## 5. Rollback (resumen operativo)

**Rollback de frontend (caso común, sin pérdida de datos):**

1. Revertir el sitio al `dist/` anterior retenido (`releases/<tag>-previo/dist/`) — reemplazo atómico; invalidar CDN si aplica.
2. Smoke V1/V2/V4/V8. El frontend anterior es compatible hacia atrás con las migraciones aditivas: no se toca la BD.

**Rollback de BD (solo situación grave, con confirmación del aprobador):**

1. Poner la app en modo lectura/mantenimiento (evitar escrituras).
2. Restaurar point-in-time a `t0` (instante previo a la fase de migraciones) o cargar el snapshot `db dump`.
3. Las migraciones **no tienen `down`**: no se revierten, se restaura. Verificar checklist de BD (23 tablas, RLS, RPCs, buckets) y `logs_auditoria` para el punto de corte.
4. Registrar y notificar los datos escritos entre `t0` y el rollback (pérdida aceptada en el formulario).

**Disparadores:** fallo de smoke V1/V4 → rollback frontend inmediato; corrupción de datos tras migraciones → rollback BD con aprobador; sospecha de clave expuesta / RLS deshabilitado → rollback inmediato + rotación de claves + incidente documentado.

---

## 6. Antes de firmar el Formulario §9 (producción)

- [ ] Hallazgos H1–H4 resueltos o aceptados formalmente
- [ ] Todos los ítems de §2 marcados con evidencia
- [ ] Gate Go/No-Go G1–G7 de DEPLOYMENT_PLAN §5.1 satisfecho
- [ ] Aprobador humano (nombre, rol, fecha/hora) disponible y de acuerdo con el plan de rollback propuesto y los riesgos aceptados
- [ ] Riesgos R1–R7 (DEPLOYMENT_PLAN §10) revisados, con mitigaciones ejecutadas o aceptadas formalmente

> **Recordatorio:** este checklist prepara y valida; **no autoriza**. El despliegue a producción se ejecuta únicamente con el Formulario §9 completado y firmado por el aprobador humano.
