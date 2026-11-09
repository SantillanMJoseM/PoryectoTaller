-- ============================================================================
-- Sistema Taller — Migración 0012: autenticación administrativa inicial
-- ============================================================================

alter table public.usuarios
  add column if not exists debe_cambiar_contrasena boolean not null default false;

-- RPC para finalizar el cambio obligatorio de contraseña del usuario en sesión.
create or replace function public.finalizar_cambio_contrasena()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_correo text;
begin
  select email into v_correo from auth.users where id = auth.uid();
  if v_correo is null then
    raise exception 'Sesión inválida.';
  end if;
  update public.usuarios
     set debe_cambiar_contrasena = false
   where correo = v_correo;
end $$;

revoke all on function public.finalizar_cambio_contrasena() from public;
grant execute on function public.finalizar_cambio_contrasena() to authenticated;
