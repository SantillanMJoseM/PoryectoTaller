# Sistema Taller

Sistema web de gestión para talleres y servicios técnicos. Stack: **React + TypeScript + Tailwind CSS + shadcn/ui + Supabase** (PostgreSQL, Auth, Storage, Row Level Security). Interfaz en español.

## Módulos

Los 17 módulos del SOURCE_PROMPT (`docs/requirements/SOURCE_PROMPT.md`), sin agregados ni renombres:

| # | Módulo | Ruta | Código de permiso |
|---|---|---|---|
| 1 | Autenticación administrativa | `/login` | — |
| 2 | Panel principal | `/` | abierto a sesiones |
| 3 | Clientes | `/clientes` | `vCliente` (a/e/d para acciones) |
| 4 | Productos | `/productos` | `vProducto` |
| 5 | Servicios | `/servicios` | `vServicio` |
| 6 | Órdenes de trabajo | `/ordenes` | `vOrden` |
| 7 | Ventas | `/ventas` | `vVenta` |
| 8 | Garantías | `/garantias` | `vGarantia` |
| 9 | Financiero | `/financiero` | `vMovimiento` |
| 10 | Archivos/Documentos | `/documentos` | `vArchivo` |
| 11 | Usuarios | `/usuarios` | `vUsuario` |
| 12 | Permisos | `/permisos` | `vPermiso` |
| 13 | Informes/Reportes | `/reportes` | `rCliente`/`rProducto`/`rServicio`/`rOrden`/`rVenta`/`rMovimiento` |
| 14 | Auditoría | `/auditoria` | `vAuditoria` |
| 15 | Cola de emails | `/emails` | `vEmail` |
| 16 | Portal del cliente | `/portal` | público por correo + documento |
| 17 | Configuración de empresa | `/empresa` | `cEmpresa`/`eEmpresa`/`vEmpresa` |

## Documentación

| Área | Documento |
|---|---|
| Requisitos (fuente de verdad) | `docs/requirements/SOURCE_PROMPT.md` |
| Requisitos funcionales / reglas / no funcionales / historias | `docs/requirements/FUNCTIONAL_REQUIREMENTS.md`, `BUSINESS_RULES.md`, `NON_FUNCTIONAL_REQUIREMENTS.md`, `USER_STORIES.md` |
| Arquitectura | `docs/architecture/ARCHITECTURE.md`, `ADR.md`, `COMPONENT_DIAGRAM.md` |
| Base de datos | `docs/database/DATA_MODEL.md`, `MIGRATIONS.md`, `RLS_POLICIES.md` |
| Guías de esta tarea (TASK-0016) | **`docs/USER_GUIDE.md`** · **`docs/TECHNICAL_GUIDE.md`** |
| UX/UI | `docs/ux-ui/UX_SPEC.md`, `SCREEN_CATALOG.md` |
| QA | `docs/qa/PLAN_PRUEBAS_TASK-0010.md` |
| Despliegue | `docs/deployment/DEPLOYMENT_PLAN.md`, `DEVOPS.md` |

## Arranque (desarrollo)

Requisitos: Node.js y CLI de Supabase.

```bash
npm install
cp .env.example .env.local    # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
supabase start                # Postgres + Auth + Storage locales
supabase db reset             # aplica supabase/migrations (0001–0005) y carga supabase/seed.sql
npm run dev                   # http://localhost:5173
```

Si se omite `.env.local`, la app arranca en modo diagnóstico (`avisoConfiguracion()` en `src/lib/supabase.ts`) y no opera contra datos reales.

## Primer usuario administrador

Las credenciales de los usuarios viven en Supabase Auth (`auth.users`, hashes bcrypt). Para el primer administrador:

1. Crear el usuario en Supabase Auth (Dashboard o `supabase auth admin`).
2. Dar de alta su ficha en `public.usuarios` con el mismo correo/id y el grupo de permisos **Administrador** (el seed crea ese grupo con todos los códigos de actividad).
3. Iniciar sesión en `/login` con correo y contraseña.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run build` | `tsc -b` + build de producción en `dist/` |
| `npm run lint` | oxlint |
| `npm run test` | Vitest: `src/test/**` (unitarias) y `tests/**` (QA de flujos con Supabase simulado) |
| `npx tsc -b` | Solo verificación de tipos |

## Estructura

```
src/
  App.tsx               # rutas + guards de sesión y permisos
  contexts/AuthContext.tsx  # sesión admin (y base del portal), `puede()` por códigos
  pages/                # 16 páginas del panel + LoginPage + Portal
  components/           # Layout, CrudPage, SimpleCrud, ConfirmDialog, ui/ (shadcn)
  services/             # una unidad por módulo (ordenes, ventas, financiero…)
  lib/                  # supabase, crud, pdf (jsPDF), permisos, fechas, dinero…
  test/                 # pruebas unitarias de utilidades puras
tests/                  # QA: flujos críticos con Supabase simulado
supabase/
  migrations/0001–0005  # esquema (23 tablas), RLS, triggers/RPC, Storage
  seed.sql              # datos de ejemplo idempotentes (RB-001)
```

## Notas operativas

- **Stock**: nunca actualizar `productos.stock` a mano; las RPC de líneas (`orden_agregar_producto`, `venta_agregar_item`, …) lo ajustan y un guard en base de datos lo impide (RB-002/017/020).
- **Facturación única**: una orden o venta se factura una sola vez (`orden_facturar` / `venta_facturar` crean el movimiento financiero y marcan `facturado = true`).
- **Reportes PDF**: se generan con jsPDF usando los datos de la empresa (encabezado, paginación, fecha `dd/mm/aaaa`, importes con 2 decimales).
- **Cola de emails**: los envíos reales requieren el Edge Function `enviar-email` y el portal completo el Edge Function `portal-login` (ver `docs/TECHNICAL_GUIDE.md` §Edge Functions; sin ellas la cola queda en *pendiente* y el portal funciona en modo local). El autoproceso en el navegador se activa/desactiva con `VITE_EMAILS_AUTO_PROCESAR`.
- **RB-001**: el seed es idempotente y nunca elimina ni modifica datos existentes.
