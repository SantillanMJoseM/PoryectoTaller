-- ============================================================================
-- Sistema Taller — Migración 0003: RLS y helpers de sesión (TASK-0006 / AG-010)
-- ============================================================================
-- Sustituye las políticas permisivas del prototipo 0001 (defecto D-03:
-- política «anon read clientes») por el diseño completo de TASK-0005
-- (RLS_POLICIES.md): 23/23 tablas con RLS, ninguna política para anon,
-- plantilla admin: es_administrador() AND tiene_permiso('<código>'), y rama
-- de portal: es_cliente() AND propiedad (RB-032).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS activado en las 23 tablas del modelo (RB-031)
-- ---------------------------------------------------------------------------
alter table empresa                 enable row level security;
alter table permisos                enable row level security;
alter table usuarios                enable row level security;
alter table clientes                enable row level security;
alter table marcas                  enable row level security;
alter table equipos                 enable row level security;
alter table productos               enable row level security;
alter table servicios               enable row level security;
alter table garantias               enable row level security;
alter table categorias              enable row level security;
alter table cuentas                 enable row level security;
alter table ordenes_trabajo         enable row level security;
alter table productos_orden         enable row level security;
alter table servicios_orden         enable row level security;
alter table equipos_orden           enable row level security;
alter table anexos                  enable row level security;
alter table ventas                  enable row level security;
alter table items_venta             enable row level security;
alter table movimientos_financieros enable row level security;
alter table documentos              enable row level security;
alter table logs_auditoria          enable row level security;
alter table cola_emails             enable row level security;
alter table sesiones                enable row level security;

-- Drop defensivo de TODAS las políticas previas del esquema public
-- (incluye las permissivas de 0001_init.sql).
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname
             from pg_policies
            where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Helpers de sesión (SECURITY DEFINER; claims del JWT de Supabase Auth).
--    El backend (Edge Function) firma el token con app_metadata:
--    { rol, usuario_id | cliente_id, permisos }
-- ---------------------------------------------------------------------------
create or replace function public.jwt_app_metadata()
returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata',
    '{}'::jsonb);
$$;

create or replace function public.rol_sesion() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select nullif(public.jwt_app_metadata() ->> 'rol', '');
$$;

create or replace function public.usuario_actual() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select nullif(public.jwt_app_metadata() ->> 'usuario_id', '')::uuid;
$$;

create or replace function public.cliente_actual() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select nullif(public.jwt_app_metadata() ->> 'cliente_id', '')::uuid;
$$;

create or replace function public.es_administrador() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.rol_sesion() = 'administrador';
$$;

create or replace function public.es_cliente() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.rol_sesion() = 'cliente';
$$;

-- Permiso: claim primero (O(1)); fallback a la tabla usuarios/permisos.
create or replace function public.tiene_permiso(p_codigo text) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_usuario uuid := public.usuario_actual();
  v_claim   text := public.jwt_app_metadata() ->> 'permisos';
begin
  if v_usuario is null then
    return false;
  end if;
  if v_claim is not null then
    return v_claim::jsonb ? p_codigo;
  end if;
  return exists (
    select 1
      from usuarios u
      join permisos p on p.id_permiso = u.permiso_id
     where u.id_usuario = v_usuario
       and u.estado_usuario is true                                      -- RB-023
       and p.estado is true                                              -- RB-023
       and (u.fecha_expiracion is null or u.fecha_expiracion >= current_date)  -- RB-024
       and p.permisos ? p_codigo
  );
end $$;

-- Propiedad del portal (definer: evita recursión de RLS)
create or replace function public.es_cliente_duenio_orden(p_orden uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_orden is not null and exists (
    select 1 from ordenes_trabajo o
     where o.id_orden = p_orden and o.cliente_id = public.cliente_actual());
$$;

create or replace function public.es_cliente_duenio_venta(p_venta uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_venta is not null and exists (
    select 1 from ventas v
     where v.id_venta = p_venta and v.cliente_id = public.cliente_actual());
$$;

revoke all on function public.jwt_app_metadata() from public, anon;

-- ---------------------------------------------------------------------------
-- 3. Políticas por tabla
-- ---------------------------------------------------------------------------

-- --- clientes (portal: lee/edita SOLO su propia fila) ---
create policy clientes_sel on clientes for select to authenticated using (
  (es_administrador() and tiene_permiso('vCliente'))
  or (es_cliente() and id_cliente = cliente_actual())
);
create policy clientes_ins on clientes for insert to authenticated
  with check (es_administrador() and tiene_permiso('aCliente'));
create policy clientes_upd on clientes for update to authenticated
  using ((es_administrador() and tiene_permiso('eCliente'))
         or (es_cliente() and id_cliente = cliente_actual()))
  with check ((es_administrador() and tiene_permiso('eCliente'))
              or (es_cliente() and id_cliente = cliente_actual()));
create policy clientes_del on clientes for delete to authenticated
  using (es_administrador() and tiene_permiso('dCliente'));

-- --- productos / servicios: CRUD admin ---
create policy productos_sel on productos for select to authenticated
  using (es_administrador() and tiene_permiso('vProducto'));
create policy productos_ins on productos for insert to authenticated
  with check (es_administrador() and tiene_permiso('aProducto'));
create policy productos_upd on productos for update to authenticated
  using (es_administrador() and tiene_permiso('eProducto'))
  with check (es_administrador() and tiene_permiso('eProducto'));
create policy productos_del on productos for delete to authenticated
  using (es_administrador() and tiene_permiso('dProducto'));

create policy servicios_sel on servicios for select to authenticated
  using (es_administrador() and tiene_permiso('vServicio'));
create policy servicios_ins on servicios for insert to authenticated
  with check (es_administrador() and tiene_permiso('aServicio'));
create policy servicios_upd on servicios for update to authenticated
  using (es_administrador() and tiene_permiso('eServicio'))
  with check (es_administrador() and tiene_permiso('eServicio'));
create policy servicios_del on servicios for delete to authenticated
  using (es_administrador() and tiene_permiso('dServicio'));

-- --- marcas y equipos: sub-recursos Clientes/Órdenes (E-04) ---
create policy marcas_sel on marcas for select to authenticated
  using (es_administrador() and (tiene_permiso('vCliente') or tiene_permiso('vOrden')));
create policy marcas_ins on marcas for insert to authenticated
  with check (es_administrador() and tiene_permiso('aCliente'));
create policy marcas_upd on marcas for update to authenticated
  using (es_administrador() and tiene_permiso('eCliente'))
  with check (es_administrador() and tiene_permiso('eCliente'));
create policy marcas_del on marcas for delete to authenticated
  using (es_administrador() and tiene_permiso('dCliente'));

create policy equipos_sel on equipos for select to authenticated using (
  (es_administrador() and (tiene_permiso('vCliente') or tiene_permiso('vOrden')))
  or (es_cliente() and cliente_id = cliente_actual())
);
create policy equipos_ins on equipos for insert to authenticated
  with check (es_administrador() and tiene_permiso('aCliente'));
create policy equipos_upd on equipos for update to authenticated
  using (es_administrador() and tiene_permiso('eCliente'))
  with check (es_administrador() and tiene_permiso('eCliente'));
create policy equipos_del on equipos for delete to authenticated
  using (es_administrador() and tiene_permiso('dCliente'));

-- --- órdenes de trabajo (portal lee solo sus órdenes) ---
create policy ordenes_sel on ordenes_trabajo for select to authenticated using (
  (es_administrador() and tiene_permiso('vOrden'))
  or (es_cliente() and es_cliente_duenio_orden(id_orden))
);
create policy ordenes_ins on ordenes_trabajo for insert to authenticated
  with check (es_administrador() and tiene_permiso('aOrden'));
create policy ordenes_upd on ordenes_trabajo for update to authenticated
  using (es_administrador() and tiene_permiso('eOrden'))
  with check (es_administrador() and tiene_permiso('eOrden'));
create policy ordenes_del on ordenes_trabajo for delete to authenticated
  using (es_administrador() and tiene_permiso('dOrden'));

create policy prod_orden_sel on productos_orden for select to authenticated using (
  (es_administrador() and tiene_permiso('vOrden'))
  or (es_cliente() and es_cliente_duenio_orden(orden_id))
);
create policy prod_orden_ins on productos_orden for insert to authenticated
  with check (es_administrador() and tiene_permiso('aOrden'));
create policy prod_orden_upd on productos_orden for update to authenticated
  using (es_administrador() and tiene_permiso('eOrden'))
  with check (es_administrador() and tiene_permiso('eOrden'));
create policy prod_orden_del on productos_orden for delete to authenticated
  using (es_administrador() and tiene_permiso('dOrden'));

create policy serv_orden_sel on servicios_orden for select to authenticated using (
  (es_administrador() and tiene_permiso('vOrden'))
  or (es_cliente() and es_cliente_duenio_orden(orden_id))
);
create policy serv_orden_ins on servicios_orden for insert to authenticated
  with check (es_administrador() and tiene_permiso('aOrden'));
create policy serv_orden_upd on servicios_orden for update to authenticated
  using (es_administrador() and tiene_permiso('eOrden'))
  with check (es_administrador() and tiene_permiso('eOrden'));
create policy serv_orden_del on servicios_orden for delete to authenticated
  using (es_administrador() and tiene_permiso('dOrden'));

create policy eq_orden_sel on equipos_orden for select to authenticated using (
  (es_administrador() and tiene_permiso('vOrden'))
  or (es_cliente() and es_cliente_duenio_orden(orden_id))
);
create policy eq_orden_ins on equipos_orden for insert to authenticated
  with check (es_administrador() and tiene_permiso('aOrden'));
create policy eq_orden_upd on equipos_orden for update to authenticated
  using (es_administrador() and tiene_permiso('eOrden'))
  with check (es_administrador() and tiene_permiso('eOrden'));
create policy eq_orden_del on equipos_orden for delete to authenticated
  using (es_administrador() and tiene_permiso('dOrden'));

create policy anexos_sel on anexos for select to authenticated using (
  (es_administrador() and tiene_permiso('vOrden'))
  or (es_cliente() and es_cliente_duenio_orden(orden_id))
);
create policy anexos_ins on anexos for insert to authenticated
  with check (es_administrador() and tiene_permiso('aOrden'));
create policy anexos_upd on anexos for update to authenticated
  using (es_administrador() and tiene_permiso('eOrden'))
  with check (es_administrador() and tiene_permiso('eOrden'));
create policy anexos_del on anexos for delete to authenticated
  using (es_administrador() and tiene_permiso('dOrden'));

-- --- garantías (portal ve la garantía de su orden — impresión E-07) ---
create policy garantias_sel on garantias for select to authenticated using (
  (es_administrador() and tiene_permiso('vGarantia'))
  or (es_cliente() and exists (
        select 1 from ordenes_trabajo o
         where o.garantia_id = garantias.id_garantia
           and o.cliente_id = cliente_actual()))
);
create policy garantias_ins on garantias for insert to authenticated
  with check (es_administrador() and tiene_permiso('aGarantia'));
create policy garantias_upd on garantias for update to authenticated
  using (es_administrador() and tiene_permiso('eGarantia'))
  with check (es_administrador() and tiene_permiso('eGarantia'));
create policy garantias_del on garantias for delete to authenticated
  using (es_administrador() and tiene_permiso('dGarantia'));

-- --- ventas e items (portal lee solo sus compras) ---
create policy ventas_sel on ventas for select to authenticated using (
  (es_administrador() and tiene_permiso('vVenta'))
  or (es_cliente() and es_cliente_duenio_venta(id_venta))
);
create policy ventas_ins on ventas for insert to authenticated
  with check (es_administrador() and tiene_permiso('aVenta'));
create policy ventas_upd on ventas for update to authenticated
  using (es_administrador() and tiene_permiso('eVenta'))
  with check (es_administrador() and tiene_permiso('eVenta'));
create policy ventas_del on ventas for delete to authenticated
  using (es_administrador() and tiene_permiso('dVenta'));

create policy items_venta_sel on items_venta for select to authenticated using (
  (es_administrador() and tiene_permiso('vVenta'))
  or (es_cliente() and es_cliente_duenio_venta(venta_id))
);
create policy items_venta_ins on items_venta for insert to authenticated
  with check (es_administrador() and tiene_permiso('aVenta'));
create policy items_venta_upd on items_venta for update to authenticated
  using (es_administrador() and tiene_permiso('eVenta'))
  with check (es_administrador() and tiene_permiso('eVenta'));
create policy items_venta_del on items_venta for delete to authenticated
  using (es_administrador() and tiene_permiso('dVenta'));

-- --- financiero (solo admin; el portal no ve movimientos) ---
create policy mov_sel on movimientos_financieros for select to authenticated
  using (es_administrador() and tiene_permiso('vMovimiento'));
create policy mov_ins on movimientos_financieros for insert to authenticated
  with check (es_administrador() and tiene_permiso('aMovimiento'));
create policy mov_upd on movimientos_financieros for update to authenticated
  using (es_administrador() and tiene_permiso('eMovimiento'))
  with check (es_administrador() and tiene_permiso('eMovimiento'));
create policy mov_del on movimientos_financieros for delete to authenticated
  using (es_administrador() and tiene_permiso('dMovimiento'));

create policy cat_sel on categorias for select to authenticated
  using (es_administrador() and tiene_permiso('vMovimiento'));
create policy cat_ins on categorias for insert to authenticated
  with check (es_administrador() and tiene_permiso('aMovimiento'));
create policy cat_upd on categorias for update to authenticated
  using (es_administrador() and tiene_permiso('eMovimiento'))
  with check (es_administrador() and tiene_permiso('eMovimiento'));
create policy cat_del on categorias for delete to authenticated
  using (es_administrador() and tiene_permiso('dMovimiento'));

create policy cta_sel on cuentas for select to authenticated
  using (es_administrador() and tiene_permiso('vMovimiento'));
create policy cta_ins on cuentas for insert to authenticated
  with check (es_administrador() and tiene_permiso('aMovimiento'));
create policy cta_upd on cuentas for update to authenticated
  using (es_administrador() and tiene_permiso('eMovimiento'))
  with check (es_administrador() and tiene_permiso('eMovimiento'));
create policy cta_del on cuentas for delete to authenticated
  using (es_administrador() and tiene_permiso('dMovimiento'));

-- --- documentos ---
create policy doc_sel on documentos for select to authenticated
  using (es_administrador() and tiene_permiso('vArchivo'));
create policy doc_ins on documentos for insert to authenticated
  with check (es_administrador() and tiene_permiso('aArchivo'));
create policy doc_upd on documentos for update to authenticated
  using (es_administrador() and tiene_permiso('eArchivo'))
  with check (es_administrador() and tiene_permiso('eArchivo'));
create policy doc_del on documentos for delete to authenticated
  using (es_administrador() and tiene_permiso('dArchivo'));

-- --- usuarios / permisos (solo admin) ---
create policy usr_sel on usuarios for select to authenticated
  using (es_administrador() and tiene_permiso('vUsuario'));
create policy usr_ins on usuarios for insert to authenticated
  with check (es_administrador() and tiene_permiso('aUsuario'));
create policy usr_upd on usuarios for update to authenticated
  using (es_administrador() and tiene_permiso('eUsuario'))
  with check (es_administrador() and tiene_permiso('eUsuario'));
create policy usr_del on usuarios for delete to authenticated
  using (es_administrador() and tiene_permiso('dUsuario'));

create policy per_sel on permisos for select to authenticated
  using (es_administrador() and tiene_permiso('vPermiso'));
create policy per_ins on permisos for insert to authenticated
  with check (es_administrador() and tiene_permiso('aPermiso'));
create policy per_upd on permisos for update to authenticated
  using (es_administrador() and tiene_permiso('ePermiso'))
  with check (es_administrador() and tiene_permiso('ePermiso'));
create policy per_del on permisos for delete to authenticated
  using (es_administrador() and tiene_permiso('dPermiso'));

-- --- logs_auditoria: lectura/borrado con código; escritura SOLO definer ---
create policy logs_sel on logs_auditoria for select to authenticated
  using (es_administrador() and tiene_permiso('vAuditoria'));
create policy logs_del on logs_auditoria for delete to authenticated
  using (es_administrador() and tiene_permiso('dAuditoria'));

-- --- cola_emails: lectura/eliminación con código; escritura por servicio ---
create policy email_sel on cola_emails for select to authenticated
  using (es_administrador() and tiene_permiso('vEmail'));
create policy email_del on cola_emails for delete to authenticated
  using (es_administrador() and tiene_permiso('dEmail'));

-- --- empresa: lectura para PDFs (admin + portal); escritura c/e Empresa ---
create policy emp_sel on empresa for select to authenticated
  using (es_administrador() or es_cliente());
create policy emp_ins on empresa for insert to authenticated
  with check (es_administrador() and tiene_permiso('cEmpresa'));
create policy emp_upd on empresa for update to authenticated
  using (es_administrador() and (tiene_permiso('eEmpresa') or tiene_permiso('cEmpresa')))
  with check (es_administrador() and (tiene_permiso('eEmpresa') or tiene_permiso('cEmpresa')));

-- --- sesiones: propia + admin (escritura solo definer/Edge Function) ---
create policy ses_sel on sesiones for select to authenticated using (
  (es_administrador() and (tiene_permiso('vUsuario') or usuario_id = usuario_actual()))
  or (es_cliente() and cliente_id = cliente_actual())
);

-- ============================================================================
-- Fin de 0003_rls.sql
-- ============================================================================
