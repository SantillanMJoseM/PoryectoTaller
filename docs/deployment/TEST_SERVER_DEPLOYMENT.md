# Test Server Deployment

Servidor: 192.168.1.43 (testdesa)
Puertos:
- Frontend: 8080
- Backend: 4000
- PostgreSQL: 5433

Comandos:
cd /home/developer/taller-postgres
docker compose up -d --build

Verificación:
- http://192.168.1.43:8080 (frontend)
- http://192.168.1.43:4000/api/docs (API docs)
- docker compose ps (3 servicios healthy)
- docker compose logs backend

Persistencia verificada: contenedores reiniciados mantienen datos.
