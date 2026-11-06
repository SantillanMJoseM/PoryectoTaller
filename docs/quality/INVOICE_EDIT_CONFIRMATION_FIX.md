# Invoice Edit Confirmation Fix — Sistema Taller

Fecha: 2026-11-06

## Corrección

El modal de detalle de venta incorpora:

- Botón `Cancelar`.
- Botón `Confirmar cambios`.

Al confirmar, el listado se actualiza sin recargar la página.

Las ventas facturadas permanecen en modo solo lectura.

## Verificación

- `npm test`: 18 archivos / 154 tests PASS.
- `npm run build`: OK.
- Despliegue local: `http://192.168.1.43`.
