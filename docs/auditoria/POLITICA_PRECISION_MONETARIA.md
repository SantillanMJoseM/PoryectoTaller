# Política de precisión y redondeo — Sistema Taller

## Almacenamiento
- Todos los importes monetarios se almacenan en PostgreSQL como `numeric(12,2)`.
- Cantidades y stock se almacenan como `numeric(12,2)`.
- La precisión máxima es de 12 dígitos con 2 decimales.

## Cálculos
- Los cálculos de totales (órdenes, ventas) y ajustes de stock se realizan en el backend.
- Se aplica redondeo a 2 decimales (`Math.round(x * 100) / 100`) antes de persistir.
- Esto evita artefactos de punto flotante (ej. 0.1 + 0.2 = 0.30000000000000004).

## Serialización (API)
- Los valores Decimal de Prisma se serializan a `Number` (JavaScript) en la respuesta JSON.
- `Number` (IEEE 754 double) soporta hasta 15-17 dígitos significativos, suficiente para `numeric(12,2)`.
- No se pierde precisión para importes típicos de taller (< 10^10).

## Frontend
- Los tipos TypeScript usan `number` para importes.
- Los formateadores muestran 2 decimales en pantalla.
- No se realizan cálculos financieros críticos en el frontend; los totales se calculan en el backend.

## Verificación
- Prueba: 0.10 + 0.20 = 0.30 (sin artefacto) ✅
- Prueba: 10.50, 123456.78 preservados ✅
- Comparación PostgreSQL vs API: valores idénticos ✅
