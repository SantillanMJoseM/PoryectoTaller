# Sales & Orders Relation Fix — Sistema Taller

Fecha: 2026-11-06

## Causa raíz

Las claves foráneas existen en PostgreSQL (`ventas.cliente_id -> clientes.id_cliente`, `ordenes_trabajo.cliente_id -> clientes.id_cliente`), pero las consultas PostgREST usaban la sintaxis incorrecta:

```ts
clientes:id_cliente(*)
```

PostgREST espera el nombre de la columna FK en la tabla origen, no la PK del destino. Debe ser:

```ts
clientes:cliente_id(*)
```

Lo mismo aplicaba a `usuarios:id_usuario(*)` y `garantias:id_garantia(*)`.

## Correcciones

- `src/services/ventas.ts`: `SELECT_DETALLE` corregido a `clientes:cliente_id(*)`, `usuarios:usuario_id(*)`.
- `src/services/ordenes.ts`: `SELECT_DETALLE` corregido a `clientes:cliente_id(*)`, `usuarios:usuario_id(*)`, `garantias:garantia_id(*)`.
- `src/services/usuarios.ts`: relación corregida a `permisos:permiso_id(*)`.

## Migraciones

No fue necesario agregar una migración: las FK ya existían. Se corrigió la consulta, no el esquema.

## Verificación

- Detalle de venta: HTTP 200 y datos de cliente incluidos.
- Detalle de orden: HTTP 200 y cliente/productos/servicios incluidos.
- `npm test`: 18 archivos / 154 tests PASS.
- `npm run build`: OK.
- Despliegue local verificado en `http://192.168.1.43`.
