# Dark Theme Dropdowns — Sistema Taller

Fecha: 2026-11-06

## Problema

Las opciones de dropdowns nativos se veían blancas sobre blanco en tema oscuro.

## Corrección

- `src/index.css`: estilos base para `select` y `option` usando variables semánticas.
- `src/components/SimpleSelect.tsx`: fondo `bg-background` y `dark:bg-input/30`.

## Verificación

- `npm run build`: OK.
- Despliegue local: `http://192.168.1.43`.
- Tema claro y oscuro verificados en selects.
