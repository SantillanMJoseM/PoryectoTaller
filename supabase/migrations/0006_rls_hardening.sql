-- Hardening RLS: asegurar RLS en todas las tablas y políticas mínimas.
-- Nota: el portal del cliente usa anon + filtro por correo/documento en la app;
-- no hay JWT de cliente, por lo que el aislamiento se valida en la capa de servicio.
-- En staging/producción se recomienda migrar el portal a Supabase Auth con rol 'cliente'.

alter table marcas enable row level security;
alter table equipos enable row level security;
alter table productos_orden enable row level security;
alter table servicios_orden enable row level security;
alter table equipos_orden enable row level security;
alter table anexos enable row level security;
alter table items_venta enable row level security;
alter table logs_auditoria enable row level security;
alter table cola_emails enable row level security;

-- Políticas base para tablas sin política previa (authenticated full, anon read-only donde aplica)
create policy "auth all marcas" on marcas for all to authenticated using (true) with check (true);
create policy "auth all equipos" on equipos for all to authenticated using (true) with check (true);
create policy "auth all productos_orden" on productos_orden for all to authenticated using (true) with check (true);
create policy "auth all servicios_orden" on servicios_orden for all to authenticated using (true) with check (true);
create policy "auth all equipos_orden" on equipos_orden for all to authenticated using (true) with check (true);
create policy "auth all anexos" on anexos for all to authenticated using (true) with check (true);
create policy "auth all items_venta" on items_venta for all to authenticated using (true) with check (true);
create policy "auth all logs_auditoria" on logs_auditoria for all to authenticated using (true) with check (true);
create policy "auth all cola_emails" on cola_emails for all to authenticated using (true) with check (true);
