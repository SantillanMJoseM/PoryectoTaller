# Client 360 Panel — Sistema Taller

Fecha: 2026-11-06

## Implementación

Se amplió el detalle de cliente en `src/pages/Clientes.tsx` con pestañas:

- Resumen
- Equipos
- Órdenes
- Facturas
- Movimientos

Los datos se obtienen desde Supabase respetando RLS y permisos.

## Verificación

- `npm test`: 19 archivos / 155 tests PASS.
- `npm run build`: OK.
- Despliegue local: `http://192.168.1.43`.
