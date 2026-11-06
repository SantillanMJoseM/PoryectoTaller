# Sales Initialization Regression — Sistema Taller

Fecha: 2026-11-06

## Causa raíz

En `src/pages/Ventas.tsx`, un `useEffect` referenciaba `busquedaNuevo` y `setResultadosNuevo` antes de declarar esos estados, provocando `Cannot access 'se' before initialization`.

## Corrección

Se movió el efecto de autocompletado después de la declaración de los estados de nueva factura.

## Verificación

- `npm test`: 19 archivos / 155 tests PASS.
- `npm run build`: OK.
- Despliegue local: `http://192.168.1.43`.
