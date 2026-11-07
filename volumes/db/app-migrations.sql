-- Sistema Taller schema
create extension if not exists "uuid-ossp";

create table if not exists empresa (
  id uuid primary key default gen_random_uuid(),
  nombre text,
  cnpj text,
  ie text,
  calle text, numero text, barrio text, ciudad text, provincia text,
  telefono text, correo text, url_logo text,
  created_at timestamptz default now()
);

create table if not exists permisos (
  id_permiso uuid primary key default gen_random_uuid(),
  nombre text,
  permisos text,
  estado boolean default true,
  fecha date default current_date
);

create table if not exists usuarios (
  id_usuario uuid primary key default gen_random_uuid(),
  nombre text,
  rg text,
  cpf text,
  calle text, numero text, barrio text, ciudad text,
  correo text unique,
  contrasena text,
  telefono text,
  celular text,
  estado boolean default true,
  fecha_registro timestamptz default now(),
  permiso_id uuid references permisos(id_permiso),
  fecha_expiracion date
);

create table if not exists clientes (
  id_cliente uuid primary key default gen_random_uuid(),
  nombre_cliente text,
  sexo text,
  persona_fisica boolean default true,
  documento text,
  telefono text,
  celular text,
  correo text,
  fecha_registro timestamptz default now(),
  calle text, numero text, barrio text, ciudad text, estado text, codigo_postal text
);

create table if not exists marcas (
  id_marca uuid primary key default gen_random_uuid(),
  marca text,
  fecha_registro timestamptz default now(),
  estado boolean default true
);

create table if not exists equipos (
  id_equipo uuid primary key default gen_random_uuid(),
  equipo text,
  numero_serie text,
  modelo text,
  color text,
  descripcion text,
  tension text,
  potencia text,
  voltaje text,
  fecha_fabricacion date,
  marca_id uuid references marcas(id_marca),
  cliente_id uuid references clientes(id_cliente)
);

create table if not exists productos (
  id_producto uuid primary key default gen_random_uuid(),
  descripcion text,
  unidad text,
  precio_compra numeric(12,2) default 0,
  precio_venta numeric(12,2) default 0,
  stock numeric(12,2) default 0,
  stock_minimo numeric(12,2) default 0,
  salida boolean default false,
  entrada boolean default false
);

create table if not exists servicios (
  id_servicio uuid primary key default gen_random_uuid(),
  nombre text,
  descripcion text,
  precio numeric(12,2) default 0
);

create table if not exists garantias (
  id_garantia uuid primary key default gen_random_uuid(),
  fecha_garantia date default current_date,
  referencia text,
  texto_garantia text,
  usuario_id uuid references usuarios(id_usuario)
);

create table if not exists categorias (
  id_categoria uuid primary key default gen_random_uuid(),
  categoria text,
  fecha_registro timestamptz default now(),
  estado boolean default true,
  tipo text
);

create table if not exists cuentas (
  id_cuenta uuid primary key default gen_random_uuid(),
  cuenta text,
  banco text,
  numero text,
  saldo numeric(12,2) default 0,
  fecha_registro timestamptz default now(),
  estado boolean default true,
  tipo text
);

create table if not exists ordenes_trabajo (
  id_orden uuid primary key default gen_random_uuid(),
  fecha_inicial date default current_date,
  fecha_final date,
  garantia text,
  descripcion_producto text,
  defecto text,
  estado text default 'Presupuesto',
  observaciones text,
  laudo_tecnico text,
  valor_total numeric(12,2) default 0,
  cliente_id uuid references clientes(id_cliente),
  usuario_id uuid references usuarios(id_usuario),
  lanzamiento_id uuid,
  facturado boolean default false,
  garantia_id uuid references garantias(id_garantia)
);

create table if not exists productos_orden (
  id_producto_orden uuid primary key default gen_random_uuid(),
  cantidad numeric(12,2) default 1,
  descripcion text,
  precio numeric(12,2) default 0,
  orden_id uuid references ordenes_trabajo(id_orden) on delete cascade,
  producto_id uuid references productos(id_producto),
  subtotal numeric(12,2) default 0
);

create table if not exists servicios_orden (
  id_servicio_orden uuid primary key default gen_random_uuid(),
  servicio text,
  cantidad numeric(12,2) default 1,
  precio numeric(12,2) default 0,
  orden_id uuid references ordenes_trabajo(id_orden) on delete cascade,
  servicio_id uuid references servicios(id_servicio),
  subtotal numeric(12,2) default 0
);

create table if not exists equipos_orden (
  id_equipo_orden uuid primary key default gen_random_uuid(),
  defecto_declarado text,
  defecto_encontrado text,
  solucion text,
  equipo_id uuid references equipos(id_equipo),
  orden_id uuid references ordenes_trabajo(id_orden) on delete cascade
);

create table if not exists anexos (
  id_anexo uuid primary key default gen_random_uuid(),
  anexo text,
  miniatura text,
  url text,
  ruta text,
  orden_id uuid references ordenes_trabajo(id_orden) on delete cascade
);

create table if not exists ventas (
  id_venta uuid primary key default gen_random_uuid(),
  fecha_venta date default current_date,
  valor_total numeric(12,2) default 0,
  descuento numeric(12,2) default 0,
  facturado boolean default false,
  cliente_id uuid references clientes(id_cliente),
  usuario_id uuid references usuarios(id_usuario),
  lanzamiento_id uuid
);

create table if not exists items_venta (
  id_item_venta uuid primary key default gen_random_uuid(),
  cantidad numeric(12,2) default 1,
  descripcion text,
  precio numeric(12,2) default 0,
  venta_id uuid references ventas(id_venta) on delete cascade,
  producto_id uuid references productos(id_producto),
  subtotal numeric(12,2) default 0
);

create table if not exists movimientos_financieros (
  id_movimiento uuid primary key default gen_random_uuid(),
  descripcion text,
  valor numeric(12,2) default 0,
  fecha_vencimiento date,
  fecha_pago date,
  pagado boolean default false,
  cliente_proveedor text,
  forma_pago text,
  tipo text,
  anexo text,
  cliente_id uuid references clientes(id_cliente),
  categoria_id uuid references categorias(id_categoria),
  cuenta_id uuid references cuentas(id_cuenta),
  venta_id uuid references ventas(id_venta)
);

alter table ordenes_trabajo add constraint fk_orden_lanzamiento foreign key (lanzamiento_id) references movimientos_financieros(id_movimiento);
alter table ventas add constraint fk_venta_lanzamiento foreign key (lanzamiento_id) references movimientos_financieros(id_movimiento);

create table if not exists documentos (
  id_documento uuid primary key default gen_random_uuid(),
  documento text,
  descripcion text,
  archivo text,
  ruta text,
  url text,
  fecha_registro timestamptz default now(),
  categoria text,
  tipo text,
  tamanio bigint
);

create table if not exists logs_auditoria (
  id_log uuid primary key default gen_random_uuid(),
  usuario text,
  tarea text,
  fecha date default current_date,
  hora time default current_time,
  ip text
);

create table if not exists cola_emails (
  id uuid primary key default gen_random_uuid(),
  para text,
  cc text,
  cco text,
  mensaje text,
  estado text default 'pendiente',
  fecha timestamptz default now(),
  encabezados text
);

-- RLS enable
alter table clientes enable row level security;
alter table productos enable row level security;
alter table servicios enable row level security;
alter table ordenes_trabajo enable row level security;
alter table ventas enable row level security;
alter table movimientos_financieros enable row level security;
alter table documentos enable row level security;
alter table usuarios enable row level security;
alter table permisos enable row level security;
alter table empresa enable row level security;

-- Basic policies: authenticated users can select/insert/update; anon (client portal) limited.
create policy "auth all clientes" on clientes for all to authenticated using (true) with check (true);
create policy "auth all productos" on productos for all to authenticated using (true) with check (true);
create policy "auth all servicios" on servicios for all to authenticated using (true) with check (true);
create policy "auth all ordenes" on ordenes_trabajo for all to authenticated using (true) with check (true);
create policy "auth all ventas" on ventas for all to authenticated using (true) with check (true);
create policy "auth all fin" on movimientos_financieros for all to authenticated using (true) with check (true);
create policy "auth all docs" on documentos for all to authenticated using (true) with check (true);
create policy "auth all usuarios" on usuarios for all to authenticated using (true) with check (true);
create policy "auth all permisos" on permisos for all to authenticated using (true) with check (true);
create policy "auth all empresa" on empresa for all to authenticated using (true) with check (true);

-- Client portal: anon can read own client data by matching email+documento (handled in app; allow select on clientes for anon)
create policy "anon read clientes" on clientes for select to anon using (true);

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

-- ============================================================================
-- Sistema Taller — Migración 0003: RLS y helpers de sesión (TASK-0006 / AG-010)
-- ============================================================================
-- Sustituye las políticas permisivas del prototipo 0001 (defecto D-03:
-- política «anon read clientes») por el diseño completo de TASK-0005
-- (RLS_POLICIES.md): 23/23 tablas con RLS, ninguna política para anon,
-- plantilla admin: es_administrador() AND tiene_permiso('<código>'), y rama
-- de portal: es_cliente() AND propiedad (RB-032).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. RLS activado en las 23 tablas del modelo (RB-031)
-- ---------------------------------------------------------------------------
alter table empresa                 enable row level security;
alter table permisos                enable row level security;
alter table usuarios                enable row level security;
alter table clientes                enable row level security;
alter table marcas                  enable row level security;
alter table equipos                 enable row level security;
alter table productos               enable row level security;
alter table servicios               enable row level security;
alter table garantias               enable row level security;
alter table categorias              enable row level security;
alter table cuentas                 enable row level security;
alter table ordenes_trabajo         enable row level security;
alter table productos_orden         enable row level security;
alter table servicios_orden         enable row level security;
alter table equipos_orden           enable row level security;
alter table anexos                  enable row level security;
alter table ventas                  enable row level security;
alter table items_venta             enable row level security;
alter table movimientos_financieros enable row level security;
alter table documentos              enable row level security;
alter table logs_auditoria          enable row level security;
alter table cola_emails             enable row level security;
alter table sesiones                enable row level security;

-- Drop defensivo de TODAS las políticas previas del esquema public
-- (incluye las permissivas de 0001_init.sql).
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname
             from pg_policies
            where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Helpers de sesión (SECURITY DEFINER; claims del JWT de Supabase Auth).
--    El backend (Edge Function) firma el token con app_metadata:
--    { rol, usuario_id | cliente_id, permisos }
-- ---------------------------------------------------------------------------
create or replace function public.jwt_app_metadata()
returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata',
    '{}'::jsonb);
$$;

create or replace function public.rol_sesion() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select nullif(public.jwt_app_metadata() ->> 'rol', '');
$$;

create or replace function public.usuario_actual() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select nullif(public.jwt_app_metadata() ->> 'usuario_id', '')::uuid;
$$;

create or replace function public.cliente_actual() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select nullif(public.jwt_app_metadata() ->> 'cliente_id', '')::uuid;
$$;

create or replace function public.es_administrador() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.rol_sesion() = 'administrador';
$$;

create or replace function public.es_cliente() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select public.rol_sesion() = 'cliente';
$$;

-- Permiso: claim primero (O(1)); fallback a la tabla usuarios/permisos.
create or replace function public.tiene_permiso(p_codigo text) returns boolean
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_usuario uuid := public.usuario_actual();
  v_claim   text := public.jwt_app_metadata() ->> 'permisos';
begin
  if v_usuario is null then
    return false;
  end if;
  if v_claim is not null then
    return v_claim::jsonb ? p_codigo;
  end if;
  return exists (
    select 1
      from usuarios u
      join permisos p on p.id_permiso = u.permiso_id
     where u.id_usuario = v_usuario
       and u.estado_usuario is true                                      -- RB-023
       and p.estado is true                                              -- RB-023
       and (u.fecha_expiracion is null or u.fecha_expiracion >= current_date)  -- RB-024
       and p.permisos ? p_codigo
  );
end $$;

-- Propiedad del portal (definer: evita recursión de RLS)
create or replace function public.es_cliente_duenio_orden(p_orden uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_orden is not null and exists (
    select 1 from ordenes_trabajo o
     where o.id_orden = p_orden and o.cliente_id = public.cliente_actual());
$$;

create or replace function public.es_cliente_duenio_venta(p_venta uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_venta is not null and exists (
    select 1 from ventas v
     where v.id_venta = p_venta and v.cliente_id = public.cliente_actual());
$$;

revoke all on function public.jwt_app_metadata() from public, anon;

-- ---------------------------------------------------------------------------
-- 3. Políticas por tabla
-- ---------------------------------------------------------------------------

-- --- clientes (portal: lee/edita SOLO su propia fila) ---
create policy clientes_sel on clientes for select to authenticated using (
  (es_administrador() and tiene_permiso('vCliente'))
  or (es_cliente() and id_cliente = cliente_actual())
);
create policy clientes_ins on clientes for insert to authenticated
  with check (es_administrador() and tiene_permiso('aCliente'));
create policy clientes_upd on clientes for update to authenticated
  using ((es_administrador() and tiene_permiso('eCliente'))
         or (es_cliente() and id_cliente = cliente_actual()))
  with check ((es_administrador() and tiene_permiso('eCliente'))
              or (es_cliente() and id_cliente = cliente_actual()));
create policy clientes_del on clientes for delete to authenticated
  using (es_administrador() and tiene_permiso('dCliente'));

-- --- productos / servicios: CRUD admin ---
create policy productos_sel on productos for select to authenticated
  using (es_administrador() and tiene_permiso('vProducto'));
create policy productos_ins on productos for insert to authenticated
  with check (es_administrador() and tiene_permiso('aProducto'));
create policy productos_upd on productos for update to authenticated
  using (es_administrador() and tiene_permiso('eProducto'))
  with check (es_administrador() and tiene_permiso('eProducto'));
create policy productos_del on productos for delete to authenticated
  using (es_administrador() and tiene_permiso('dProducto'));

create policy servicios_sel on servicios for select to authenticated
  using (es_administrador() and tiene_permiso('vServicio'));
create policy servicios_ins on servicios for insert to authenticated
  with check (es_administrador() and tiene_permiso('aServicio'));
create policy servicios_upd on servicios for update to authenticated
  using (es_administrador() and tiene_permiso('eServicio'))
  with check (es_administrador() and tiene_permiso('eServicio'));
create policy servicios_del on servicios for delete to authenticated
  using (es_administrador() and tiene_permiso('dServicio'));

-- --- marcas y equipos: sub-recursos Clientes/Órdenes (E-04) ---
create policy marcas_sel on marcas for select to authenticated
  using (es_administrador() and (tiene_permiso('vCliente') or tiene_permiso('vOrden')));
create policy marcas_ins on marcas for insert to authenticated
  with check (es_administrador() and tiene_permiso('aCliente'));
create policy marcas_upd on marcas for update to authenticated
  using (es_administrador() and tiene_permiso('eCliente'))
  with check (es_administrador() and tiene_permiso('eCliente'));
create policy marcas_del on marcas for delete to authenticated
  using (es_administrador() and tiene_permiso('dCliente'));

create policy equipos_sel on equipos for select to authenticated using (
  (es_administrador() and (tiene_permiso('vCliente') or tiene_permiso('vOrden')))
  or (es_cliente() and cliente_id = cliente_actual())
);
create policy equipos_ins on equipos for insert to authenticated
  with check (es_administrador() and tiene_permiso('aCliente'));
create policy equipos_upd on equipos for update to authenticated
  using (es_administrador() and tiene_permiso('eCliente'))
  with check (es_administrador() and tiene_permiso('eCliente'));
create policy equipos_del on equipos for delete to authenticated
  using (es_administrador() and tiene_permiso('dCliente'));

-- --- órdenes de trabajo (portal lee solo sus órdenes) ---
create policy ordenes_sel on ordenes_trabajo for select to authenticated using (
  (es_administrador() and tiene_permiso('vOrden'))
  or (es_cliente() and es_cliente_duenio_orden(id_orden))
);
create policy ordenes_ins on ordenes_trabajo for insert to authenticated
  with check (es_administrador() and tiene_permiso('aOrden'));
create policy ordenes_upd on ordenes_trabajo for update to authenticated
  using (es_administrador() and tiene_permiso('eOrden'))
  with check (es_administrador() and tiene_permiso('eOrden'));
create policy ordenes_del on ordenes_trabajo for delete to authenticated
  using (es_administrador() and tiene_permiso('dOrden'));

create policy prod_orden_sel on productos_orden for select to authenticated using (
  (es_administrador() and tiene_permiso('vOrden'))
  or (es_cliente() and es_cliente_duenio_orden(orden_id))
);
create policy prod_orden_ins on productos_orden for insert to authenticated
  with check (es_administrador() and tiene_permiso('aOrden'));
create policy prod_orden_upd on productos_orden for update to authenticated
  using (es_administrador() and tiene_permiso('eOrden'))
  with check (es_administrador() and tiene_permiso('eOrden'));
create policy prod_orden_del on productos_orden for delete to authenticated
  using (es_administrador() and tiene_permiso('dOrden'));

create policy serv_orden_sel on servicios_orden for select to authenticated using (
  (es_administrador() and tiene_permiso('vOrden'))
  or (es_cliente() and es_cliente_duenio_orden(orden_id))
);
create policy serv_orden_ins on servicios_orden for insert to authenticated
  with check (es_administrador() and tiene_permiso('aOrden'));
create policy serv_orden_upd on servicios_orden for update to authenticated
  using (es_administrador() and tiene_permiso('eOrden'))
  with check (es_administrador() and tiene_permiso('eOrden'));
create policy serv_orden_del on servicios_orden for delete to authenticated
  using (es_administrador() and tiene_permiso('dOrden'));

create policy eq_orden_sel on equipos_orden for select to authenticated using (
  (es_administrador() and tiene_permiso('vOrden'))
  or (es_cliente() and es_cliente_duenio_orden(orden_id))
);
create policy eq_orden_ins on equipos_orden for insert to authenticated
  with check (es_administrador() and tiene_permiso('aOrden'));
create policy eq_orden_upd on equipos_orden for update to authenticated
  using (es_administrador() and tiene_permiso('eOrden'))
  with check (es_administrador() and tiene_permiso('eOrden'));
create policy eq_orden_del on equipos_orden for delete to authenticated
  using (es_administrador() and tiene_permiso('dOrden'));

create policy anexos_sel on anexos for select to authenticated using (
  (es_administrador() and tiene_permiso('vOrden'))
  or (es_cliente() and es_cliente_duenio_orden(orden_id))
);
create policy anexos_ins on anexos for insert to authenticated
  with check (es_administrador() and tiene_permiso('aOrden'));
create policy anexos_upd on anexos for update to authenticated
  using (es_administrador() and tiene_permiso('eOrden'))
  with check (es_administrador() and tiene_permiso('eOrden'));
create policy anexos_del on anexos for delete to authenticated
  using (es_administrador() and tiene_permiso('dOrden'));

-- --- garantías (portal ve la garantía de su orden — impresión E-07) ---
create policy garantias_sel on garantias for select to authenticated using (
  (es_administrador() and tiene_permiso('vGarantia'))
  or (es_cliente() and exists (
        select 1 from ordenes_trabajo o
         where o.garantia_id = garantias.id_garantia
           and o.cliente_id = cliente_actual()))
);
create policy garantias_ins on garantias for insert to authenticated
  with check (es_administrador() and tiene_permiso('aGarantia'));
create policy garantias_upd on garantias for update to authenticated
  using (es_administrador() and tiene_permiso('eGarantia'))
  with check (es_administrador() and tiene_permiso('eGarantia'));
create policy garantias_del on garantias for delete to authenticated
  using (es_administrador() and tiene_permiso('dGarantia'));

-- --- ventas e items (portal lee solo sus compras) ---
create policy ventas_sel on ventas for select to authenticated using (
  (es_administrador() and tiene_permiso('vVenta'))
  or (es_cliente() and es_cliente_duenio_venta(id_venta))
);
create policy ventas_ins on ventas for insert to authenticated
  with check (es_administrador() and tiene_permiso('aVenta'));
create policy ventas_upd on ventas for update to authenticated
  using (es_administrador() and tiene_permiso('eVenta'))
  with check (es_administrador() and tiene_permiso('eVenta'));
create policy ventas_del on ventas for delete to authenticated
  using (es_administrador() and tiene_permiso('dVenta'));

create policy items_venta_sel on items_venta for select to authenticated using (
  (es_administrador() and tiene_permiso('vVenta'))
  or (es_cliente() and es_cliente_duenio_venta(venta_id))
);
create policy items_venta_ins on items_venta for insert to authenticated
  with check (es_administrador() and tiene_permiso('aVenta'));
create policy items_venta_upd on items_venta for update to authenticated
  using (es_administrador() and tiene_permiso('eVenta'))
  with check (es_administrador() and tiene_permiso('eVenta'));
create policy items_venta_del on items_venta for delete to authenticated
  using (es_administrador() and tiene_permiso('dVenta'));

-- --- financiero (solo admin; el portal no ve movimientos) ---
create policy mov_sel on movimientos_financieros for select to authenticated
  using (es_administrador() and tiene_permiso('vMovimiento'));
create policy mov_ins on movimientos_financieros for insert to authenticated
  with check (es_administrador() and tiene_permiso('aMovimiento'));
create policy mov_upd on movimientos_financieros for update to authenticated
  using (es_administrador() and tiene_permiso('eMovimiento'))
  with check (es_administrador() and tiene_permiso('eMovimiento'));
create policy mov_del on movimientos_financieros for delete to authenticated
  using (es_administrador() and tiene_permiso('dMovimiento'));

create policy cat_sel on categorias for select to authenticated
  using (es_administrador() and tiene_permiso('vMovimiento'));
create policy cat_ins on categorias for insert to authenticated
  with check (es_administrador() and tiene_permiso('aMovimiento'));
create policy cat_upd on categorias for update to authenticated
  using (es_administrador() and tiene_permiso('eMovimiento'))
  with check (es_administrador() and tiene_permiso('eMovimiento'));
create policy cat_del on categorias for delete to authenticated
  using (es_administrador() and tiene_permiso('dMovimiento'));

create policy cta_sel on cuentas for select to authenticated
  using (es_administrador() and tiene_permiso('vMovimiento'));
create policy cta_ins on cuentas for insert to authenticated
  with check (es_administrador() and tiene_permiso('aMovimiento'));
create policy cta_upd on cuentas for update to authenticated
  using (es_administrador() and tiene_permiso('eMovimiento'))
  with check (es_administrador() and tiene_permiso('eMovimiento'));
create policy cta_del on cuentas for delete to authenticated
  using (es_administrador() and tiene_permiso('dMovimiento'));

-- --- documentos ---
create policy doc_sel on documentos for select to authenticated
  using (es_administrador() and tiene_permiso('vArchivo'));
create policy doc_ins on documentos for insert to authenticated
  with check (es_administrador() and tiene_permiso('aArchivo'));
create policy doc_upd on documentos for update to authenticated
  using (es_administrador() and tiene_permiso('eArchivo'))
  with check (es_administrador() and tiene_permiso('eArchivo'));
create policy doc_del on documentos for delete to authenticated
  using (es_administrador() and tiene_permiso('dArchivo'));

-- --- usuarios / permisos (solo admin) ---
create policy usr_sel on usuarios for select to authenticated
  using (es_administrador() and tiene_permiso('vUsuario'));
create policy usr_ins on usuarios for insert to authenticated
  with check (es_administrador() and tiene_permiso('aUsuario'));
create policy usr_upd on usuarios for update to authenticated
  using (es_administrador() and tiene_permiso('eUsuario'))
  with check (es_administrador() and tiene_permiso('eUsuario'));
create policy usr_del on usuarios for delete to authenticated
  using (es_administrador() and tiene_permiso('dUsuario'));

create policy per_sel on permisos for select to authenticated
  using (es_administrador() and tiene_permiso('vPermiso'));
create policy per_ins on permisos for insert to authenticated
  with check (es_administrador() and tiene_permiso('aPermiso'));
create policy per_upd on permisos for update to authenticated
  using (es_administrador() and tiene_permiso('ePermiso'))
  with check (es_administrador() and tiene_permiso('ePermiso'));
create policy per_del on permisos for delete to authenticated
  using (es_administrador() and tiene_permiso('dPermiso'));

-- --- logs_auditoria: lectura/borrado con código; escritura SOLO definer ---
create policy logs_sel on logs_auditoria for select to authenticated
  using (es_administrador() and tiene_permiso('vAuditoria'));
create policy logs_del on logs_auditoria for delete to authenticated
  using (es_administrador() and tiene_permiso('dAuditoria'));

-- --- cola_emails: lectura/eliminación con código; escritura por servicio ---
create policy email_sel on cola_emails for select to authenticated
  using (es_administrador() and tiene_permiso('vEmail'));
create policy email_del on cola_emails for delete to authenticated
  using (es_administrador() and tiene_permiso('dEmail'));

-- --- empresa: lectura para PDFs (admin + portal); escritura c/e Empresa ---
create policy emp_sel on empresa for select to authenticated
  using (es_administrador() or es_cliente());
create policy emp_ins on empresa for insert to authenticated
  with check (es_administrador() and tiene_permiso('cEmpresa'));
create policy emp_upd on empresa for update to authenticated
  using (es_administrador() and (tiene_permiso('eEmpresa') or tiene_permiso('cEmpresa')))
  with check (es_administrador() and (tiene_permiso('eEmpresa') or tiene_permiso('cEmpresa')));

-- --- sesiones: propia + admin (escritura solo definer/Edge Function) ---
create policy ses_sel on sesiones for select to authenticated using (
  (es_administrador() and (tiene_permiso('vUsuario') or usuario_id = usuario_actual()))
  or (es_cliente() and cliente_id = cliente_actual())
);

-- ============================================================================
-- Fin de 0003_rls.sql
-- ============================================================================

-- ============================================================================
-- Sistema Taller — Migración 0004: triggers de modelo y RPC de negocio
-- (TASK-0006 / AG-010)
-- ============================================================================
-- Materializa DATA_MODEL §7 (triggers 7.1–7.6) y las RPC compuestas que
-- aplican las REGLAS DE NEGOCIO de SOURCE_PROMPT.md:
--   RB-002/017/020  stock se actualiza al agregar/quitar productos en
--                   órdenes y ventas (allá y viceversa), nunca a mano.
--   RB-003/004/027  facturación única de orden/venta → movimiento financiero.
--   RB-009/028      auditoría automática de acciones relevantes.
--   RF-021          fecha_final al Finalizar.
--   RF-069          limpiar logs con auto-log previo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 7.1 Empresa única (RB-030)
-- ---------------------------------------------------------------------------
create or replace function public.f_empresa_unica() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from empresa where id <> new.id) then
    raise exception 'La empresa ya está registrada: edite los datos existentes (solo un registro).'
      using hint = 'empresa_unica';
  end if;
  return new;
end $$;

drop trigger if exists tg_empresa_unica on empresa;
create trigger tg_empresa_unica
  before insert or update on empresa
  for each row execute function public.f_empresa_unica();

-- ---------------------------------------------------------------------------
-- 7.2 Portal del cliente no cambia sus credenciales (E-05 / RF-079)
-- ---------------------------------------------------------------------------
create or replace function public.f_cliente_no_credenciales() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.es_cliente()
     and (new.correo is distinct from old.correo
          or new.documento is distinct from old.documento) then
    raise exception 'Para cambiar su correo o documento, contacte al taller.'
      using hint = 'credenciales_inmutables';
  end if;
  return new;
end $$;

drop trigger if exists tg_cliente_no_credenciales on clientes;
create trigger tg_cliente_no_credenciales
  before update on clientes
  for each row execute function public.f_cliente_no_credenciales();

-- ---------------------------------------------------------------------------
-- 7.3 Guard de stock: solo las RPC de líneas/ajuste tocan productos.stock
-- ---------------------------------------------------------------------------
create or replace function public.f_stock_no_directo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app.permite_stock_write', true), 'off') <> 'on' then
    raise exception 'El stock solo se actualiza mediante órdenes/ventas o ajuste de inventario.'
      using hint = 'stock_guard';
  end if;
  return new;
end $$;

drop trigger if exists tg_stock_no_directo on productos;
create trigger tg_stock_no_directo
  before update on productos
  for each row execute function public.f_stock_no_directo();

-- ---------------------------------------------------------------------------
-- 7.4 Recálculo de totales (RB-018/019)
-- ---------------------------------------------------------------------------
create or replace function public.f_recalcular_total_orden() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_orden uuid := coalesce(new.orden_id, old.orden_id);
begin
  update ordenes_trabajo o
     set valor_total = (
           (select coalesce(sum(subtotal), 0) from productos_orden p where p.orden_id = o.id_orden)
         + (select coalesce(sum(subtotal), 0) from servicios_orden s where s.orden_id = o.id_orden)
         )
   where o.id_orden = v_orden;
  return null;
end $$;

drop trigger if exists tg_recalcular_total_orden on productos_orden;
create trigger tg_recalcular_total_orden
  after insert or update or delete on productos_orden
  for each row execute function public.f_recalcular_total_orden();

drop trigger if exists tg_recalcular_total_orden on servicios_orden;
create trigger tg_recalcular_total_orden
  after insert or update or delete on servicios_orden
  for each row execute function public.f_recalcular_total_orden();

create or replace function public.f_recalcular_total_venta() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_venta uuid := coalesce(new.venta_id, old.venta_id);
begin
  update ventas v
     set valor_total = (
           (select coalesce(sum(subtotal), 0) from items_venta i where i.venta_id = v.id_venta)
         - v.descuento
         )
   where v.id_venta = v_venta;
  return null;
end $$;

drop trigger if exists tg_recalcular_total_compra on items_venta;
create trigger tg_recalcular_total_compra
  after insert or update or delete on items_venta
  for each row execute function public.f_recalcular_total_venta();

create or replace function public.f_recalcular_total_venta_upd() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.valor_total := (
    (select coalesce(sum(subtotal), 0) from items_venta i where i.venta_id = new.id_venta)
    - new.descuento
  );
  return new;
end $$;

drop trigger if exists tg_recalcular_total_descuento on ventas;
create trigger tg_recalcular_total_descuento
  before update of descuento on ventas
  for each row execute function public.f_recalcular_total_venta_upd();

-- ---------------------------------------------------------------------------
-- 7.5 Fecha final al Finalizar (RF-021)
-- ---------------------------------------------------------------------------
create or replace function public.f_orden_fecha_final() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.estado = 'Finalizado' and new.fecha_final is null then
    new.fecha_final := current_date;
  end if;
  return new;
end $$;

drop trigger if exists tg_orden_fecha_final on ordenes_trabajo;
create trigger tg_orden_fecha_final
  before update of estado on ordenes_trabajo
  for each row execute function public.f_orden_fecha_final();

-- ---------------------------------------------------------------------------
-- 7.6 Auditoría genérica (RB-009/028) — escritura solo por definer
-- ---------------------------------------------------------------------------
create or replace function public.f_auditar() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_op   text := case tg_op when 'INSERT' then 'agregar'
                            when 'UPDATE' then 'editar'
                            else 'eliminar' end;
  v_ip   text;
  v_user text;
begin
  v_ip := coalesce(nullif(current_setting('request.headers', true), '')::jsonb
           ->> 'x-forwarded-for', null);
  select coalesce(u.nombre, 'system') into v_user
    from usuarios u
   where u.id_usuario = public.usuario_actual();
  insert into logs_auditoria (usuario, tarea, ip)
  values (coalesce(v_user, 'system'), v_op || ' ' || tg_table_name, v_ip);
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['clientes','productos','servicios','garantias',
                           'movimientos_financieros','documentos','usuarios',
                           'permisos','empresa','ventas','ordenes_trabajo',
                           'categorias','cuentas','marcas','equipos']
  loop
    execute format('drop trigger if exists tg_auditar on %I', t);
    execute format(
      'create trigger tg_auditar after insert or update or delete on %I
         for each row execute function public.f_auditar()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers y RPC de negocio (executables por authenticated; SECURITY DEFINER)
-- ---------------------------------------------------------------------------

create or replace function public.requerir_permiso(p_codigo text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not public.tiene_permiso(p_codigo) then
    raise exception 'No tiene permiso para esta operación (%).', p_codigo
      using hint = 'permiso_denegado';
  end if;
end $$;

-- Ajuste de stock (única vía autorizada: GUC transaccional abierto aquí)
create or replace function public.ajustar_stock(p_producto uuid, p_delta numeric)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_stock numeric(12,2);
begin
  select stock into v_stock from productos where id_producto = p_producto
     for update;
  if v_stock is null then
    raise exception 'Producto inexistente.' using hint = 'producto_inexistente';
  end if;
  if v_stock + p_delta < 0 then
    raise exception 'Stock insuficiente para el producto seleccionado.'
      using hint = 'stock_insuficiente';
  end if;
  perform set_config('app.permite_stock_write', 'on', true);
  update productos set stock = stock + p_delta where id_producto = p_producto;
  perform set_config('app.permite_stock_write', 'off', true);
end $$;

-- ================= Órdenes de trabajo: líneas y stock (RB-002/017) ==========

create or replace function public.orden_agregar_producto(
  p_orden uuid, p_producto uuid, p_cantidad numeric, p_precio numeric default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_descripcion text;
  v_precio numeric(12,2);
begin
  perform public.requerir_permiso('aOrden');
  if coalesce(p_cantidad, 0) <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;
  select descripcion, coalesce(p_precio, precio_venta) into v_descripcion, v_precio
    from productos where id_producto = p_producto;
  if v_descripcion is null then
    raise exception 'Producto inexistente.' using hint = 'producto_inexistente';
  end if;
  if not exists (select 1 from productos where id_producto = p_producto and salida) then
    raise exception 'El producto no está habilitado como salida (venta/orden).';
  end if;
  perform public.ajustar_stock(p_producto, -p_cantidad);
  insert into productos_orden (orden_id, producto_id, cantidad, descripcion, precio, subtotal)
  values (p_orden, p_producto, p_cantidad, v_descripcion,
          round(v_precio, 2), round(p_cantidad * v_precio, 2))
  returning id_producto_orden into v_id;
  return v_id;
end $$;

create or replace function public.orden_cambiar_cantidad_producto(
  p_linea uuid, p_cantidad numeric
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r productos_orden%rowtype;
  v_delta numeric(12,2);
begin
  perform public.requerir_permiso('eOrden');
  if coalesce(p_cantidad, 0) <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;
  select * into r from productos_orden where id_producto_orden = p_linea;
  if r.id_producto_orden is null then
    raise exception 'Línea de producto inexistente.';
  end if;
  v_delta := r.cantidad - p_cantidad;   -- aumentar línea = devolver stock
  perform public.ajustar_stock(r.producto_id, v_delta);
  update productos_orden
     set cantidad = p_cantidad, subtotal = round(p_cantidad * precio, 2)
   where id_producto_orden = p_linea;
end $$;

create or replace function public.orden_quitar_producto(p_linea uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r productos_orden%rowtype;
begin
  perform public.requerir_permiso('eOrden');
  select * into r from productos_orden where id_producto_orden = p_linea;
  if r.id_producto_orden is null then
    raise exception 'Línea de producto inexistente.';
  end if;
  delete from productos_orden where id_producto_orden = p_linea;
  perform public.ajustar_stock(r.producto_id, r.cantidad);  -- devuelve stock
end $$;

-- ================= Ventas: items y stock (RB-002/017) =======================

create or replace function public.venta_agregar_item(
  p_venta uuid, p_producto uuid, p_cantidad numeric, p_precio numeric default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_descripcion text;
  v_precio numeric(12,2);
begin
  perform public.requerir_permiso('aVenta');
  if coalesce(p_cantidad, 0) <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;
  select descripcion, coalesce(p_precio, precio_venta) into v_descripcion, v_precio
    from productos where id_producto = p_producto;
  if v_descripcion is null then
    raise exception 'Producto inexistente.' using hint = 'producto_inexistente';
  end if;
  if not exists (select 1 from productos where id_producto = p_producto and salida) then
    raise exception 'El producto no está habilitado como salida (venta/orden).';
  end if;
  perform public.ajustar_stock(p_producto, -p_cantidad);
  insert into items_venta (venta_id, producto_id, cantidad, descripcion, precio, subtotal)
  values (p_venta, p_producto, p_cantidad, v_descripcion,
          round(v_precio, 2), round(p_cantidad * v_precio, 2))
  returning id_item_venta into v_id;
  return v_id;
end $$;

create or replace function public.venta_cambiar_cantidad_item(
  p_item uuid, p_cantidad numeric
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r items_venta%rowtype;
begin
  perform public.requerir_permiso('eVenta');
  if coalesce(p_cantidad, 0) <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;
  select * into r from items_venta where id_item_venta = p_item;
  if r.id_item_venta is null then
    raise exception 'Item de venta inexistente.';
  end if;
  perform public.ajustar_stock(r.producto_id, r.cantidad - p_cantidad);
  update items_venta
     set cantidad = p_cantidad, subtotal = round(p_cantidad * precio, 2)
   where id_item_venta = p_item;
end $$;

create or replace function public.venta_quitar_item(p_item uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r items_venta%rowtype;
begin
  perform public.requerir_permiso('eVenta');
  select * into r from items_venta where id_item_venta = p_item;
  if r.id_item_venta is null then
    raise exception 'Item de venta inexistente.';
  end if;
  delete from items_venta where id_item_venta = p_item;
  perform public.ajustar_stock(r.producto_id, r.cantidad);  -- devuelve stock
end $$;

-- ================= Facturación única (RB-003/004/027) =======================

create or replace function public.orden_facturar(
  p_orden uuid,
  p_fecha_vencimiento date default null,
  p_forma_pago text default null,
  p_categoria_id uuid default null,
  p_cuenta_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_total numeric(12,2);
  v_cliente uuid;
  v_mov uuid;
begin
  perform public.requerir_permiso('aMovimiento');
  select valor_total, cliente_id into v_total, v_cliente
    from ordenes_trabajo where id_orden = p_orden;
  if not found then
    raise exception 'Orden inexistente.';
  end if;
  if v_total <= 0 then
    raise exception 'No se puede facturar una orden sin valor total.';
  end if;
  insert into movimientos_financieros
    (descripcion, valor, fecha_vencimiento, pagado, cliente_proveedor, forma_pago,
     tipo, cliente_id, categoria_id, cuenta_id)
  values ('Facturación de orden', v_total, coalesce(p_fecha_vencimiento, current_date),
          false, null, p_forma_pago, 'ingreso', v_cliente, p_categoria_id, p_cuenta_id)
  returning id_movimiento into v_mov;
  update ordenes_trabajo
     set facturado = true, lanzamiento_id = v_mov
   where id_orden = p_orden;
  return v_mov;
end $$;

create or replace function public.venta_facturar(
  p_venta uuid,
  p_fecha_vencimiento date default null,
  p_forma_pago text default null,
  p_categoria_id uuid default null,
  p_cuenta_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_total numeric(12,2);
  v_cliente uuid;
  v_mov uuid;
begin
  perform public.requerir_permiso('aMovimiento');
  select valor_total, cliente_id into v_total, v_cliente
    from ventas where id_venta = p_venta;
  if not found then
    raise exception 'Venta inexistente.';
  end if;
  if v_total <= 0 then
    raise exception 'No se puede facturar una venta sin valor total.';
  end if;
  insert into movimientos_financieros
    (descripcion, valor, fecha_vencimiento, pagado, cliente_proveedor, forma_pago,
     tipo, cliente_id, categoria_id, cuenta_id)
  values ('Facturación de venta', v_total, coalesce(p_fecha_vencimiento, current_date),
          false, null, p_forma_pago, 'ingreso', v_cliente, p_categoria_id, p_cuenta_id)
  returning id_movimiento into v_mov;
  update ventas
     set facturado = true, lanzamiento_id = v_mov
   where id_venta = p_venta;
  return v_mov;
end $$;

-- ================= Financiero: marcar pago (RB-014) =========================

create or replace function public.mov_marcar_pagado(
  p_movimiento uuid, p_fecha_pago date default current_date
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.requerir_permiso('eMovimiento');
  update movimientos_financieros
     set pagado = true, fecha_pago = coalesce(p_fecha_pago, current_date)
   where id_movimiento = p_movimiento;
  if not found then
    raise exception 'Movimiento inexistente.';
  end if;
end $$;

-- ================= Auditoría: limpiar logs (RF-069) =========================

create or replace function public.limpiar_logs() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_borrados integer;
begin
  perform public.requerir_permiso('dAuditoria');
  -- auto-log previo: la limpieza se audita antes de borrar
  insert into logs_auditoria (usuario, tarea)
  values (coalesce((select nombre from usuarios
                     where id_usuario = public.usuario_actual()), 'system'),
          'limpiar logs_auditoria');
  select count(*) into v_borrados from logs_auditoria where tarea <> 'limpiar logs_auditoria';
  delete from logs_auditoria where tarea <> 'limpiar logs_auditoria';
  return v_borrados;
end $$;

-- ================= Sesiones (RNF-S-08; RB-032) ==============================

create or replace function public.sesion_registrar(
  p_tipo text, p_sujeto uuid, p_duracion_horas integer default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_horas integer;
  v_ip text;
begin
  if p_tipo not in ('administrador','cliente') then
    raise exception 'Tipo de sesión inválido.';
  end if;
  if p_tipo = 'administrador' then
    v_horas := coalesce(p_duracion_horas, 12);
  else
    v_horas := coalesce(p_duracion_horas, 24);
  end if;
  v_ip := coalesce(nullif(current_setting('request.headers', true), '')::jsonb
           ->> 'x-forwarded-for', null);
  insert into sesiones (usuario_id, cliente_id, tipo, expiracion, ip)
  values (case when p_tipo = 'administrador' then p_sujeto else null end,
          case when p_tipo = 'cliente' then p_sujeto else null end,
          p_tipo, now() + make_interval(hours => v_horas), v_ip)
  returning id_sesion into v_id;
  return v_id;
end $$;

create or replace function public.sesion_cerrar(p_sesion uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update sesiones set activa = false where id_sesion = p_sesion;
end $$;

create or replace function public.sesion_purgar() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n integer;
begin
  delete from sesiones
   where expiracion < now() or activa = false;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Permisos de ejecución (supabase no otorga anon por defecto, se explicita)
grant execute on function public.requerir_permiso(text)                  to authenticated;
grant execute on function public.ajustar_stock(uuid, numeric)            to authenticated;
grant execute on function public.orden_agregar_producto(uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.orden_cambiar_cantidad_producto(uuid, numeric) to authenticated;
grant execute on function public.orden_quitar_producto(uuid)             to authenticated;
grant execute on function public.venta_agregar_item(uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.venta_cambiar_cantidad_item(uuid, numeric) to authenticated;
grant execute on function public.venta_quitar_item(uuid)                 to authenticated;
grant execute on function public.orden_facturar(uuid, date, text, uuid, uuid) to authenticated;
grant execute on function public.venta_facturar(uuid, date, text, uuid, uuid) to authenticated;
grant execute on function public.mov_marcar_pagado(uuid, date)           to authenticated;
grant execute on function public.limpiar_logs()                          to authenticated;
grant execute on function public.sesion_registrar(text, uuid, integer)   to authenticated;
grant execute on function public.sesion_cerrar(uuid)                     to authenticated;
grant execute on function public.sesion_purgar()                         to authenticated;

-- ============================================================================
-- Fin de 0004_negocio.sql
-- ============================================================================

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

-- ============================================================================
-- Sistema Taller — Migración 0007: endurecimiento de ajustar_stock (H-1)
-- ============================================================================
-- Revoca la ejecución directa de ajustar_stock a roles no privilegiados.
-- La función sigue siendo SECURITY DEFINER y es invocada únicamente por las
-- RPC compuestas (orden_agregar_producto, venta_agregar_item, etc.), que ya
-- aplican sus propios controles de permiso. Así se cierra la vía de
-- modificación arbitraria de stock por JWT authenticated/cliente.
-- ============================================================================
revoke execute on function public.ajustar_stock(uuid, numeric) from public;
revoke execute on function public.ajustar_stock(uuid, numeric) from anon;
revoke execute on function public.ajustar_stock(uuid, numeric) from authenticated;
-- ============================================================================
-- Fin de 0007_hardening_ajustar_stock.sql
-- ============================================================================

-- ============================================================================
-- Sistema Taller — Migración 0008: config de stock válida e inmutabilidad de
-- ventas facturadas
-- ============================================================================

-- 1. Corregir nombre de GUC (PostgreSQL exige prefijo con punto para variables
--    personalizadas): app.permite_stock_write
create or replace function public.f_stock_no_directo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app.permite_stock_write', true), 'off') <> 'on' then
    raise exception 'El stock solo se actualiza mediante órdenes/ventas o ajuste de inventario.'
      using hint = 'stock_guard';
  end if;
  return new;
end $$;

create or replace function public.ajustar_stock(p_producto uuid, p_delta numeric)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_stock numeric(12,2);
begin
  perform public.requerir_permiso('eProducto');
  select stock into v_stock from productos where id_producto = p_producto
     for update;
  if v_stock is null then
    raise exception 'Producto inexistente.' using hint = 'producto_inexistente';
  end if;
  if v_stock + p_delta < 0 then
    raise exception 'Stock insuficiente para el producto seleccionado.'
      using hint = 'stock_insuficiente';
  end if;
  perform set_config('app.permite_stock_write', 'on', true);
  update productos set stock = stock + p_delta where id_producto = p_producto;
  perform set_config('app.permite_stock_write', 'off', true);
end $$;

revoke execute on function public.ajustar_stock(uuid, numeric) from public;
revoke execute on function public.ajustar_stock(uuid, numeric) from anon;
revoke execute on function public.ajustar_stock(uuid, numeric) from authenticated;
grant execute on function public.ajustar_stock(uuid, numeric) to authenticated;

-- 2. Bloquear modificaciones de líneas cuando la venta está facturada
create or replace function public.venta_agregar_item(
  p_venta uuid, p_producto uuid, p_cantidad numeric, p_precio numeric default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  v_descripcion text;
  v_precio numeric(12,2);
  v_facturado boolean;
begin
  select facturado into v_facturado from ventas where id_venta = p_venta;
  if v_facturado is true then
    raise exception 'La venta ya está facturada y no admite cambios en sus ítems.'
      using hint = 'venta_facturada_inmutable';
  end if;
  perform public.requerir_permiso('aVenta');
  if coalesce(p_cantidad, 0) <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;
  select descripcion, coalesce(p_precio, precio_venta) into v_descripcion, v_precio
    from productos where id_producto = p_producto;
  if v_descripcion is null then
    raise exception 'Producto inexistente.' using hint = 'producto_inexistente';
  end if;
  if not exists (select 1 from productos where id_producto = p_producto and salida) then
    raise exception 'El producto no está habilitado como salida (venta/orden).';
  end if;
  perform public.ajustar_stock(p_producto, -p_cantidad);
  insert into items_venta (venta_id, producto_id, cantidad, descripcion, precio, subtotal)
  values (p_venta, p_producto, p_cantidad, v_descripcion,
          round(v_precio, 2), round(p_cantidad * v_precio, 2))
  returning id_item_venta into v_id;
  return v_id;
end $$;

create or replace function public.venta_cambiar_cantidad_item(
  p_item uuid, p_cantidad numeric
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r items_venta%rowtype;
  v_facturado boolean;
begin
  select * into r from items_venta where id_item_venta = p_item;
  if r.id_item_venta is null then
    raise exception 'Item de venta inexistente.';
  end if;
  select facturado into v_facturado from ventas where id_venta = r.venta_id;
  if v_facturado is true then
    raise exception 'La venta ya está facturada y no admite cambios en sus ítems.'
      using hint = 'venta_facturada_inmutable';
  end if;
  perform public.requerir_permiso('eVenta');
  if coalesce(p_cantidad, 0) <= 0 then
    raise exception 'La cantidad debe ser mayor que cero.';
  end if;
  perform public.ajustar_stock(r.producto_id, r.cantidad - p_cantidad);
  update items_venta
     set cantidad = p_cantidad, subtotal = round(p_cantidad * precio, 2)
   where id_item_venta = p_item;
end $$;

create or replace function public.venta_quitar_item(p_item uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r items_venta%rowtype;
  v_facturado boolean;
begin
  select * into r from items_venta where id_item_venta = p_item;
  if r.id_item_venta is null then
    raise exception 'Item de venta inexistente.';
  end if;
  select facturado into v_facturado from ventas where id_venta = r.venta_id;
  if v_facturado is true then
    raise exception 'La venta ya está facturada y no admite cambios en sus ítems.'
      using hint = 'venta_facturada_inmutable';
  end if;
  perform public.requerir_permiso('eVenta');
  delete from items_venta where id_item_venta = p_item;
  perform public.ajustar_stock(r.producto_id, r.cantidad);
end $$;

-- 3. Bloquear edición de una venta ya facturada (salvo la propia transición)
create or replace function public.f_venta_facturada_inmutable() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.facturado and new is distinct from old then
    raise exception 'La venta ya está facturada y no puede modificarse.'
      using hint = 'venta_facturada_inmutable';
  end if;
  return new;
end $$;

drop trigger if exists tg_venta_facturada_inmutable on ventas;
create trigger tg_venta_facturada_inmutable
  before update on ventas
  for each row execute function public.f_venta_facturada_inmutable();

-- grants (reafirmar)
grant execute on function public.venta_agregar_item(uuid, uuid, numeric, numeric) to authenticated;
grant execute on function public.venta_cambiar_cantidad_item(uuid, numeric) to authenticated;
grant execute on function public.venta_quitar_item(uuid) to authenticated;
-- ============================================================================
-- Fin de 0008
-- ============================================================================

-- ============================================================================
-- Sistema Taller — Migración 0009: creación atómica de venta completa
-- ============================================================================
create or replace function public.venta_crear_completa(
  p_cliente uuid,
  p_usuario uuid,
  p_fecha date,
  p_descuento numeric,
  p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id uuid;
  item jsonb;
  v_producto uuid;
  v_cantidad numeric;
  v_precio numeric;
  v_descripcion text;
begin
  perform public.requerir_permiso('aVenta');
  insert into ventas (cliente_id, usuario_id, fecha_venta, descuento)
  values (p_cliente, p_usuario, coalesce(p_fecha, current_date), coalesce(p_descuento, 0))
  returning id_venta into v_id;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_producto := (item->>'id_producto')::uuid;
    v_cantidad := coalesce((item->>'cantidad')::numeric, 0);
    if v_cantidad <= 0 then
      raise exception 'La cantidad debe ser mayor que cero.';
    end if;
    select descripcion into v_descripcion
      from productos where id_producto = v_producto;
    if v_descripcion is null then
      raise exception 'Producto inexistente.' using hint = 'producto_inexistente';
    end if;
    if not exists (select 1 from productos where id_producto = v_producto and salida) then
      raise exception 'El producto no está habilitado como salida (venta/orden).';
    end if;
    v_precio := coalesce((item->>'precio')::numeric, (select precio_venta from productos where id_producto = v_producto));
    perform public.ajustar_stock(v_producto, -v_cantidad);
    insert into items_venta (venta_id, producto_id, cantidad, descripcion, precio, subtotal)
    values (v_id, v_producto, v_cantidad, v_descripcion,
            round(v_precio, 2), round(v_cantidad * v_precio, 2));
  end loop;

  return v_id;
end $$;

grant execute on function public.venta_crear_completa(uuid, uuid, date, numeric, jsonb) to authenticated;
-- ============================================================================
-- Fin de 0009
-- ============================================================================

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

-- ============================================================================
-- Sistema Taller — Migración 0011: restaurar ejecución de ajustar_stock con permiso
-- ============================================================================
create or replace function public.ajustar_stock(p_producto uuid, p_delta numeric)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_stock numeric(12,2);
begin
  perform public.requerir_permiso('eProducto');
  select stock into v_stock from productos where id_producto = p_producto
     for update;
  if v_stock is null then
    raise exception 'Producto inexistente.' using hint = 'producto_inexistente';
  end if;
  if v_stock + p_delta < 0 then
    raise exception 'Stock insuficiente para el producto seleccionado.'
      using hint = 'stock_insuficiente';
  end if;
  perform set_config('app.permite_stock_write', 'on', true);
  update productos set stock = stock + p_delta where id_producto = p_producto;
  perform set_config('app.permite_stock_write', 'off', true);
end $$;

grant execute on function public.ajustar_stock(uuid, numeric) to authenticated;
-- ============================================================================
-- Fin de 0011
-- ============================================================================

