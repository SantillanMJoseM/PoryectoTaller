# Invoiced Sales Immutability — Sistema Taller

Fecha: 2026-11-06

## Regla

Una venta facturada es inmutable respecto de productos, cantidades, precios, descuentos e importes.

## Correcciones

- `src/pages/Ventas.tsx`: el detalle usa `editable = puedeEditar && !venta.facturado`; oculta buscador/agregar/quitar y deshabilita edición de cantidades.
- `src/services/ventas.ts`: `editar`, `agregarItem`, `cambiarCantidadItem`, `quitarItem`, `eliminar` rechazan operaciones si la venta está facturada.
- `supabase/migrations/0008_stock_config_and_immutability.sql`: RPCs de ítems verifican `facturado`; trigger `tg_venta_facturada_inmutable` bloquea cambios en BD.

## Pruebas

- `npm test`: 18 archivos / 154 tests PASS.
- `npm run build`: OK.
- Despliegue local verificado.
