# Urgent Orders Render Regression — Sistema Taller

Fecha: 2026-11-06

## Causa raíz

`/ordenes` quedaba en blanco por una zona temporal muerta (TDZ): un `useEffect` referenciaba `form.cliente_id` antes de declarar el estado `form`.

## Corrección

- Se movió el efecto al punto posterior a la declaración de `form`.
- Se corrigió el botón `+ Agregar marca` para ubicarse junto al selector.
- Se verificó `npm test`, `npm run build` y el despliegue local.

## Verificación HTTP

- `http://192.168.1.43/ordenes` sirve el bundle actualizado.
- `npm test`: 19 archivos / 155 tests PASS.
- `npm run build`: OK.
