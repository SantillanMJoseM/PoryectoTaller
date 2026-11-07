-- ============================================================================
-- Sistema Taller — Migración 0005: Storage (buckets y políticas)
-- (TASK-0006 / AG-010) — ADR-013, DATA_MODEL §10, RLS_POLICIES §6
-- ============================================================================
-- Buckets privados con acceso por códigos de permiso; logo público para
-- encabezado de PDFs (Panel/Portal/Informes). Convenio de ruta:
--   <id-entidad>/<uuid>-<nombre-sanitizado>  · límite 20 MB · firma 60 min.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('anexos-orden', 'anexos-orden', false),
       ('documentos',   'documentos',   false),
       ('comprobantes', 'comprobantes', false),
       ('logos',        'logos',        true)
on conflict (id) do nothing;

-- Políticas de Storage solo para authenticated; anon no descarga archivos
-- privados. Guard defensivo por nombre de política.
do $$
begin
  -- ---------------- logos (lectura autenticada; escritura admin) ----------
  if not exists (select 1 from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and policyname='logos leer') then
    create policy "logos leer" on storage.objects for select to authenticated
      using (bucket_id = 'logos');
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and policyname='logos escribir') then
    create policy "logos escribir" on storage.objects for insert to authenticated
      with check (bucket_id = 'logos' and public.es_administrador()
                  and (public.tiene_permiso('cEmpresa') or public.tiene_permiso('eEmpresa')));
  end if;

  -- ---------------- anexos-orden (vOrden / aOrden) ------------------------
  if not exists (select 1 from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and policyname='anexos-orden leer') then
    create policy "anexos-orden leer" on storage.objects for select to authenticated
      using (bucket_id = 'anexos-orden' and public.es_administrador()
             and public.tiene_permiso('vOrden'));
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and policyname='anexos-orden subir') then
    create policy "anexos-orden subir" on storage.objects for insert to authenticated
      with check (bucket_id = 'anexos-orden' and public.es_administrador()
                  and public.tiene_permiso('aOrden'));
  end if;

  -- ---------------- documentos (vArchivo / aArchivo) ----------------------
  if not exists (select 1 from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and policyname='documentos leer') then
    create policy "documentos leer" on storage.objects for select to authenticated
      using (bucket_id = 'documentos' and public.es_administrador()
             and public.tiene_permiso('vArchivo'));
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and policyname='documentos subir') then
    create policy "documentos subir" on storage.objects for insert to authenticated
      with check (bucket_id = 'documentos' and public.es_administrador()
                  and public.tiene_permiso('aArchivo'));
  end if;

  -- ---------------- comprobantes (vMovimiento / aMovimiento) --------------
  if not exists (select 1 from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and policyname='comprobantes leer') then
    create policy "comprobantes leer" on storage.objects for select to authenticated
      using (bucket_id = 'comprobantes' and public.es_administrador()
             and public.tiene_permiso('vMovimiento'));
  end if;
  if not exists (select 1 from pg_policies
                  where schemaname='storage' and tablename='objects'
                    and policyname='comprobantes subir') then
    create policy "comprobantes subir" on storage.objects for insert to authenticated
      with check (bucket_id = 'comprobantes' and public.es_administrador()
                  and public.tiene_permiso('aMovimiento'));
  end if;
end $$;

-- ============================================================================
-- Fin de 0005_storage.sql
-- ============================================================================
