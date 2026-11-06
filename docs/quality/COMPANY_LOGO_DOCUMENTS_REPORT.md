# Company Logo in Documents Report — Sistema Taller

Fecha: 2026-11-06

## Causa raíz

El campo `url_logo` se guardaba correctamente en `empresa`, pero:

1. `cabeceraEmpresa()` y los mapeos de `Ordenes`, `Ventas` y `Portal` no incluían `logo`.
2. `dibujarCabecera()` en `src/lib/pdf.ts` no dibujaba el logo.

## Corrección

- `src/services/empresa.ts`: `cabeceraEmpresa()` incluye `logo: await logoComoDataUrl(e.url_logo)`.
- `src/services/reportes.ts`: convierte `url_logo` a data URL.
- `src/pages/Ordenes.tsx`, `Ventas.tsx`, `Portal.tsx`: pasan `logo` convertido a data URL.
- `src/lib/pdf.ts`: dibuja el logo en la esquina superior derecha del encabezado.

## Verificación

- `npm test`: 18 archivos / 154 tests PASS.
- `npm run build`: OK.
- Despliegue local actualizado en `http://192.168.1.43`.

## Sin logo

Si no existe `url_logo`, el PDF se genera normalmente sin imagen.
