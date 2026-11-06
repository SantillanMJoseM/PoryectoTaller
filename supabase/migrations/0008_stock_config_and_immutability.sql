-- ============================================================================
-- Sistema Taller — Migración 0008: config de stock válida e inmutabilidad de
-- ventas facturadas
-- ============================================================================

-- 1. Corregir nombre de GUC (PostgreSQL exige prefijo con punto para variables
--    personalizadas): app.permite_stock_write
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

revoke execute on function public.ajustar_stock(uuid, numeric) from public;
revoke execute on function public.ajustar_stock(uuid, numeric) from anon;
revoke execute on function public.ajustar_stock(uuid, numeric) from authenticated;

-- 2. Bloquear modificaciones de líneas cuando la venta está facturada
create or replace function public.venta_agregar_item(
  p_venta uuid, p_producto uuid, p_cantidad numeric, p_precio numeric default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_descripcion text;
  v_precio numeric(12,2);
  v_facturado boolean;
begin
  select facturado into v_facturado from ventas where id_venta = p_venta;
  if v_facturado is true then
    raise exception 'La venta ya está facturada y no admite cambios en sus ítems.'
      using hint = 'venta_facturada_inmutable';
  end if;
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
  v_facturado boolean;
begin
  select * into r from items_venta where id_item_venta = p_item;
  if r.id_item_venta is null then
    raise exception 'Item de venta inexistente.';
  end if;
  select facturado into v_facturado from ventas where id_venta = r.venta_id;
  if v_facturado is true then
    raise exception 'La venta ya está facturada y no admite cambios en sus ítems.'
      using hint = 'venta_facturada_inmutable';
  end if;
  perform public.requerir_permiso('eVenta');
  if coalesce(p_cantidad, 0) <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;
  perform public.ajustar_stock(r.producto_id, r.cantidad - p_cantidad);
  update items_venta
     set cantidad = p_cantidad, subtotal = round(p_cantidad * precio, 2)
   where id_item_venta = p_item;
end $$;

create or replace function public.venta_quitar_item(p_item uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r items_venta%rowtype;
  v_facturado boolean;
begin
  select * into r from items_venta where id_item_venta = p_item;
  if r.id_item_venta is null then
    raise exception 'Item de venta inexistente.';
  end if;
  select facturado into v_facturado from ventas where id_venta = r.venta_id;
  if v_facturado is true then
    raise exception 'La venta ya está facturada y no admite cambios en sus ítems.'
      using hint = 'venta_facturada_inmutable';
  end if;
  perform public.requerir_permiso('eVenta');
  delete from items_venta where id_item_venta = p_item;
  perform public.ajustar_stock(r.producto_id, r.cantidad);
end $$;

-- 3. Bloquear edición de una venta ya facturada (salvo la propia transición)
create or replace function public.f_venta_facturada_inmutable() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.facturado and new is distinct from old then
    raise exception 'La venta ya está facturada y no puede modificarse.'
      using hint = 'venta_facturada_inmutable';
  end if;
  return new;
end $$;

drop trigger if exists tg_venta_facturada_inmutable on ventas;
create trigger tg_venta_facturada_inmutable
  before update on ventas
  for each row execute function public.f_venta_facturada_inmutable();

-- grants (reafirmar)
grant execute on function public.venta_agregar_item(uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.venta_cambiar_cantidad_item(uuid, numeric) to authenticated;
grant execute on function public.venta_quitar_item(uuid) to authenticated;
-- ============================================================================
-- Fin de 0008
-- ============================================================================
