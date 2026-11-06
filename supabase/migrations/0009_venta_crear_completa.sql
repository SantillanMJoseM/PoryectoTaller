-- ============================================================================
-- Sistema Taller — Migración 0009: creación atómica de venta completa
-- ============================================================================
create or replace function public.venta_crear_completa(
  p_cliente uuid,
  p_usuario uuid,
  p_fecha date,
  p_descuento numeric,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  item jsonb;
  v_producto uuid;
  v_cantidad numeric;
  v_precio numeric;
  v_descripcion text;
begin
  perform public.requerir_permiso('aVenta');
  insert into ventas (cliente_id, usuario_id, fecha_venta, descuento)
  values (p_cliente, p_usuario, coalesce(p_fecha, current_date), coalesce(p_descuento, 0))
  returning id_venta into v_id;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_producto := (item->>'id_producto')::uuid;
    v_cantidad := coalesce((item->>'cantidad')::numeric, 0);
    if v_cantidad <= 0 then
      raise exception 'La cantidad debe ser mayor que cero.';
    end if;
    select descripcion into v_descripcion
      from productos where id_producto = v_producto;
    if v_descripcion is null then
      raise exception 'Producto inexistente.' using hint = 'producto_inexistente';
    end if;
    if not exists (select 1 from productos where id_producto = v_producto and salida) then
      raise exception 'El producto no está habilitado como salida (venta/orden).';
    end if;
    v_precio := coalesce((item->>'precio')::numeric, (select precio_venta from productos where id_producto = v_producto));
    perform public.ajustar_stock(v_producto, -v_cantidad);
    insert into items_venta (venta_id, producto_id, cantidad, descripcion, precio, subtotal)
    values (v_id, v_producto, v_cantidad, v_descripcion,
            round(v_precio, 2), round(v_cantidad * v_precio, 2));
  end loop;

  return v_id;
end $$;

grant execute on function public.venta_crear_completa(uuid, uuid, date, numeric, jsonb) to authenticated;
-- ============================================================================
-- Fin de 0009
-- ============================================================================
