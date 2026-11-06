# Git Release Report — Sistema Taller

Fecha: 2026-11-06

## Repositorio

- Rama: `main`
- Remote configurado: **ninguno**
- Publicación remota: **no realizada** (por instrucción explícita)

## Commits locales

- `d4d8e97` Consolidación local de Sistema Taller: runtime, auth, seguridad y despliegue
- `ce32193` Correcciones funcionales: relaciones ventas/órdenes y tema claro/oscuro
- `e12023f` Logo en documentos PDF, paquete de instalación y portabilidad

## Verificaciones

- `npm test`: 18 archivos / 154 tests PASS.
- `npm run build`: OK.
- Despliegue local: `http://192.168.1.43` responde 200.
- Secretos: `.env`, `.env.local`, credenciales y `dist/` permanecen ignorados.

## Conclusión

El repositorio local contiene todos los cambios y está preparado para una futura publicación manual. No se ejecutó `git push`.
