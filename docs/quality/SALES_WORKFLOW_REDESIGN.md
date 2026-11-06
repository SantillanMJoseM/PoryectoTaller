# Sales Workflow Redesign — Sistema Taller

Fecha: 2026-11-06

## Estado

El flujo existente ya separa creación, detalle y facturación:

1. Nueva venta: cliente, vendedor, fecha y descuento.
2. Detalle: productos, cantidades, subtotales y total.
3. Facturación explícita mediante acción separada.

## Correcciones aplicadas

- Inmutabilidad de ventas facturadas en frontend, servicios y base de datos.
- Edición permitida solo mientras la venta está sin facturar.
- `venta_facturar` sigue siendo la única vía para pasar a FACTURADA.

## Verificación

- `npm test`: 18 archivos / 154 tests PASS.
- `npm run build`: OK.
- Despliegue local: `http://192.168.1.43`.
