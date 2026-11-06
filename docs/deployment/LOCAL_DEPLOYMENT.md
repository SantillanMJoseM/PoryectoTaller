# Despliegue Local — Sistema Taller

> **AG-017 Deployment Manager** · Actualizado: 2026-11-06
> Entorno: LXC en LAN · IP `192.168.1.43` · uso intranet, **no publicado en Internet** (ver `LOCAL_NETWORK_ACCESS.md`).

| Campo | Valor |
| --- | --- |
| Estado | **DESPLEGADO Y OPERATIVO** (verificado en vivo el 2026-11-06) |
| Stack desplegado | Frontend SPA (`nginx:alpine`) + Supabase CLI v3 (`supabase start`) |
| Proyecto Supabase local | `sistema-taller` (`project_id` en `supabase/config.toml`) |
| Artefacto frontend | `dist/` generado por `./deploy.sh` (`npm ci` + `npm run build`) |
| Migraciones | `0001`–`0006` aplicadas |
| Seed | `supabase/seed.sql` cargado |
| RLS | 23/23 tablas |
| Credenciales iniciales y anon key | Ver `LOCAL_CREDENTIALS.md` |

> **Nota de actualización:** la versión anterior de este documento afirmaba que Docker no estaba disponible y que el despliegue no se había ejecutado. El despliegue local **sí está ejecutado y operativo**; este documento describe su topología, sus comandos reales y registra la verificación en vivo. No se ha modificado código.

---

## 1. Alcance y autorización

- Este documento cubre **únicamente el entorno local/intranet**. No ejecuta un despliegue nuevo: describe y valida el ya realizado.
- **NO autoriza despliegue a producción.** Todo paso a producción requiere aprobación humana explícita ligada a **proyecto, versión, commit, artefacto (con huella SHA-256), entorno, estrategia, plan de rollback y riesgos** (Formulario §9 de `DEPLOYMENT_PLAN.md`, gates G1–G7 de su §5.1: CI verde, Certificado de Calidad vigente, integridad del artefacto, migraciones verificadas, sin secretos privados, rollback ensayado y confirmación del aprobador).
- **RB-001:** el seed y las pruebas destructivas se aplican solo a dev/local/QA; nunca sobre producción con datos existentes.
- Este documento **no constituye un Certificado de Calidad**; la evidencia de calidad del release reside en `docs/quality/`.

---

## 2. Arquitectura desplegada

```
Navegador (LAN)
   │  http://192.168.1.43/  (:80)
   ▼
nginx:alpine  ── sirve dist/ (SPA) :ro ── rewrites → index.html      [docker compose]
   │
   │  VITE_SUPABASE_URL = http://192.168.1.43:54321  (embebido en el bundle)
   ▼
Kong → PostgREST / GoTrue (Auth) / Storage / Realtime / Edge Runtime   [supabase start]
   │
   ▼
PostgreSQL 15  ·  127.0.0.1:54322
   ├── Studio   :54323
   └── Mailpit  :54324
```

- **`docker-compose.yml` gestiona solo el frontend**: servicio `frontend` con imagen `nginx:alpine`, `ports: "80:80"`, `./dist` y `./nginx.conf` montados en solo lectura y `restart: unless-stopped`.
- **El backend lo gestiona Supabase CLI**, no compose. Por tanto **no existe un servicio `db` en `docker-compose.yml`** (ver §6.6).
- `nginx.conf` aplica `try_files $uri $uri/ /index.html` (necesario para las rutas de react-router).
- Las variables `VITE_*` se leen en **tiempo de build** y quedan embebidas en `dist/assets/index-*.js`; cambiarlas exige reconstruir con `./deploy.sh`.

---

## 3. Servicios y puertos

| Servicio | URL / endpoint | Puerto | Gestor | Notas |
| --- | --- | --- | --- | --- |
| **Frontend SPA** (nginx) | `http://192.168.1.43/` · `http://127.0.0.1/` | **80** | `docker compose up -d` | `dist/` en `:ro`; rewrites a `index.html`; acceso LAN |
| **Supabase API** (Kong → PostgREST, Auth, Storage, Realtime) | `http://192.168.1.43:54321` · `http://127.0.0.1:54321` | **54321** | `supabase start` | Es `VITE_SUPABASE_URL`; `GET /rest/v1/` y `GET /auth/v1/health` |
| **PostgreSQL** (BD) | `127.0.0.1:54322` (TCP, **no** HTTP) | **54322** | `supabase start` | `major_version = 15`; conexión vía la URL que muestra `supabase status -o env` |
| **Supabase Studio** | `http://127.0.0.1:54323` · `http://192.168.1.43:54323` | **54323** | `supabase start` | Redirige a `/project/default`; sin contraseña en local |
| **Mailpit** (SMTP de prueba + bandeja web) | `http://127.0.0.1:54324` · `http://192.168.1.43:54324` | **54324** | `supabase start` | `[local_smtp] enabled = true`; los correos **no se envían**, se inspeccionan aquí |

El frontend se sirve en el **puerto 80** de la LAN; el backend Supabase ocupa los puertos **54321** (API), **54322** (BD), **54323** (Studio) y **54324** (Mailpit). Todos responden tanto en `127.0.0.1` como en `192.168.1.43` (salvo la BD, que es TCP puro).

Configuración relevante (extracto anotado de `supabase/config.toml`, no un fragmento TOML literal):

```toml
project_id   = "sistema-taller"
[api]        port = 54321
[db]         port = 54322 · major_version = 15
[studio]     port = 54323 · api_url = "http://127.0.0.1"
[local_smtp] port = 54324 · enabled = true
[auth]       site_url = "http://192.168.1.43" · enable_confirmations = false
[db.seed]    enabled = true · sql_paths = ["./seed.sql"]
```

Puertos internos adicionales del stack (no usados por la aplicación, solo referencia): `54320` (`db.shadow_port`), `54327` (analytics/Logflare), `54329` (pooler, `enabled = false`), `8083` (inspector de Edge Runtime). Los puertos SMTP/POP3 `54325`/`54326` están comentados y no expuestos.

---

## 4. Comandos del despliegue real

### 4.1 Preparación (una sola vez)

```bash
cp .env.example .env.local          # .gitignore ignora "*.local" → no se versiona
# Editar .env.local con los valores locales (ver LOCAL_CREDENTIALS.md):
#   VITE_SUPABASE_URL=http://192.168.1.43:54321
#   VITE_SUPABASE_ANON_KEY=<anon key local, pública por diseño>
./deploy.sh                         # npm ci && npm run build → dist/
```

- `deploy.sh` elige `.env.local` si existe (prioridad) o `.env`; aborta si faltan ambos.
- `scripts/install.sh` usa `.env` (no `.env.local`); el flujo real documentado aquí es **`./deploy.sh` + `.env.local`**. Si se usa `install.sh`, crear también `.env` con los mismos valores.
- El build es reproducible (`npm ci` desde `package-lock.json`); `dist/` está git-ignorado.

### 4.2 Arranque (backend antes que frontend)

```bash
./scripts/start.sh
# Equivale a:
supabase start        # levanta Postgres/Auth/REST/Storage/Studio/Mailpit
docker compose up -d  # nginx sirve dist/ en :80
```

- Sobre un volumen nuevo, `supabase start` aplica `supabase/migrations/*.sql` en orden y ejecuta `supabase/seed.sql` (`[db.seed] enabled = true`).
- Para reaplicar explícitamente en cualquier momento: `supabase db reset`.

### 4.3 Verificación y diagnóstico

```bash
./scripts/diagnose.sh   # docker compose ps + supabase status
supabase status         # URLs, puertos y claves del stack local

curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/                        # 200
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:54321/auth/v1/health   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:54323/                 # 307
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:54324/                 # 200
```

> `supabase status` imprime también claves privilegiadas de operador del stack local: **no** se copian a este documento, al frontend ni al repositorio (ver §7).

### 4.4 Parada y reinicio

```bash
./scripts/stop.sh     # docker compose down && supabase stop
./scripts/start.sh    # reinicio completo
```

- `supabase stop` **conserva los volúmenes de datos** por defecto. `supabase stop --no-backup` los **borra**: no usarlo si se desean conservar los datos.
- El frontend es *stateless*: para recargar `dist/` basta `docker compose restart frontend`.

### 4.5 Migraciones y seed

```bash
supabase db reset     # reaplica 0001→0006 + seed.sql (solo entorno local)
```

| Migración | Contenido |
| --- | --- |
| `0001_init.sql` | 23 tablas del modelo en español + RLS parcial del prototipo |
| `0002_schema.sql` | Vistas (`v_stock_alerta`, `v_movimientos_situacion`, `v_cliente_vinculos`), índices, tabla `sesiones`, correcciones de esquema |
| `0003_rls.sql` | **RLS en 23/23 tablas**, helpers de sesión/permiso, políticas por código (`a/e/d/v/r/c`), **sin políticas para `anon`** |
| `0004_negocio.sql` | RPCs de negocio y triggers de stock, facturación única, auditoría y sesiones |
| `0005_storage.sql` | Buckets `anexos-orden`, `documentos`, `comprobantes` (privados) y `logos` (público) + políticas |
| `0006_rls_hardening.sql` | RLS + políticas en las 9 tablas que habían quedado sin política (`marcas`, `equipos`, `productos_orden`, `servicios_orden`, `equipos_orden`, `anexos`, `items_venta`, `logs_auditoria`, `cola_emails`) |

- Seed: `supabase/seed.sql`, **idempotente** (guard: si ya existe fila en `empresa`, no resiembra). Carga empresa, 2 grupos de permisos, 2 perfiles de usuario, 3 clientes, 6 productos, 3 servicios, órdenes, ventas, movimientos, documentos, anexos, logs y cola de emails en sus 4 estados.
- Los usuarios de Auth (`admin@taller.com`, `tecnico@taller.com`) y sus contraseñas iniciales se documentan en `LOCAL_CREDENTIALS.md`. **`seed.sql` no crea identidades en `auth.users`**: los perfiles se enlazan por correo y las identidades se crean aparte (ver §4.6). `enable_confirmations = false` permite login inmediato.

### 4.6 Usuarios iniciales de Supabase Auth

Las identidades de `auth.users` se crearon por el operador al preparar el entorno (no forman parte de las migraciones ni del seed). Si se recrea el volumen de la BD, deben crearse de nuevo. Con `enable_signup = true` y `enable_confirmations = false` (`config.toml`), el procedimiento estándar es el endpoint de signup con la anon key:

```bash
ANON='<anon key local — ver LOCAL_CREDENTIALS.md>'
API='http://127.0.0.1:54321'
for par in 'admin@taller.com:Admin123!' 'tecnico@taller.com:Tecnico123!'; do
  CORREO=${par%%:*}; CLAVE=${par#*:}
  curl -s -X POST "$API/auth/v1/signup" \
    -H "apikey: $ANON" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$CORREO\",\"password\":\"$CLAVE\"}"
done
# Alternativa sin comandos: Studio (:54323) → Authentication → Add user
```

---

## 5. Estado de la base de datos

| Ítem | Estado verificado |
| --- | --- |
| Migraciones | **0001–0006 aplicadas** (contrato PostgREST en vivo: 26 tablas/vistas = 23 tablas + 3 vistas, y 23 RPCs expuestas) |
| Seed | **Cargado** (`empresa` 1, `usuarios` 2, `clientes` 3, `productos` 6, `cola_emails` 4 filas, entre otras) |
| RLS | **23/23 tablas** con RLS y políticas; `0003` define el diseño y `0006` cierra las tablas sin política. **Cero políticas para `anon`**: con clave anónima las consultas devuelven 0 filas; con JWT `authenticated` devuelven datos |
| Storage | 4 buckets de `0005` creados |

---

## 6. Backup / Restore / Recovery

> El entorno local es **desechable y reproducible**: la recuperación canónica es reaplicar migraciones + seed. Aun así, antes de cualquier `db reset`, cambio de esquema o actualización, tomar un respaldo.

### 6.1 Backup (antes de tocar nada)

```bash
mkdir -p backups
FECHA=$(date +%Y%m%d)
supabase db dump            -f backups/esquema_$FECHA.sql   # esquema (public: tablas, vistas, RLS, RPC)
supabase db dump --data-only -f backups/datos_$FECHA.sql    # datos de la aplicación
sha256sum dist/index.html dist/assets/index-*.js > backups/SHA256SUMS_$FECHA.txt
cp -a dist backups/dist_anterior_$FECHA                     # artefacto frontend para rollback
```

- `supabase db dump` apunta por defecto al stack local (`127.0.0.1:54322`); `supabase db dump --dry-run` muestra el script `pg_dump` sin ejecutarlo.
- Conservar el `dist/` anterior si se va a actualizar el frontend (el rollback de frontend es el más frecuente y no pierde datos).

### 6.2 Restore (recuperar datos respaldados)

```bash
FECHA=YYYYMMDD
# 1) Recrear esquema limpio SIN seed (evita conflictos de PK al cargar el dump de datos)
supabase db reset --no-seed
# 2) Cargar los datos respaldados con la propia CLI (no requiere psql ni credenciales en el comando)
supabase db query -f backups/datos_$FECHA.sql
# 3) Verificar
./scripts/diagnose.sh
```

Alternativa con cliente Postgres, si está instalado: obtener la URL de conexión con `supabase status -o env` (variable `DB_URL`, no documentada aquí) y ejecutar `psql "$DB_URL" -f backups/datos_$FECHA.sql`.

> Revisar el contenido de `datos_*.sql` antes de restaurar: si contiene esquemas gestionados por Supabase (`auth`, `storage`), cargar solo las secciones aplicables. Nunca restaurar un dump sobre una BD con datos que se quieran conservar sin respaldo previo.

### 6.3 Recovery sin backup (volver al estado inicial verificado)

```bash
supabase db reset      # reaplica 0001–0006 + seed idempotente
./scripts/start.sh     # asegura frontend + backend arriba
./scripts/diagnose.sh
```

**Advertencia:** `supabase db reset` **descarta todos los datos escritos después del arranque** y devuelve la BD al estado del seed. Es aceptable en local (RB-001) y es la vía de recuperación ante corrupción del esquema o migración fallida. Tras el reset, **recrear las identidades de Auth** según §4.6 (el seed no las incluye) y verificar el login con `LOCAL_CREDENTIALS.md`.

### 6.4 Rollback de frontend (sin pérdida de datos)

```bash
# Restaurar el dist/ anterior (guardado en §6.1 como backups/dist_anterior_YYYYMMDD)
FECHA=YYYYMMDD
rm -rf dist && cp -a backups/dist_anterior_$FECHA dist
docker compose down && docker compose up -d
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/   # 200
```

El frontend es estático y no escribe en la BD; este rollback es seguro y no requiere tocar Supabase.

### 6.5 Persistencia y actualización

```bash
# Los datos persisten en el volumen Docker de Supabase mientras NO se use --no-backup
./scripts/stop.sh && ./scripts/start.sh          # reinicio conservando datos

# Actualización de código (sin cambios de esquema)
git pull && ./deploy.sh && docker compose restart frontend
```

- Objetivos de recuperación: **RTO** ≈ minutos (reinicio/`db reset`); **RPO** = último backup, dado que en local no hay PITR. Para producción aplican RPO/RTO y PITR de `DEPLOYMENT_PLAN.md` §8.

### 6.6 Nota sobre `LOCAL_BACKUP_RESTORE.md`

Ese documento indica `docker compose exec db pg_dump ...`. **Esos comandos no aplican a este despliegue**: `docker-compose.yml` no define servicio `db` (la BD la gestiona `supabase start`). Usar los comandos de §6.1–§6.5, basados en `supabase db dump` / `supabase db reset` / `supabase db query` contra el puerto `54322`.

---

## 7. Seguridad y exclusiones

- En este documento y en `LOCAL_CREDENTIALS.md` **solo** se publican la **anon key local** (pública por diseño, RB-036 / RNF-S-07) y las **credenciales iniciales de demostración** del seed.
- **No se incluyen**: la clave de rol privilegiado del proyecto (rol de servicio), el JWT *signing secret*, secretos SMTP, claves S3/Storage, la contraseña del rol `postgres` de la BD local, tokens de acceso/refresh, ni las claves de operador que imprime `supabase status`.
- `.env.local` está git-ignorado (`*.local`); `dist/` también. La plantilla versionada es `.env.example` (sin valores reales).
- Verificación sobre el artefacto (2026-11-06): el bundle contiene únicamente `VITE_SUPABASE_URL` + anon key; **0 coincidencias** de claves privilegiadas ni secretos SMTP. La protección real de los datos es **RLS**, no la anon key.
- Studio y Mailpit no tienen autenticación en local: mantenerlos solo en LAN (`LOCAL_NETWORK_ACCESS.md`).

---

## 8. Verificación en vivo (2026-11-06)

Comprobaciones de solo lectura ejecutadas sobre el despliegue operativo:

| Comprobación | Resultado |
| --- | --- |
| `http://127.0.0.1/` y `http://192.168.1.43/` | HTTP **200** |
| `GET /auth/v1/health` y `GET /rest/v1/` (`:54321`, con anon key) | HTTP **200** |
| TCP `127.0.0.1:54322` (Postgres) | **abierto** (no es HTTP) |
| `http://127.0.0.1:54323/` | HTTP **307** → `/project/default` |
| `http://127.0.0.1:54324/` (Mailpit) | HTTP **200** |
| Login `admin@taller.com` y `tecnico@taller.com` (`POST /auth/v1/token?grant_type=password`) | **OK**, rol `authenticated` |
| Seed | `empresa` 1 · `usuarios` 2 · `clientes` 3 · `productos` 6 · `cola_emails` 4 filas |
| RLS | con anon key: **0 filas**; con JWT autenticado: datos visibles (incluidas las 9 tablas de `0006`) |
| Contrato PostgREST | **26** tablas/vistas + **23** RPCs expuestas |
| Integridad del artefacto | URL LAN + anon key embebidos; **sin claves privadas** |
| Huellas SHA-256 del artefacto actual | `dist/index.html` `faf3fac276f5b60739af9f9b182f2a34f15d31594bae777ef48eb6e7e0fa96df` · `dist/assets/index-DrVFyCRI.js` `671692718d51d4a45f50ce49e8d4a822d954d6d035a91a7ecf40745d3cfd8076` |

> Las huellas corresponden al `dist/` presente el 2026-11-06; **recalcular tras cada build** (`sha256sum dist/index.html dist/assets/index-*.js`).

---

## 9. Solución de problemas

| Síntoma | Causa | Acción |
| --- | --- | --- |
| `permission denied while trying to connect to the docker API` | El usuario no tiene acceso al socket Docker | Ejecutar como usuario con permisos Docker (miembro del grupo `docker`) o con el operador que inició el stack; los servicios ya activos siguen respondiendo en sus puertos |
| `supabase status` → `StatusDbInspectError` | Sin acceso al socket Docker para inspeccionar contenedores | Igual que arriba; usar `scripts/diagnose.sh` desde la cuenta operadora |
| Frontend en modo diagnóstico (aviso de configuración) | Faltaban `VITE_*` en el momento del build | Completar `.env.local` y re-ejecutar `./deploy.sh` + `docker compose restart frontend` |
| Login inicial falla | Volumen borrado con `--no-backup` o identidades de Auth no recreadas | `supabase db reset` (restaura esquema + perfiles del seed) **y** recrear los 2 usuarios de `auth.users` según §4.6; verificar con `LOCAL_CREDENTIALS.md` |
| Puerto ocupado al hacer `supabase start` | Otro stack/instancia local en la misma máquina | `supabase status`, `supabase stop --all` (con respaldo previo) o revisar `config.toml` |
| Cambio de anon key tras regenerar el stack | `supabase start` genera claves demo nuevas | Actualizar `.env.local` y reconstruir (`./deploy.sh`) |

---

## 10. Referencias

- `LOCAL_CREDENTIALS.md` — credenciales iniciales y anon key local
- `LOCAL_NETWORK_ACCESS.md` — acceso intranet y restricciones de exposición
- `LOCAL_BACKUP_RESTORE.md` — comandos heredados (ver salvedad §6.6)
- `DEPLOYMENT_PLAN.md` — gate Go/No-Go, rollback de producción y **Formulario §9 de aprobación humana**
- `PREPRODUCTION_CHECKLIST.md`, `DEVOPS.md`, `STAGING_DEPLOYMENT.md`
- `supabase/config.toml`, `docker-compose.yml`, `nginx.conf`, `deploy.sh`, `scripts/*.sh`
- `docs/database/MIGRATIONS.md`, `docs/database/RLS_POLICIES.md`, `docs/quality/*`

---

*AG-017 Deployment Manager · Documentación del despliegue local real. Prepara y valida; **no autoriza despliegue a producción**.*
