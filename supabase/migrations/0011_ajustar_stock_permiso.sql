-- ============================================================================
-- Sistema Taller — Migración 0011: restaurar ejecución de ajustar_stock con permiso
-- ============================================================================
create or replace function public.ajustar_stock(p_producto uuid, p_delta numeric)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_stock numeric(12,2);
begin
  perform public.requerir_permiso('eProducto');
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

grant execute on function public.ajustar_stock(uuid, numeric) to authenticated;
-- ============================================================================
-- Fin de 0011
-- ============================================================================
