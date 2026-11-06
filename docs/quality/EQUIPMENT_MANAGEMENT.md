# Equipment Management — Sistema Taller

Fecha: 2026-11-06

## Implementación

- Nueva página `src/pages/Equipos.tsx` registrada en `App.tsx` y menú lateral.
- CRUD de equipos asociados a clientes.
- Campos: cliente, equipo, marca, modelo, color, condición, serie, chasis, motor, descripción.
- Historial de órdenes por equipo.
- Migración `0010_equipos_ampliacion.sql`.

## Verificación

- `npm test`: 19 archivos / 155 tests PASS.
- `npm run build`: OK.
- Despliegue local: `http://192.168.1.43`.
