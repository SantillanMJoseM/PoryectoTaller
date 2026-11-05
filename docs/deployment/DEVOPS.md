# DevOps — Sistema Taller

> TASK-0014 · AG-016 · DevOps Foundations
> Stack obligatorio: **React + TypeScript + Tailwind CSS + shadcn/ui + Supabase**
> Fuente de verdad de negocio: `docs/requirements/SOURCE_PROMPT.md` (no se agregan ni cambian módulos).

---

## 1. Resumen

Documento de fundamentos de DevOps del proyecto: pipeline de CI, plantilla de variables de entorno, configuración de build y estrategia de despliegue prevista. **Este repo no despliega a producción desde CI** y no almacena secretos; el despliegue real se describe como procedimiento manual/externo.

Componentes del sistema (según la arquitectura ya implementada):

| Componente | Tecnología | Notas |
|---|---|---|
| Frontend SPA | React 19 + TypeScript + Vite 5 | UI en español, panel administrativo clásico |
| Estilos/UI | Tailwind CSS 4 + shadcn/ui | `src/components/ui/*`, alias `@ → ./src` |
| Backend/BD | Supabase (PostgreSQL + Auth + Storage + RLS) | Migraciones en `supabase/migrations/0001–0005` |
| PDF | jsPDF | `src/lib/pdf.ts`, usa datos de la empresa |
| Lint | oxlint | `npm run lint` |
| Pruebas | Vitest | `npm run test` (`src/test/*.test.ts`) |

---

## 2. Variables de entorno

Plantilla entregada: **`.env.example`** (valores de marcador, sin secretos reales).

| Variable | Uso | ¿Secreta? | Definida en |
|---|---|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase | No | Dashboard Supabase → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima `anon public` | No (pública por diseño) | Dashboard Supabase → API → anon public |

Reglas:

1. **Solo variables con prefijo `VITE_`** llegan al bundle del frontend (Vite). Por eso no existen —ni deben existir— claves `service_role` ni secretos SMTP en el frontend. Las credenciales se leen en `src/lib/supabase.ts`.
2. La anon key es pública por diseño: la protección real de los datos es **Row Level Security** (`supabase/migrations/0003_rls.sql` y `docs/database/RLS_POLICIES.md`).
3. En local se usa `.env.local` (git-ignorado). El ejemplo se copia con `cp .env.example .env.local`.
4. Si las variables están ausentes, la app arranca en modo diagnóstico (`avisoConfiguracion()`), lo que permite hacer build en CI **sin secretos**.
5. Comandos Supabase (CLI) que necesitarían secretos se ejecutan **fuera del repo/CI**, por un operador autenticado (ver §5).

---

## 3. Pipeline de CI (`.github/workflows/ci.yml`)

Disparadores: `push` a `main` y `pull_request` a `main`; con `concurrency` para cancelar corridas obsoletas y `permissions: contents: read`.

### Job `calidad` — Calidad, pruebas y build

| Paso | Comando | Propósito |
|---|---|---|
| Setup | `actions/checkout@v4`, `actions/setup-node@v4` (Node 22, cache npm) | Instalación reproducible |
| Dependencias | `npm ci` | Instala exactamente desde `package-lock.json` |
| Lint | `npm run lint` (oxlint) | Estilo/detección temprana de errores |
| Tipos | `npx tsc -b` | Verificación de tipos de `tsconfig.app.json` |
| Pruebas | `npm run test` (vitest run) | Suite en `src/test/` (dinero, fechas, permisos, validaciones, financiero, emailQueue, supabase, smoke) |
| Build | `npm run build` = `tsc -b && vite build` | Produce `dist/` |
| Artefacto | `actions/upload-artifact@v4` | Guarda `dist/` (`sistema-taller-dist`, 7 días) |

### Job `migraciones` — Validación estática SQL

Verificación liviana de `supabase/migrations/*.sql`: que existan, estén ordenadas por numeración (0001–0005) y no estén vacías. **No se conecta a ninguna base de datos**: CI no contiene secretos. El push real de migraciones y datos de ejemplo (seed) es un paso manual del operador (ver §5).

### Qué NO hace este pipeline

- No despliega a producción ni a ningún entorno.
- No requiere `secrets:` de GitHub (build sin env es válido por diseño).
- No ejecuta la aplicación contra un proyecto Supabase real (eso pertenece a QA manual, ver `docs/qa/PLAN_PRUEBAS_TASK-0010.md`).

---

## 4. Configuración de build

- **Comando:** `npm run build` → `tsc -b && vite build` (types first, luego bundle).
- **Salida:** `dist/` — SPA estática (el repo ya contiene una build previa de referencia).
- **Alias:** `@` → `./src` (`vite.config.ts`, `tsconfig.app.json`).
- **Plugins:** `@vitejs/plugin-react`, `@tailwindcss/vite` (Tailwind 4 vía plugin).
- **Vitest:** entorno `node` configurado dentro de `vite.config.ts`.
- **Suposición de hosting:** SPA con rutas cliente (react-router) → el host debe servir `index.html` ante rutas desconocidas (rewrites a `index.html`, no 404).

Versiones Node soportadas: **22 LTS** (usada en CI). Cualquier versión ≥ 20 LTS debería funcionar; CI fija 22 para reproducibilidad.

---

## 5. Estrategia de despliegue (prevista, no ejecutada)

Arquitectura de dos piezas, coherente con el stack:

```
┌──────────────────────┐        ┌─────────────────────────────┐
│  Frontend SPA (dist) │  HTTP  │  Proyecto Supabase          │
│  hosting estático    │ ─────▶ │  Postgres (RLS) + Auth +    │
│  + rewrites a index  │        │  Storage (documentos/anexos)│
└──────────────────────┘        └─────────────────────────────┘
```

### 5.1 Entornos

| Entorno | Supabase | Origen del build | Despliegue |
|---|---|---|---|
| Desarrollo local | Proyecto dev (o local) | `npm run dev` | Manual (`vite` dev server) |
| QA / previsualización | Proyecto QA | CI `dist/` (artefacto) | Carga manual del artefacto por el operador |
| Producción | Proyecto prod | Build etiquetado (`npm run build`) | Procedimiento manual; **CI no despliega** |

> Regla de negocio del prompt fuente: **no eliminar datos de producción durante pruebas**. Por eso cada entorno usa un proyecto Supabase separado y las pruebas corren contra QA/dev, nunca contra prod.

### 5.2 Procedimiento manual de base de datos (operador)

Orden estricto de migraciones (idempotencia no garantizada entre pass repetidos):

1. `supabase/migrations/0001_init.sql`
2. `0002_schema.sql`
3. `0003_rls.sql` (habilita Row Level Security: obligatorio antes de exponer el frontend)
4. `0004_negocio.sql`
5. `0005_storage.sql` (buckets privados `documentos` y `anexos`)
6. `supabase/seed.sql` — solo en dev/QA (datos de ejemplo mínimos); **nunca** seed en producción sobre datos existentes.

La ejecución se realiza con Supabase CLI por el operador autenticado (las claves del CLI viven en el entorno del operador, no en el repo ni en CI).

### 5.3 Procedimiento manual de frontend (operador)

1. `npm ci && npm run lint && npx tsc -b && npm run test` (o descargar el artefacto del CI).
2. `npm run build` con `.env.local` apuntando al Supabase del entorno destino.
3. Publicar el contenido de `dist/` en el hosting estático elegido, configurando **rewrites de SPA** (toda ruta → `index.html`) y cabeceras seguras (`Content-Security-Policy` que permita `https://<proyecto>.supabase.co`, `Strict-Transport-Security`).

### 5.4 Checklist previo a un futuro despliegue

- [ ] `.env.local` del entorno con los valores del Supabase destino (URL + anon key).
- [ ] Migraciones 0001–0005 aplicadas; conectividad verificada con `supabase health`/login manual.
- [ ] RLS activo en todas las tablas (0003) y buckets privados (0005).
- [ ] Reglas operativas validadas: stock automático al agregar/quitar productos en órdenes y ventas; facturado una sola vez (orden y venta) creando movimiento financiero; fechas `dd/mm/aaaa`; valores con 2 decimales; auditoría registrando usuario, tarea, fecha, hora e IP; cola de emails con estados `pendiente, enviando, enviado, fallido`.
- [ ] Portal del cliente probado (correo + documento).
- [ ] PDFs de reportes con logo y datos de la empresa (módulo Empresa configurado).
- [ ] Sin secretos en el repo: revisar `git status` antes de publicar; `.env*` git-ignorado.

---

## 6. Solución de problemas de CI

| Síntoma | Causa probable | Acción |
|---|---|---|
| `npm ci` falla por lockfile | `package.json` editado sin regenerar lock | Ejecutar `npm install` local y confirmar `package-lock.json` |
| Fallo en `npm run test` | Pruebas Vitest | Correr `npm run test -- src/test/<archivo>` local; suite no requiere Supabase real |
| Fallo en `tsc -b` | Tipo agregado nuevo sin tipar | Revisar `src/lib/types.ts` y errores tsbuildinfo |
| Build producida sin datos | Faltan `VITE_SUPABASE_*` | Esperado en CI (build sin secretos); configurar `.env.local` local |
| Job `migraciones` en error | Migración vacía o falta 0001–0005 | Verificar `supabase/migrations/` |

---

## 7. Entregables de esta tarea

| Archivo | Contenido |
|---|---|
| `.github/workflows/ci.yml` | Pipeline: lint + tipos + pruebas + build + artefacto; validación estática de migraciones |
| `.env.example` | Plantilla de variables `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (sin secretos) |
| `docs/deployment/DEVOPS.md` | Este documento |

Módulos y reglas de negocio: sin cambios — se conservan los 17 módulos y tablas de `docs/requirements/SOURCE_PROMPT.md`.
