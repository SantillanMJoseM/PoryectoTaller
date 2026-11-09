# Invoice Workflow Report

Flujo implementado:

1. Nueva factura: crear venta con cliente_id y usuario_id (estado Sin facturar / facturado=false).
2. Carga de detalle: agregar/quitar/modificar ítems vía venta_agregar_item, venta_cambiar_cantidad_item, venta_quitar_item (validación stock en backend).
3. Cálculo de totales en backend (recalcVenta).
4. Descuentos aplicados en venta.
5. Confirmación: venta_facturar (transacción atómica: movimiento financiero + marcado facturado + lanzamiento_id).
6. Protección: guardUpdate/guardDelete en /api/ventas e /api/items-venta rechazan cambios si facturado=true.
7. Doble facturación prevenida: endpoint verifica facturado antes de procesar.

Inmutabilidad: backend rechaza PUT/DELETE sobre ventas/items facturados. Frontend deshabilita botones.
