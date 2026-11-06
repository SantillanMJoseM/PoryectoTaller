# Inline Brand Creation — Sistema Taller

Fecha: 2026-11-06

## Implementación

- Botón `+ Agregar marca` en el formulario de equipos (página Equipos y modal de orden).
- Validación de duplicados sin distinguir mayúsculas/minúsculas.
- La marca nueva se selecciona automáticamente.

## Verificación

- `npm test`: 19 archivos / 155 tests PASS.
- `npm run build`: OK.
- Despliegue local: `http://192.168.1.43`.
