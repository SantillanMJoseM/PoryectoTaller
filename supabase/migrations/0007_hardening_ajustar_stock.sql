-- ============================================================================
-- Sistema Taller — Migración 0007: endurecimiento de ajustar_stock (H-1)
-- ============================================================================
-- Revoca la ejecución directa de ajustar_stock a roles no privilegiados.
-- La función sigue siendo SECURITY DEFINER y es invocada únicamente por las
-- RPC compuestas (orden_agregar_producto, venta_agregar_item, etc.), que ya
-- aplican sus propios controles de permiso. Así se cierra la vía de
-- modificación arbitraria de stock por JWT authenticated/cliente.
-- ============================================================================
revoke execute on function public.ajustar_stock(uuid, numeric) from public;
revoke execute on function public.ajustar_stock(uuid, numeric) from anon;
revoke execute on function public.ajustar_stock(uuid, numeric) from authenticated;
-- ============================================================================
-- Fin de 0007_hardening_ajustar_stock.sql
-- ============================================================================
