# Work Order Equipment Integration — Sistema Taller

Fecha: 2026-11-06

## Implementación

- Selector de equipos del cliente en el alta de orden.
- Botón `+ Cargar nuevo equipo` con modal integrado.
- El nuevo equipo queda automáticamente seleccionado.
- La orden se asocia al cliente y al equipo seleccionado.
- Si cambia el cliente, se actualizan los equipos disponibles.

## Verificación

- `npm test`: 19 archivos / 155 tests PASS.
- `npm run build`: OK.
- Despliegue local: `http://192.168.1.43`.
