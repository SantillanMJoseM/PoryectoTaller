-- ============================================================================
-- Sistema Taller — Migración 0002: Esquema canónico (TASK-0006 / AG-010)
-- ============================================================================
-- Corrige los defectos de 0001_init.sql sobre el diseño de TASK-0005
-- (docs/database/schema.sql, DATA_MODEL.md):
--   D-01: usuarios.doble «estado» → estado (región) + estado_usuario (bool)
--   D-04: faltan sesiones, CHECKs, FK/RB-022, índices y vistas
--   Ajuste técnico: documentos.tamaño → tamanio (sin ñ); contraseñas solo en
--   auth.users (bcrypt) — se retira la columna insegura contrasena.
-- Convenciones: PK uuid gen_random_uuid(); dinero numeric(12,2);
-- enum-style text + CHECK; FK RESTRICT por defecto, CASCADE solo tablas línea.
-- Supuesto: la cadena se aplica sobre un entorno 0001 sin datos de producción.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1. usuarios: renombrar «estado» (bool activo) → estado_usuario, agregar
--    «estado» text (región), retirar hash inseguro (solo auth.users).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'usuarios'
                   and column_name = 'estado_usuario') then
    alter table usuarios rename column estado to estado_usuario;
  end if;
end $$;

alter table usuarios add column if not exists estado text;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'usuarios'
               and column_name = 'contrasena') then
    alter table usuarios drop column contrasena;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. permisos: «permisos» text → jsonb (array de códigos aCliente, vOrden, …)
-- ---------------------------------------------------------------------------
do $$
declare v_tipo text;
begin
  select data_type into v_tipo
    from information_schema.columns
   where table_schema = 'public' and table_name = 'permisos'
     and column_name = 'permisos';
  if v_tipo = 'text' then
    alter table permisos add column permisos_jsonb jsonb not null default '[]'::jsonb;
    update permisos
       set permisos_jsonb = (
             select coalesce(jsonb_agg(trim(x)), '[]'::jsonb)
               from unnest(string_to_array(coalesce(permisos, ''), ',')) x
              where coalesce(trim(x), '') <> '');
    alter table permisos drop column permisos;
    alter table permisos rename column permisos_jsonb to permisos;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. NOT NULL y defaults (tablas vacías en el despliegue inicial)
-- ---------------------------------------------------------------------------
alter table empresa          alter column nombre set not null;
alter table permisos         alter column nombre set not null;
alter table usuarios         alter column nombre set not null;
alter table usuarios         alter column correo set not null;
alter table clientes         alter column nombre_cliente set not null;
alter table marcas           alter column marca set not null;
alter table equipos          alter column equipo set not null;
alter table productos        alter column descripcion set not null;
alter table productos        alter column precio_compra set not null;
alter table productos        alter column precio_venta set not null;
alter table productos        alter column stock set not null;
alter table productos        alter column stock_minimo set not null;
alter table servicios        alter column nombre set not null;
alter table garantias        alter column fecha_garantia set not null;
alter table categorias       alter column tipo set not null;
alter table cuentas          alter column tipo set not null;

do $$
begin
  alter table ordenes_trabajo alter column estado set not null;
  alter table ordenes_trabajo alter column valor_total set not null;
  alter table ordenes_trabajo alter column facturado set not null;
  alter table ordenes_trabajo alter column valor_total set default 0;
  alter table ordenes_trabajo alter column facturado set default false;
exception when others then null;  -- ya aplicado
end $$;

alter table productos_orden alter column cantidad set not null;
alter table productos_orden alter column precio set not null;
alter table productos_orden alter column subtotal set not null;

alter table servicios_orden alter column cantidad set not null;
alter table servicios_orden alter column precio set not null;
alter table servicios_orden alter column subtotal set not null;

alter table ventas alter column valor_total set not null;
alter table ventas alter column descuento set not null;
alter table ventas alter column facturado set not null;

alter table items_venta alter column cantidad set not null;
alter table items_venta alter column precio set not null;
alter table items_venta alter column subtotal set not null;

alter table movimientos_financieros alter column descripcion set not null;
alter table movimientos_financieros alter column valor set not null;
alter table movimientos_financieros alter column pagado set not null;
alter table movimientos_financieros alter column tipo set not null;

alter table anexos alter column anexo set not null;
alter table anexos alter column ruta set not null;
alter table anexos alter column orden_id set not null;
alter table documentos alter column documento set not null;
alter table logs_auditoria alter column fecha set not null;
alter table logs_auditoria alter column hora set not null;
alter table cola_emails alter column para set not null;

-- ---------------------------------------------------------------------------
-- 4. sesiones — SP «sesiones»: tabla de sesiones de base de datos (§2.23)
-- ---------------------------------------------------------------------------
create table if not exists sesiones (
  id_sesion      uuid primary key default gen_random_uuid(),
  usuario_id     uuid references usuarios(id_usuario) on delete cascade,
  cliente_id     uuid references clientes(id_cliente) on delete cascade,
  tipo           text not null,
  inicio_sesion  timestamptz not null default now(),
  expiracion     timestamptz not null,          -- 12 h admin / 24 h cliente
  ip             text,
  activa         boolean not null default true,
  constraint chk_sesion_tipo   check (tipo in ('administrador','cliente')),
  constraint chk_sesion_sujeto check (num_nonnulls(usuario_id, cliente_id) = 1)
);

-- ---------------------------------------------------------------------------
-- 5. CHECKs de negocio (RB-008/010/014/018/019/020/025/030/026…)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'chk_producto_valores') then
    alter table productos add constraint chk_producto_valores check (
      stock >= 0 and stock_minimo >= 0 and precio_compra >= 0 and precio_venta >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_servicio_precio') then
    alter table servicios add constraint chk_servicio_precio check (precio >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_categoria_tipo') then
    alter table categorias add constraint chk_categoria_tipo check (tipo in ('ingreso','egreso'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_cuenta_tipo') then
    alter table cuentas add constraint chk_cuenta_tipo check (tipo in ('ingreso','egreso'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_orden_estado') then
    alter table ordenes_trabajo add constraint chk_orden_estado check (estado in (
      'Presupuesto','Abierta','En Proceso','Finalizado','Cancelado','Aguardando Piezas'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_orden_fechas') then
    alter table ordenes_trabajo add constraint chk_orden_fechas
      check ((fecha_final is null) or (fecha_final >= fecha_inicial));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_orden_valor') then
    alter table ordenes_trabajo add constraint chk_orden_valor check (valor_total >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_orden_facturada') then
    alter table ordenes_trabajo add constraint chk_orden_facturada
      check ((lanzamiento_id is null) or facturado);    -- RB-003/027
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_po_valores') then
    alter table productos_orden add constraint chk_po_valores
      check (cantidad > 0 and precio >= 0 and subtotal >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_so_valores') then
    alter table servicios_orden add constraint chk_so_valores
      check (cantidad > 0 and precio >= 0 and subtotal >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_venta_valores') then
    alter table ventas add constraint chk_venta_valores
      check (descuento >= 0 and valor_total >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_venta_facturada') then
    alter table ventas add constraint chk_venta_facturada
      check ((lanzamiento_id is null) or facturado);    -- RB-004/027
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_iv_valores') then
    alter table items_venta add constraint chk_iv_valores
      check (cantidad > 0 and precio >= 0 and subtotal >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_mov_tipo') then
    alter table movimientos_financieros add constraint chk_mov_tipo
      check (tipo in ('ingreso','egreso'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_mov_valor') then
    alter table movimientos_financieros add constraint chk_mov_valor check (valor > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_mov_pago') then
    alter table movimientos_financieros add constraint chk_mov_pago
      check ((pagado = false) or (fecha_pago is not null));   -- RB-014
  end if;
  if not exists (select 1 from pg_constraint where conname = 'chk_email_estado') then
    alter table cola_emails add constraint chk_email_estado
      check (estado in ('pendiente','enviando','enviado','fallido'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. FK con política de borrado del diseño (DATA_MODEL §5)
--    productos ligado a líneas históricas: SET NULL conserva el snapshot.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  -- items_venta.producto_id → productos: ON DELETE SET NULL
  select conname into r from pg_constraint
   where conrelid = 'items_venta'::regclass and contype = 'f'
     and (select count(*) from unnest(conkey) c where c::text = 'producto_id') > 0;
  if found then
    execute format('alter table items_venta drop constraint %I', r.conname);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_item_producto') then
    alter table items_venta
      add constraint fk_item_producto foreign key (producto_id)
        references productos(id_producto) on delete set null;
  end if;

  -- servicios_orden.servicio_id → servicios: ON DELETE SET NULL
  select conname into r from pg_constraint
   where conrelid = 'servicios_orden'::regclass and contype = 'f'
     and (select count(*) from unnest(conkey) c where c::text = 'servicio_id') > 0;
  if found then
    execute format('alter table servicios_orden drop constraint %I', r.conname);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_so_servicio') then
    alter table servicios_orden
      add constraint fk_so_servicio foreign key (servicio_id)
        references servicios(id_servicio) on delete set null;
  end if;

  -- FK movimientos_financieros.venta_id → ventas (canónica)
  select conname into r from pg_constraint
   where conrelid = 'movimientos_financieros'::regclass and contype = 'f'
     and (select count(*) from unnest(conkey) c where c::text = 'venta_id') > 0;
  if found and r.conname <> 'fk_mov_venta' then
    execute format('alter table movimientos_financieros drop constraint %I', r.conname);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'fk_mov_venta') then
    alter table movimientos_financieros
      add constraint fk_mov_venta foreign key (venta_id)
        references ventas(id_venta);
  end if;
end $$;

-- Un solo vínculo de facturación por documento (RB-003/004/027)
create unique index if not exists uq_orden_lanzamiento
  on ordenes_trabajo (lanzamiento_id) where lanzamiento_id is not null;
create unique index if not exists uq_venta_lanzamiento
  on ventas (lanzamiento_id) where lanzamiento_id is not null;
create unique index if not exists uq_mov_venta
  on movimientos_financieros (venta_id) where venta_id is not null;

-- Unicidades de clientes y usuarios (deduplicación RF-054 / portal RB-012)
create unique index if not exists uq_clientes_documento
  on clientes (documento) where documento is not null;
create unique index if not exists uq_clientes_portal_par
  on clientes (lower(correo), documento)
  where correo is not null and documento is not null;
create unique index if not exists uq_usuarios_cpf
  on usuarios (cpf) where cpf is not null;

-- ---------------------------------------------------------------------------
-- 7. Índices (búsqueda, filtros, paginación, autocompletado — DATA_MODEL §8)
-- ---------------------------------------------------------------------------
create index if not exists idx_clientes_nombre    on clientes (lower(nombre_cliente) text_pattern_ops);
create index if not exists idx_clientes_documento on clientes (documento);
create index if not exists idx_clientes_correo    on clientes (lower(correo) text_pattern_ops);
create index if not exists idx_clientes_registro  on clientes (fecha_registro desc);

create index if not exists idx_usuarios_registro on usuarios (fecha_registro desc);
create index if not exists idx_productos_desc    on productos (lower(descripcion) text_pattern_ops);
create index if not exists idx_servicios_nom     on servicios (lower(nombre) text_pattern_ops);
create index if not exists idx_marcas_nom        on marcas (lower(marca) text_pattern_ops);
create index if not exists idx_garantias_ref     on garantias (lower(referencia) text_pattern_ops);
create index if not exists idx_garantias_fecha   on garantias (fecha_garantia desc);

create index if not exists idx_ordenes_estado   on ordenes_trabajo (estado);
create index if not exists idx_ordenes_fechain  on ordenes_trabajo (fecha_inicial desc);
create index if not exists idx_ordenes_cliente  on ordenes_trabajo (cliente_id);
create index if not exists idx_ordenes_usuario  on ordenes_trabajo (usuario_id);
create index if not exists idx_ordenes_factur   on ordenes_trabajo (facturado);

create index if not exists idx_po_orden    on productos_orden (orden_id);
create index if not exists idx_po_producto on productos_orden (producto_id);
create index if not exists idx_so_orden    on servicios_orden (orden_id);
create index if not exists idx_so_servicio on servicios_orden (servicio_id);
create index if not exists idx_eo_orden    on equipos_orden (orden_id);
create index if not exists idx_eo_equipo   on equipos_orden (equipo_id);
create index if not exists idx_equipos_cliente on equipos (cliente_id);
create index if not exists idx_equipos_marca   on equipos (marca_id);

create index if not exists idx_ventas_fecha   on ventas (fecha_venta desc);
create index if not exists idx_ventas_cliente on ventas (cliente_id);
create index if not exists idx_ventas_factur  on ventas (facturado);
create index if not exists idx_iv_venta       on items_venta (venta_id);
create index if not exists idx_iv_producto    on items_venta (producto_id);

create index if not exists idx_mov_venc  on movimientos_financieros (fecha_vencimiento);
create index if not exists idx_mov_pago  on movimientos_financieros (pagado);
create index if not exists idx_mov_tipo  on movimientos_financieros (tipo);
create index if not exists idx_mov_cli   on movimientos_financieros (cliente_id);
create index if not exists idx_mov_cat   on movimientos_financieros (categoria_id);
create index if not exists idx_mov_cta   on movimientos_financieros (cuenta_id);
create index if not exists idx_mov_prov  on movimientos_financieros (lower(cliente_proveedor) text_pattern_ops);

create index if not exists idx_doc_doc       on documentos (lower(documento) text_pattern_ops);
create index if not exists idx_doc_categoria on documentos (categoria);
create index if not exists idx_doc_fecha     on documentos (fecha_registro desc);

create index if not exists idx_logs_fecha on logs_auditoria (fecha desc, hora desc);
create index if not exists idx_logs_user  on logs_auditoria (usuario);

create index if not exists idx_email_estado on cola_emails (estado);
create index if not exists idx_email_fecha  on cola_emails (fecha desc);

create index if not exists idx_sesiones_user   on sesiones (usuario_id);
create index if not exists idx_sesiones_cli    on sesiones (cliente_id);
create index if not exists idx_sesiones_activa on sesiones (activa);
create index if not exists idx_sesiones_vence  on sesiones (expiracion);

-- ---------------------------------------------------------------------------
-- 8. Vistas (security_invoker ⇒ heredan RLS): Panel, Financiero e Informes
-- ---------------------------------------------------------------------------
create or replace view v_stock_alerta with (security_invoker = true) as
  select id_producto, descripcion, unidad, stock, stock_minimo,
         (stock_minimo - stock) as faltante
    from productos
   where stock < stock_minimo;                                 -- RF-016 / RF-007

create or replace view v_movimientos_situacion with (security_invoker = true) as
  select m.*,
         (m.pagado = false and m.fecha_vencimiento < current_date) as vencido,  -- RB-025
         case
           when m.pagado then 'realizado'
           when m.fecha_vencimiento < current_date then 'atrasado'
           when m.fecha_vencimiento > current_date then 'previsto'
           else 'pendiente'
         end as situacion                                     -- RB-026
    from movimientos_financieros m;

create or replace view v_cliente_vinculos with (security_invoker = true) as
  select c.id_cliente,
         (select count(*) from ordenes_trabajo o
           where o.cliente_id = c.id_cliente) as ordenes,
         (select count(*) from ventas v
           where v.cliente_id = c.id_cliente) as ventas,
         (select count(*) from movimientos_financieros mf
           where mf.cliente_id = c.id_cliente) as movimientos,
         (select count(*) from equipos eq
           where eq.cliente_id = c.id_cliente) as equipos
    from clientes c;                                           -- RF-013 / RB-022

-- ============================================================================
-- Fin de 0002_schema.sql
-- ============================================================================
