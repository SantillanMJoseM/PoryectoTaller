# Stock Configuration Fix — Sistema Taller

Fecha: 2026-11-06

## Causa raíz

PostgreSQL no reconoce variables de configuración personalizadas sin prefijo con punto. El código usaba `app_permite_stock_write`, lo que producía `unrecognized configuration parameter`.

## Corrección

- Se renombró la variable a `app.permite_stock_write` en:
  - `supabase/migrations/0004_negocio.sql`
  - `supabase/migrations/0008_stock_config_and_immutability.sql`
- Se verificó con `ajustar_stock` en transacción (stock cambió de 5.00 a 4.00 y se revirtió).
- Se verificó `venta_agregar_item` con JWT administrador.

## Resultado

No se producen errores de configuración y el control de stock sigue protegido.
