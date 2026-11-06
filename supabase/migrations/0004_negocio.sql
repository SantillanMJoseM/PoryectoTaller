-- ============================================================================
-- Sistema Taller — Migración 0004: triggers de modelo y RPC de negocio
-- (TASK-0006 / AG-010)
-- ============================================================================
-- Materializa DATA_MODEL §7 (triggers 7.1–7.6) y las RPC compuestas que
-- aplican las REGLAS DE NEGOCIO de SOURCE_PROMPT.md:
--   RB-002/017/020  stock se actualiza al agregar/quitar productos en
--                   órdenes y ventas (allá y viceversa), nunca a mano.
--   RB-003/004/027  facturación única de orden/venta → movimiento financiero.
--   RB-009/028      auditoría automática de acciones relevantes.
--   RF-021          fecha_final al Finalizar.
--   RF-069          limpiar logs con auto-log previo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 7.1 Empresa única (RB-030)
-- ---------------------------------------------------------------------------
create or replace function public.f_empresa_unica() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from empresa where id <> new.id) then
    raise exception 'La empresa ya está registrada: edite los datos existentes (solo un registro).'
      using hint = 'empresa_unica';
  end if;
  return new;
end $$;

drop trigger if exists tg_empresa_unica on empresa;
create trigger tg_empresa_unica
  before insert or update on empresa
  for each row execute function public.f_empresa_unica();

-- ---------------------------------------------------------------------------
-- 7.2 Portal del cliente no cambia sus credenciales (E-05 / RF-079)
-- ---------------------------------------------------------------------------
create or replace function public.f_cliente_no_credenciales() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.es_cliente()
     and (new.correo is distinct from old.correo
          or new.documento is distinct from old.documento) then
    raise exception 'Para cambiar su correo o documento, contacte al taller.'
      using hint = 'credenciales_inmutables';
  end if;
  return new;
end $$;

drop trigger if exists tg_cliente_no_credenciales on clientes;
create trigger tg_cliente_no_credenciales
  before update on clientes
  for each row execute function public.f_cliente_no_credenciales();

-- ---------------------------------------------------------------------------
-- 7.3 Guard de stock: solo las RPC de líneas/ajuste tocan productos.stock
-- ---------------------------------------------------------------------------
create or replace function public.f_stock_no_directo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app.permite_stock_write', true), 'off') <> 'on' then
    raise exception 'El stock solo se actualiza mediante órdenes/ventas o ajuste de inventario.'
      using hint = 'stock_guard';
  end if;
  return new;
end $$;

drop trigger if exists tg_stock_no_directo on productos;
create trigger tg_stock_no_directo
  before update on productos
  for each row execute function public.f_stock_no_directo();

-- ---------------------------------------------------------------------------
-- 7.4 Recálculo de totales (RB-018/019)
-- ---------------------------------------------------------------------------
create or replace function public.f_recalcular_total_orden() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_orden uuid := coalesce(new.orden_id, old.orden_id);
begin
  update ordenes_trabajo o
     set valor_total = (
           (select coalesce(sum(subtotal), 0) from productos_orden p where p.orden_id = o.id_orden)
         + (select coalesce(sum(subtotal), 0) from servicios_orden s where s.orden_id = o.id_orden)
         )
   where o.id_orden = v_orden;
  return null;
end $$;

drop trigger if exists tg_recalcular_total_orden on productos_orden;
create trigger tg_recalcular_total_orden
  after insert or update or delete on productos_orden
  for each row execute function public.f_recalcular_total_orden();

drop trigger if exists tg_recalcular_total_orden on servicios_orden;
create trigger tg_recalcular_total_orden
  after insert or update or delete on servicios_orden
  for each row execute function public.f_recalcular_total_orden();

create or replace function public.f_recalcular_total_venta() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_venta uuid := coalesce(new.venta_id, old.venta_id);
begin
  update ventas v
     set valor_total = (
           (select coalesce(sum(subtotal), 0) from items_venta i where i.venta_id = v.id_venta)
         - v.descuento
         )
   where v.id_venta = v_venta;
  return null;
end $$;

drop trigger if exists tg_recalcular_total_compra on items_venta;
create trigger tg_recalcular_total_compra
  after insert or update or delete on items_venta
  for each row execute function public.f_recalcular_total_venta();

create or replace function public.f_recalcular_total_venta_upd() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.valor_total := (
    (select coalesce(sum(subtotal), 0) from items_venta i where i.venta_id = new.id_venta)
    - new.descuento
  );
  return new;
end $$;

drop trigger if exists tg_recalcular_total_descuento on ventas;
create trigger tg_recalcular_total_descuento
  before update of descuento on ventas
  for each row execute function public.f_recalcular_total_venta_upd();

-- ---------------------------------------------------------------------------
-- 7.5 Fecha final al Finalizar (RF-021)
-- ---------------------------------------------------------------------------
create or replace function public.f_orden_fecha_final() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.estado = 'Finalizado' and new.fecha_final is null then
    new.fecha_final := current_date;
  end if;
  return new;
end $$;

drop trigger if exists tg_orden_fecha_final on ordenes_trabajo;
create trigger tg_orden_fecha_final
  before update of estado on ordenes_trabajo
  for each row execute function public.f_orden_fecha_final();

-- ---------------------------------------------------------------------------
-- 7.6 Auditoría genérica (RB-009/028) — escritura solo por definer
-- ---------------------------------------------------------------------------
create or replace function public.f_auditar() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_op   text := case tg_op when 'INSERT' then 'agregar'
                            when 'UPDATE' then 'editar'
                            else 'eliminar' end;
  v_ip   text;
  v_user text;
begin
  v_ip := coalesce(nullif(current_setting('request.headers', true), '')::jsonb
           ->> 'x-forwarded-for', null);
  select coalesce(u.nombre, 'system') into v_user
    from usuarios u
   where u.id_usuario = public.usuario_actual();
  insert into logs_auditoria (usuario, tarea, ip)
  values (coalesce(v_user, 'system'), v_op || ' ' || tg_table_name, v_ip);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['clientes','productos','servicios','garantias',
                           'movimientos_financieros','documentos','usuarios',
                           'permisos','empresa','ventas','ordenes_trabajo',
                           'categorias','cuentas','marcas','equipos']
  loop
    execute format('drop trigger if exists tg_auditar on %I', t);
    execute format(
      'create trigger tg_auditar after insert or update or delete on %I
         for each row execute function public.f_auditar()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers y RPC de negocio (executables por authenticated; SECURITY DEFINER)
-- ---------------------------------------------------------------------------

create or replace function public.requerir_permiso(p_codigo text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.tiene_permiso(p_codigo) then
    raise exception 'No tiene permiso para esta operación (%).', p_codigo
      using hint = 'permiso_denegado';
  end if;
end $$;

-- Ajuste de stock (única vía autorizada: GUC transaccional abierto aquí)
create or replace function public.ajustar_stock(p_producto uuid, p_delta numeric)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_stock numeric(12,2);
begin
  select stock into v_stock from productos where id_producto = p_producto
     for update;
  if v_stock is null then
    raise exception 'Producto inexistente.' using hint = 'producto_inexistente';
  end if;
  if v_stock + p_delta < 0 then
    raise exception 'Stock insuficiente para el producto seleccionado.'
      using hint = 'stock_insuficiente';
  end if;
  perform set_config('app.permite_stock_write', 'on', true);
  update productos set stock = stock + p_delta where id_producto = p_producto;
  perform set_config('app.permite_stock_write', 'off', true);
end $$;

-- ================= Órdenes de trabajo: líneas y stock (RB-002/017) ==========

create or replace function public.orden_agregar_producto(
  p_orden uuid, p_producto uuid, p_cantidad numeric, p_precio numeric default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_descripcion text;
  v_precio numeric(12,2);
begin
  perform public.requerir_permiso('aOrden');
  if coalesce(p_cantidad, 0) <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;
  select descripcion, coalesce(p_precio, precio_venta) into v_descripcion, v_precio
    from productos where id_producto = p_producto;
  if v_descripcion is null then
    raise exception 'Producto inexistente.' using hint = 'producto_inexistente';
  end if;
  if not exists (select 1 from productos where id_producto = p_producto and salida) then
    raise exception 'El producto no está habilitado como salida (venta/orden).';
  end if;
  perform public.ajustar_stock(p_producto, -p_cantidad);
  insert into productos_orden (orden_id, producto_id, cantidad, descripcion, precio, subtotal)
  values (p_orden, p_producto, p_cantidad, v_descripcion,
          round(v_precio, 2), round(p_cantidad * v_precio, 2))
  returning id_producto_orden into v_id;
  return v_id;
end $$;

create or replace function public.orden_cambiar_cantidad_producto(
  p_linea uuid, p_cantidad numeric
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r productos_orden%rowtype;
  v_delta numeric(12,2);
begin
  perform public.requerir_permiso('eOrden');
  if coalesce(p_cantidad, 0) <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;
  select * into r from productos_orden where id_producto_orden = p_linea;
  if r.id_producto_orden is null then
    raise exception 'Línea de producto inexistente.';
  end if;
  v_delta := r.cantidad - p_cantidad;   -- aumentar línea = devolver stock
  perform public.ajustar_stock(r.producto_id, v_delta);
  update productos_orden
     set cantidad = p_cantidad, subtotal = round(p_cantidad * precio, 2)
   where id_producto_orden = p_linea;
end $$;

create or replace function public.orden_quitar_producto(p_linea uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r productos_orden%rowtype;
begin
  perform public.requerir_permiso('eOrden');
  select * into r from productos_orden where id_producto_orden = p_linea;
  if r.id_producto_orden is null then
    raise exception 'Línea de producto inexistente.';
  end if;
  delete from productos_orden where id_producto_orden = p_linea;
  perform public.ajustar_stock(r.producto_id, r.cantidad);  -- devuelve stock
end $$;

-- ================= Ventas: items y stock (RB-002/017) =======================

create or replace function public.venta_agregar_item(
  p_venta uuid, p_producto uuid, p_cantidad numeric, p_precio numeric default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_descripcion text;
  v_precio numeric(12,2);
begin
  perform public.requerir_permiso('aVenta');
  if coalesce(p_cantidad, 0) <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;
  select descripcion, coalesce(p_precio, precio_venta) into v_descripcion, v_precio
    from productos where id_producto = p_producto;
  if v_descripcion is null then
    raise exception 'Producto inexistente.' using hint = 'producto_inexistente';
  end if;
  if not exists (select 1 from productos where id_producto = p_producto and salida) then
    raise exception 'El producto no está habilitado como salida (venta/orden).';
  end if;
  perform public.ajustar_stock(p_producto, -p_cantidad);
  insert into items_venta (venta_id, producto_id, cantidad, descripcion, precio, subtotal)
  values (p_venta, p_producto, p_cantidad, v_descripcion,
          round(v_precio, 2), round(p_cantidad * v_precio, 2))
  returning id_item_venta into v_id;
  return v_id;
end $$;

create or replace function public.venta_cambiar_cantidad_item(
  p_item uuid, p_cantidad numeric
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r items_venta%rowtype;
begin
  perform public.requerir_permiso('eVenta');
  if coalesce(p_cantidad, 0) <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;
  select * into r from items_venta where id_item_venta = p_item;
  if r.id_item_venta is null then
    raise exception 'Item de venta inexistente.';
  end if;
  perform public.ajustar_stock(r.producto_id, r.cantidad - p_cantidad);
  update items_venta
     set cantidad = p_cantidad, subtotal = round(p_cantidad * precio, 2)
   where id_item_venta = p_item;
end $$;

create or replace function public.venta_quitar_item(p_item uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r items_venta%rowtype;
begin
  perform public.requerir_permiso('eVenta');
  select * into r from items_venta where id_item_venta = p_item;
  if r.id_item_venta is null then
    raise exception 'Item de venta inexistente.';
  end if;
  delete from items_venta where id_item_venta = p_item;
  perform public.ajustar_stock(r.producto_id, r.cantidad);  -- devuelve stock
end $$;

-- ================= Facturación única (RB-003/004/027) =======================

create or replace function public.orden_facturar(
  p_orden uuid,
  p_fecha_vencimiento date default null,
  p_forma_pago text default null,
  p_categoria_id uuid default null,
  p_cuenta_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_total numeric(12,2);
  v_cliente uuid;
  v_mov uuid;
begin
  perform public.requerir_permiso('aMovimiento');
  select valor_total, cliente_id into v_total, v_cliente
    from ordenes_trabajo where id_orden = p_orden;
  if not found then
    raise exception 'Orden inexistente.';
  end if;
  if v_total <= 0 then
    raise exception 'No se puede facturar una orden sin valor total.';
  end if;
  insert into movimientos_financieros
    (descripcion, valor, fecha_vencimiento, pagado, cliente_proveedor, forma_pago,
     tipo, cliente_id, categoria_id, cuenta_id)
  values ('Facturación de orden', v_total, coalesce(p_fecha_vencimiento, current_date),
          false, null, p_forma_pago, 'ingreso', v_cliente, p_categoria_id, p_cuenta_id)
  returning id_movimiento into v_mov;
  update ordenes_trabajo
     set facturado = true, lanzamiento_id = v_mov
   where id_orden = p_orden;
  return v_mov;
end $$;

create or replace function public.venta_facturar(
  p_venta uuid,
  p_fecha_vencimiento date default null,
  p_forma_pago text default null,
  p_categoria_id uuid default null,
  p_cuenta_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_total numeric(12,2);
  v_cliente uuid;
  v_mov uuid;
begin
  perform public.requerir_permiso('aMovimiento');
  select valor_total, cliente_id into v_total, v_cliente
    from ventas where id_venta = p_venta;
  if not found then
    raise exception 'Venta inexistente.';
  end if;
  if v_total <= 0 then
    raise exception 'No se puede facturar una venta sin valor total.';
  end if;
  insert into movimientos_financieros
    (descripcion, valor, fecha_vencimiento, pagado, cliente_proveedor, forma_pago,
     tipo, cliente_id, categoria_id, cuenta_id)
  values ('Facturación de venta', v_total, coalesce(p_fecha_vencimiento, current_date),
          false, null, p_forma_pago, 'ingreso', v_cliente, p_categoria_id, p_cuenta_id)
  returning id_movimiento into v_mov;
  update ventas
     set facturado = true, lanzamiento_id = v_mov
   where id_venta = p_venta;
  return v_mov;
end $$;

-- ================= Financiero: marcar pago (RB-014) =========================

create or replace function public.mov_marcar_pagado(
  p_movimiento uuid, p_fecha_pago date default current_date
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.requerir_permiso('eMovimiento');
  update movimientos_financieros
     set pagado = true, fecha_pago = coalesce(p_fecha_pago, current_date)
   where id_movimiento = p_movimiento;
  if not found then
    raise exception 'Movimiento inexistente.';
  end if;
end $$;

-- ================= Auditoría: limpiar logs (RF-069) =========================

create or replace function public.limpiar_logs() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_borrados integer;
begin
  perform public.requerir_permiso('dAuditoria');
  -- auto-log previo: la limpieza se audita antes de borrar
  insert into logs_auditoria (usuario, tarea)
  values (coalesce((select nombre from usuarios
                     where id_usuario = public.usuario_actual()), 'system'),
          'limpiar logs_auditoria');
  select count(*) into v_borrados from logs_auditoria where tarea <> 'limpiar logs_auditoria';
  delete from logs_auditoria where tarea <> 'limpiar logs_auditoria';
  return v_borrados;
end $$;

-- ================= Sesiones (RNF-S-08; RB-032) ==============================

create or replace function public.sesion_registrar(
  p_tipo text, p_sujeto uuid, p_duracion_horas integer default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_horas integer;
  v_ip text;
begin
  if p_tipo not in ('administrador','cliente') then
    raise exception 'Tipo de sesión inválido.';
  end if;
  if p_tipo = 'administrador' then
    v_horas := coalesce(p_duracion_horas, 12);
  else
    v_horas := coalesce(p_duracion_horas, 24);
  end if;
  v_ip := coalesce(nullif(current_setting('request.headers', true), '')::jsonb
           ->> 'x-forwarded-for', null);
  insert into sesiones (usuario_id, cliente_id, tipo, expiracion, ip)
  values (case when p_tipo = 'administrador' then p_sujeto else null end,
          case when p_tipo = 'cliente' then p_sujeto else null end,
          p_tipo, now() + make_interval(hours => v_horas), v_ip)
  returning id_sesion into v_id;
  return v_id;
end $$;

create or replace function public.sesion_cerrar(p_sesion uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update sesiones set activa = false where id_sesion = p_sesion;
end $$;

create or replace function public.sesion_purgar() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n integer;
begin
  delete from sesiones
   where expiracion < now() or activa = false;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Permisos de ejecución (supabase no otorga anon por defecto, se explicita)
grant execute on function public.requerir_permiso(text)                  to authenticated;
grant execute on function public.ajustar_stock(uuid, numeric)            to authenticated;
grant execute on function public.orden_agregar_producto(uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.orden_cambiar_cantidad_producto(uuid, numeric) to authenticated;
grant execute on function public.orden_quitar_producto(uuid)             to authenticated;
grant execute on function public.venta_agregar_item(uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.venta_cambiar_cantidad_item(uuid, numeric) to authenticated;
grant execute on function public.venta_quitar_item(uuid)                 to authenticated;
grant execute on function public.orden_facturar(uuid, date, text, uuid, uuid) to authenticated;
grant execute on function public.venta_facturar(uuid, date, text, uuid, uuid) to authenticated;
grant execute on function public.mov_marcar_pagado(uuid, date)           to authenticated;
grant execute on function public.limpiar_logs()                          to authenticated;
grant execute on function public.sesion_registrar(text, uuid, integer)   to authenticated;
grant execute on function public.sesion_cerrar(uuid)                     to authenticated;
grant execute on function public.sesion_purgar()                         to authenticated;

-- ============================================================================
-- Fin de 0004_negocio.sql
-- ============================================================================
