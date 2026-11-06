# Work Order Inline Equipment Creation — Sistema Taller

Fecha: 2026-11-06

## Implementación

- Selector de equipos del cliente en el alta de orden.
- Botón `+ Cargar equipo` abre modal integrado.
- Permite agregar marca desde el mismo modal.
- El equipo nuevo queda seleccionado automáticamente.
- Si cambia el cliente, se limpia la selección anterior.

## Verificación

- `npm test`: 19 archivos / 155 tests PASS.
- `npm run build`: OK.
- Despliegue local: `http://192.168.1.43`.
