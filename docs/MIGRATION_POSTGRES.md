# Migración Supabase → PostgreSQL puro

## Arquitectura nueva
- Frontend: React + TypeScript + Tailwind (Vite)
- Backend: Node.js + TypeScript (Express) en `backend/`
- Base de datos: PostgreSQL 17 (Prisma ORM)
- Auth: JWT (access + refresh), bcrypt
- RBAC: permisos por códigos (vCliente, aOrden, ...)
- Storage: filesystem local (`STORAGE_DIR`) con metadata en PostgreSQL
- Despliegue: Docker Compose (postgres, backend, frontend)

## Eliminado
- @supabase/supabase-js
- Supabase Auth, PostgREST, Storage, Realtime, Edge Functions, Studio, Kong

## Endpoints
- /api/auth/* (login, portal-login, refresh, logout, me, change-password, ...)
- /api/<recurso> CRUD genérico
- /api/orden/*, /api/venta/*, /api/mov/*, /api/sesion/*, /api/storage/*

## Instalación
docker compose up -d --build

Admin inicial: ADMIN_EMAIL / ADMIN_PASSWORD (cambio obligatorio en primer ingreso).
