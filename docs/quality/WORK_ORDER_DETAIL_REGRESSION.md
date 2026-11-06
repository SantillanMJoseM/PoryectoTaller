# Work Order Detail Regression — Sistema Taller

Fecha: 2026-11-06

## Causa raíz

`catalogosService.equiposOrden.listarDeOrden` devuelve un objeto paginado `{ datos, ... }`, pero `DetalleOrden` lo asignaba directamente a `equiposOrden`, que luego llamaba `.map()`.

## Corrección

- Se extrae `.datos` antes de asignar a `equiposOrden`.
- Se corrige `equipos.listar` para usar `.datos`.
- Se mantienen estados de carga, vacío y error.

## Verificación

- `npm test`: 19 archivos / 155 tests PASS.
- `npm run build`: OK.
- Despliegue local: `http://192.168.1.43`.
