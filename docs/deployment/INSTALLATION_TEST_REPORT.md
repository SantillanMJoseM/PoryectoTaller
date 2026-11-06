# Installation Test Report — Sistema Taller

## Entorno de prueba

- Directorio aislado: `/tmp/opencode/portability-test`.
- Node.js 22.
- npm.
- Sin `.git`, sin `node_modules`, sin `dist`, sin `.env`.

## Resultados

- `npm ci`: OK.
- `npm test`: 17/18 archivos PASS, 153/154 tests PASS (la única falla depende de la presencia de `.env.local`).
- `npm run build`: OK.

## Verificación de secretos

- No se copiaron `.env` ni `.env.local`.
- No se publicaron credenciales.

## Conclusión

La instalación base es reproducible. El stack completo debe validarse en el servidor definitivo siguiendo `INSTALLATION_PACKAGE.md`.
