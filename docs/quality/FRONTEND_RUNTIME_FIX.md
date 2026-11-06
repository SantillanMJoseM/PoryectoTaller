# Frontend Runtime Fix — Sistema Taller

Fecha: 2026-11-06

## Síntoma

Pantalla blanca en `http://192.168.1.43`. Consola de Chrome:

```
Uncaught ReferenceError: Cannot access 'x3' before initialization
at index-DrVfYCRJ.js:99:52003
```

Nginx respondía `200`, por lo que el fallo era de ejecución del bundle, no de entrega.

## Causa raíz

En `src/App.tsx`, el array `RUTAS` se inicializaba a nivel de módulo **antes** de las declaraciones `const ... = lazy(...)` de los componentes que utiliza:

```ts
const RUTAS = [
  { ruta: "/", elemento: <Dashboard />, codigos: [] },
  ...
];

const Dashboard = lazy(() => import("./pages/Dashboard"));
...
```

Como `const` no se eleva, al evaluar `RUTAS` se accedía a `Dashboard`, `Clientes`, etc. antes de su inicialización (Temporal Dead Zone). El minificador renombró la variable a `x3`, produciendo `Cannot access 'x3' before initialization`.

Source map del bundle (`source-map`) confirmó el mapeo exacto:

- bundle: `index-*.js:99:52003`
- fuente: `src/App.tsx:19:26` → `Dashboard`

## Corrección aplicada

Se movieron todas las declaraciones `lazy(...)` **antes** de `RUTAS`, sin cambiar rutas, permisos ni módulos. No se parcheó el JavaScript minificado.

Archivos modificados:

- `src/App.tsx` (reordenamiento de inicialización)
- `src/test/app-import.test.ts` (prueba de regresión TDZ, nueva)

## Pruebas

- Regresión nueva: `src/test/app-import.test.ts` importa `App` y falla si reaparece el TDZ.
- Suite completa: `npm test` → **18 archivos / 154 tests PASS**.
- Build: `npm run build` → OK.
- Verificación de secretos en `dist/`: sin `service_role` ni secretos privados.

## Build y despliegue

- Nuevo bundle generado: `dist/assets/index-DSxZF9yl.js`.
- Desplegado mediante `./scripts/start.sh` (Nginx) **sin tocar PostgreSQL ni volúmenes**.
- `http://192.168.1.43/` responde `HTTP 200` y sirve `index-DSxZF9yl.js`.

## Verificación HTTP

```
HTTP 200
bundle servido: index-DSxZF9yl.js
```

## Limitación de entorno

No hay motor de navegador instalado en el LXC para ejecutar la SPA automáticamente. La corrección se verificó por:

1. mapeo exacto del stack trace con source map,
2. importación del módulo `App` en Node sin `ReferenceError`,
3. nueva prueba de regresión TDZ,
4. entrega HTTP del bundle corregido.

Se recomienda una verificación visual final en un navegador cliente de la LAN (`http://192.168.1.43`), que ahora debería renderizar la aplicación sin pantalla blanca.
