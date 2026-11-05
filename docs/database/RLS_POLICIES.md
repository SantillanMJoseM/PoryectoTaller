# Seguridad a nivel de fila (RLS) — Sistema Taller

| Campo | Valor |
|---|---|
| Proyecto | Sistema Taller (PROJECT-001) |
| Tarea | TASK-0005 — Database Design (Seguridad RLS) |
| Autor | AG-007 Database Architect |
| Fecha | 2026-11-05 |
| Versión | 1.0 |
| Fuente de verdad | `docs/requirements/SOURCE_PROMPT.md` — SP §SEGURIDAD, §PERMISOS, §FUNCIONALIDADES 11/16 |
| Insumos | `BUSINESS_RULES.md` RB-006/012/021–026/031–036, `ARCHITECTURE.md` §9 (TASK-0003), `DATA_MODEL.md` v1.0 |
| DDL canónico | `docs/database/schema.sql` §6 (helpers) y §8 (políticas ejecutables) |

---

## 1. Principios

1. **RLS activo en las 23 tablas** (RB-031, RNF-S-02). Toda consulta pasa por el JWT del usuario
   (TASK-0003 C-2). `service_role` (Edge Functions) es la única vía con bypass — usado por el
   worker de cola de emails, detección de vencidos y alta de identidades (RB-036).
2. **Ninguna política `anon`**. Corrige el defecto crítico D-03 del prototipo
   (`0001_init.sql` publicaba `clientes` con una política `anon using (true)`, exponiendo el
   par `correo+documento` de credenciales del portal). El portal exige sesión de cliente
   (RB-032): es la rama `es_cliente()` de las políticas, no acceso anónimo.
3. **Autorización mínima**: cada operación consulta un único **código de actividad** del grupo
   del usuario (SP §11: `a` agregar, `e` editar, `d` eliminar, `v` visualizar, `r` reporte,
   `c` configuración). Ocultar botones en la UI no autoriza (defensa en profundidad L3+L4, ADR-006).
4. **Cero recursión**: las funciones helper son `SECURITY DEFINER` con `search_path` fijado
   (`public, pg_temp`), por lo que leen `usuarios`/`permisos` como propietarias y las políticas
   no subconsultan la tabla propia.
5. **Costo O(1)**: el set de permitidos se cachea en `app_metadata.permisos` del JWT al iniciar
   sesión / editar grupo (EF `admin-usuarios`, `permisos_guardar` — TASK-0004); helper
   `tiene_permiso` se cae a tabla solo si el claim falta (RNF-P-01).

## 2. Roles y vectores de sesión (RB-032)

| Rol/claim | Proviene de | Alcance |
|---|---|---|
| `rol = 'administrador'` + `usuario_id` | login admin (Supabase Auth + trigger de estado) | todo el panel, acciones limitadas por códigos del grupo |
| `rol = 'cliente'` + `cliente_id` | EF `login-portal` (correo + documento, RF-075, RB-012) | portal: solo su fila/órdenes/ventas; **ninguna tabla administrativa** |
| `anon` | sin sesión | **cero filas en todas las tablas** (sin políticas) |
| `service_role` | Edge Functions / migraciones | bypass RLS (no se usa desde el bundle) |

Claims: `app_metadata.rol`, `app_metadata.usuario_id`, `app_metadata.cliente_id`,
`app_metadata.permisos` (array de códigos). Emitidos/renovados por la EF de usuarios.

## 3. Funciones helper (`schema.sql` §6)

| Función | Retorno | Uso típico |
|---|---|---|
| `rol_sesion()` | `text` | `administrador` / `cliente` / null |
| `usuario_actual()` / `cliente_actual()` | `uuid` | subject del JWT (`usuario_id`/`cliente_id`) |
| `es_administrador()` / `es_cliente()` | `boolean` | rama por tipo de sesión |
| `tiene_permiso(p_codigo text)` | `boolean` | grupo activo (RB-023) + usuario no vencido (RB-024) + código presente |
| `es_cliente_duenio_orden(p_orden uuid)` / `es_cliente_duenio_venta(p_venta uuid)` | `boolean` | propiedad del portal vía EXISTS definer (tablas línea sin columna `cliente_id`) |

Implementación clave (extracto; texto completo en `schema.sql`):

```sql
create or replace function public.tiene_permiso(p_codigo text) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_usuario uuid := public.usuario_actual();
  v_claim   text := public.jwt_app_metadata() ->> 'permisos';
begin
  if v_usuario is null then return false; end if;
  if v_claim is not null then
    return v_claim::jsonb ? p_codigo;                -- cache del JWT (O(1))
  end if;
  return exists (
    select 1 from usuarios u
    join permisos p on p.id_permiso = u.permiso_id
    where u.id_usuario = v_usuario
      and u.estado_usuario is true                    -- RB-023
      and p.estado is true                            -- RB-023
      and (u.fecha_expiracion is null
           or u.fecha_expiracion >= current_date)     -- RB-024
      and p.permisos ? p_codigo
  );
end; $$;
```

## 4. Plantilla de políticas

```sql
-- SELECT (lectura admin + rama portal opcional)
create policy <t>_sel on <t> for select to authenticated using (
  (es_administrador() and tiene_permiso('v<Módulo>'))
  or (es_cliente() and <propiedad>)            -- si la tabla tiene vínculo de cliente
);
create policy <t>_ins on <t> for insert to authenticated
  with check (es_administrador() and tiene_permiso('a<Módulo>'));
create policy <t>_upd on <t> for update to authenticated
  using (es_administrador() and tiene_permiso('e<Módulo>'))          -- si hay rama portal, en ambos
  with check (es_administrador() and tiene_permiso('e<Módulo>'));
create policy <t>_del on <t> for delete to authenticated
  using (es_administrador() and tiene_permiso('d<Módulo>'));
```

Tablas sin rama portal (maestros administrativos): solo las 4 acciones admin.
Tablas de/logs/cola con escritura restringida: **sin políticas** de insert/update para
`authenticated` (escriben RPC `definer` o Edge Functions vía `service_role`).

## 5. Matriz de políticas por tabla (23 tablas)

«admin X» = `es_administrador() and tiene_permiso('<código>')`. Operación ⌀ = sin política
(negación total para `authenticated`; acceso solo por `definer`/`service_role`).

| Tabla | select | insert | update | delete | Rama portal | RB/RF |
|---|---|---|---|---|---|---|
| clientes | `vCliente` | `aCliente` | `eCliente` | `dCliente` | select/update su fila (`id_cliente = cliente_actual()`); credenciales protegidas por `tg_cliente_no_credenciales` | RF-010/013/079 |
| productos | `vProducto` | `aProducto` | `eProducto` | `dProducto` | — | RF-015 |
| servicios | `vServicio` | `aServicio` | `eServicio` | `dServicio` | — | RF-019 |
| marcas | `vCliente ∪ vOrden` | `aCliente` | `eCliente` | `dCliente` | — | E-04 `[Inferida]` |
| equipos | `vCliente ∪ vOrden` | `aCliente` | `eCliente` | `dCliente` | select: `cliente_id = cliente_actual()` | RF-014, E-04 |
| ordenes_trabajo | `vOrden` | `aOrden` | `eOrden` | `dOrden` | select órdenes propias | RF-020…024 |
| productos_orden | `vOrden` | `aOrden` | `eOrden` | `dOrden` | select si `es_cliente_duenio_orden(orden_id)` | RF-022, RB-021 |
| servicios_orden | `vOrden` | `aOrden` | `eOrden` | `dOrden` | select ídem | RF-023 |
| equipos_orden | `vOrden` | `aOrden` | `eOrden` | `dOrden` | select ídem | RF-031 |
| anexos | `vOrden` | `aOrden` | `eOrden` | `dOrden` | select ídem | RF-025 |
| garantias | `vGarantia` | `aGarantia` | `eGarantia` | `dGarantia` | select garantía de sus órdenes (EXISTS) | RF-038…040 |
| ventas | `vVenta` | `aVenta` | `eVenta` | `dVenta` | select ventas propias | RF-032…037 |
| items_venta | `vVenta` | `aVenta` | `eVenta` | `dVenta` | select si `es_cliente_duenio_venta(venta_id)` | RF-036, RB-021 |
| movimientos_financieros | `vMovimiento` | `aMovimiento` | `eMovimiento` | `dMovimiento` | — (el portal no ve finanzas; RF-077/078 usan RPC) | RF-041 |
| categorias | `vMovimiento` | `aMovimiento` | `eMovimiento` | `dMovimiento` | — | RF-047 |
| cuentas | `vMovimiento` | `aMovimiento` | `eMovimiento` | `dMovimiento` | — | RF-048 |
| documentos | `vArchivo` | `aArchivo` | `eArchivo` | `dArchivo` | — | RF-049…053 |
| usuarios | `vUsuario` | `aUsuario` | `eUsuario` | `dUsuario` | — (perfil propio vía RPC `auth_perfil()`) | RF-054…058 |
| permisos | `vPermiso` | `aPermiso` | `ePermiso` | `dPermiso` | — | RF-059…061 |
| logs_auditoria | `vAuditoria` | ⌀ (definer) | ⌀ | `dAuditoria` | — | RF-067…069 |
| cola_emails | `vEmail` | ⌀ (RPC/EF) | ⌀ (EF worker) | `dEmail` | — | RF-070…074 |
| empresa | admin **o** cliente (PDFs con logo, RB-005) | `cEmpresa` | `eEmpresa ∪ cEmpresa` | ⌀ | select sí | RF-081/082 |
| sesiones | `vUsuario` **o** propia (`usuario_id`/`cliente_id` del claim) | ⌀ (RPC/EF) | ⌀ | ⌀ (`sesion_purgar`) | select propia | RF-003/005 |

Notas de diseño:

- **`r` (reportes)** no necesita política propia: los reportes leen las mismas tablas con el
  código `v` correspondiente + obtención de datos por `reporte_obtener` (RF-062+) — el filtro es
  funcional, no de visibilidad. Si AG-001 exige distinguir, la plantilla se extiende a
  `tiene_permiso('vX') OR (tipo_reporte AND tiene_permiso('rX'))` — `[Inferida]`.
- **`c` (configuración)** se usa en `empresa` (crear primera vez) y `Respaldo` queda disponible
  en el editor de permisos sin acción en la UI (E-08, RF-060 CA3).
- **Separación RB-032 verificable**: el token de cliente no satisface ninguna rama
  `es_administrador()`; sobre `usuarios`/`permisos`/`movimientos_financieros` obtiene **0 filas**.
- Las **vistas** son `security_invoker = true` (DATA_MODEL §6): aplican las políticas de las
  tablas base; el acceso anónimo a datos a través de vistas queda descartado.

## 6. Políticas de Storage (ADR-013) — `schema.sql` §9

| Bucket | Contenido | select | insert | Flujo |
|---|---|---|---|---|
| `anexos-orden` | adjuntos de órdenes | `vOrden` | `aOrden` | upload por admin; descarga con URL firmada nueva cada vez (RF-025/052) |
| `documentos` | módulo Archivos | `vArchivo` | `aArchivo` | RF-049…053 |
| `comprobantes` | `movimientos.anexo` | `vMovimiento` | `aMovimiento` | RF-041 (anexo) |
| `logos` | logo empresa (público-lectura autenticada) | cualquier sesión válida (PDFs) | `cEmpresa`/`eEmpresa` | RF-082/RF-066 |

Reglas transversales: nombre sanitizado (RB-034), límite 20 MB `[Inferida]`,
`ruta = bucket/objectPath` es la fuente de verdad, `url` firmada 60 min y regenerada al listar
(nunca se reutiliza la persistida vieja). Modificar/eliminar objetos de `authenticated` queda
sin políticas (bajas lógicas por tabla + limpieza por servicio).

## 7. Verificación (pgTAP / `supabase test db`, TASK-0004)

Cada afirmación se empaqueta como test SQL por tabla/rol (RNF-S-02); si falla, el build se rompe:

1. **Matriz 23×4**: para cada tabla × {admin sin código, admin con código, cliente, anon} se
   espera exactamente el número de filas de §5 (0 en anon en las 23; 0 del cliente en tablas
   administrativas). Cualquier desviación hace fallar la suite.
2. **Portal propiedad**: cliente B no ve la orden/venta/anexo del cliente A
   (`es_cliente_duenio_*` false).
3. **Estado del grupo**: grupo `estado = false` ⇒ 0 filas con `vX` (RB-023).
4. **Expiración**: usuario con `fecha_expiracion < hoy` ⇒ 0 filas (RB-024).
5. **Claim vs tabla**: JWT sin claim `permisos` utiliza la ruta de tabla (paridad de resultado).
6. **Credenciales del portal**: `UPDATE clientes SET correo=…` con sesión de cliente ⇒ error
   (`credenciales_inmutables`); admin con `eCliente` ⇒ permitido.
7. **Stock guard**: `UPDATE productos SET stock=…` por RLS/trigger sin GUC ⇒ error `stock_guard`.
8. **Disparo por vista**: consultar `v_movimientos_situacion` con sesión de cliente ⇒ 0 filas.
9. **Registro en cola**: `INSERT cola_emails` como `authenticated` ⇒ denegado (solo RPC/EF).

## 8. Trazabilidad SP §SEGURIDAD

| Regla SP / RB | Mecanismo | Lugar |
|---|---|---|
| Row Level Security en Supabase (RB-031) | 23 `ENABLE RLS` + políticas §5 | `schema.sql` §8 |
| Separar roles administrador/cliente (RB-032) | claims `rol`, ramas `es_administrador()/es_cliente()`, 0 políticas `anon` | `schema.sql` §6/§8 |
| Validar formularios en frontend y backend (RB-033) | RLS/CHECK L2 + RPC L4; misma regla en zod L1 (-espejo `shared/domain/reglas.ts` — TASK-0006) | fuera de alcance de este documento |
| Sanitizar entradas (RB-034) | PostgREST parametrizado; aquí: guard de stock, nombres de Storage | `schema.sql` §7.3/§9 |
| Proteger rutas privadas (RB-035) | guards L1 + RLS server-side real (denegación por fila, no solo pantalla) | `schema.sql` §8 |
| No exponer credenciales en el frontend (RB-036) | `service_role` habilitado solo en EF; `anon key` + JWT en el bundle | §1, §2 |
| Login por correo + documento (RB-012, RF-075) | rama `es_cliente()` de `clientes` + trigger credenciales + EF `login-portal` | §5 clientes |

---

**Estado:** propuesta — aprobación pendiente de AG-004/AG-005. Nada aquí crea módulos ni cambia
nombres de SP; corrige los defectos D-01/D-03/E-09 del prototipo de BD y alimenta a TASK-0004
(ejecución de migraciones + suite pgTAP §7) y TASK-0006 (espejo de códigos en `zod` / UI).
