# Sistema Taller

Sistema de gestión para talleres: clientes, productos, servicios, órdenes de trabajo, ventas, facturación, financiero, documentos, garantías, reportes.

## Instalación (Debian 13)

```bash
git clone -b migration/postgres-puro https://github.com/SantillanMJoseM/PoryectoTaller.git
cd PoryectoTaller
sudo bash scripts/install-postgresql.sh
```

El instalador se encarga de todo: dependencias, Docker, PostgreSQL, backend, frontend, migraciones y administrador inicial.

Al finalizar mostrará la URL y las credenciales del administrador inicial (admin@taller.com). El sistema exigirá cambio de contraseña en el primer ingreso.

## Scripts de operación
- `scripts/update-postgresql.sh` — actualizar preservando datos
- `scripts/backup-postgresql.sh` — backup completo
- `scripts/restore-postgresql.sh` — restauración con confirmación
- `scripts/status-postgresql.sh` — estado de servicios
- `scripts/uninstall-postgresql.sh` — desinstalación (datos preservados por defecto)

## Requisitos mínimos
- Debian 13 (o compatible)
- 1 GB RAM, 5 GB disco libre
- Conexión a Internet (primera instalación)
