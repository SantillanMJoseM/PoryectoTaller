# Equipment & Client Security — Sistema Taller

Fecha: 2026-11-06

## Controles

- Equipos protegidos por RLS existente para `equipos` y `equipos_orden`.
- Permisos basados en códigos de actividad.
- Validación de pertenencia del equipo al cliente en la UI.
- No se eliminan equipos con historial.

## Verificación

- `npm test`: 19 archivos / 155 tests PASS.
- `npm run build`: OK.
- Despliegue local: `http://192.168.1.43`.
