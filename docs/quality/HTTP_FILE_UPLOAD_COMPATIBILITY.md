# HTTP File Upload Compatibility — Sistema Taller

Fecha: 2026-11-06

## Problema

`crypto.randomUUID()` no está disponible en contextos no seguros (HTTP LAN), provocando fallos al subir logo, anexos y documentos.

## Corrección

Se creó `src/lib/uuid.ts` con `generarUuid()`, que usa `crypto.randomUUID()` cuando está disponible y `crypto.getRandomValues()` en caso contrario.

Se reemplazó en:

- `src/lib/supabase.ts`
- `src/services/ordenes.ts`
- `src/services/archivos.ts`
- `src/services/empresa.ts`

## Verificación

- `npm run build`: OK.
- Despliegue local por HTTP: `http://192.168.1.43`.
- No se usa `Math.random()` como sustituto criptográfico.
