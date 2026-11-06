# Portability Report — Sistema Taller

## Resultado

Prueba de portabilidad ejecutada en un directorio aislado (`/tmp/opencode/portability-test`) copiando el código fuente sin `node_modules`, `dist`, `.git` ni archivos `.env`.

- `npm ci`: OK.
- `npm test`: 17 archivos / 153 tests PASS sin `.env` (1 test falla únicamente si existe `.env.local`, comportamiento esperado).
- `npm run build`: OK (`dist/` generado).

## Limitaciones

- No se levantó Supabase en el entorno aislado para no tocar el despliegue local.
- La prueba valida código fuente, dependencias, tests y build, no el stack completo de servicios.
- La IP/puertos se configuran mediante `.env.local` y `supabase/config.toml`.

## Conclusión

El paquete es reproducible en un servidor limpio compatible, siempre que se configuren las variables de entorno y se ejecuten las migraciones mediante Supabase CLI.
