# Invoice Creation Workflow Fix — Sistema Taller

Fecha: 2026-11-06

## Flujo corregido

1. Nueva factura: seleccionar cliente y responsable.
2. Cargar artículos con autocompletado, cantidades y subtotales.
3. Revisar resumen.
4. Confirmar factura: se crea la venta y sus ítems de forma atómica (`venta_crear_completa`).
5. La venta se guarda como SIN FACTURAR.

## Archivos

- `src/pages/Ventas.tsx`
- `src/services/ventas.ts`
- `supabase/migrations/0009_venta_crear_completa.sql`

## Verificación

- `npm test`: 18 archivos / 154 tests PASS.
- `npm run build`: OK.
- Despliegue local: `http://192.168.1.43`.
