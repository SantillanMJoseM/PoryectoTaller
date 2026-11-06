-- ============================================================================
-- Sistema Taller — Migración 0010: ampliación de equipos
-- ============================================================================
alter table equipos add column if not exists condicion text;
alter table equipos add column if not exists numero_chasis text;
alter table equipos add column if not exists numero_motor text;

create index if not exists idx_equipos_condicion on equipos (condicion);
create index if not exists idx_equipos_serie on equipos (numero_serie);
-- ============================================================================
-- Fin de 0010
-- ============================================================================
