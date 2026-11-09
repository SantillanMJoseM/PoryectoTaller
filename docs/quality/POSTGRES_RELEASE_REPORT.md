# Release Report — PostgreSQL Puro (Sistema Taller)

- Rama: migration/postgres-puro
- Tag: v1.0.0-postgres (commit base 31df4d3; correcciones posteriores hasta f29a667)
- Commit desplegado: f29a667
- Fecha: 2026-11-09

## Validaciones
- Frontend build: OK (npm run build)
- Frontend tsc: OK (npx tsc --noEmit)
- Backend tsc: OK (npx tsc -p tsconfig.json)
- Backend arranque: OK
- Smoke login: OK
- CRUD clientes: OK
- Docker Compose (postgres 17, backend, frontend): OK

## URL de acceso (testing)
- Frontend: http://192.168.1.43:8080
- Backend API: http://192.168.1.43:4000
- API docs: http://192.168.1.43:4000/api/docs

## Admin inicial
- Correo: admin@taller.local
- Contraseña inicial: ChangeMe123! (cambio obligatorio en primer ingreso)
