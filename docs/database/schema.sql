-- ============================================================================
-- Sistema Taller — Esquema canónico (TASK-0005 / AG-007)
-- ============================================================================
-- ARTÍCULO DE DISEÑO: este script NO se ejecuta en F2 (instrucción de tarea).
-- La tarea de implementación lo materializa como migraciones 0002…0008 según
-- ARCHITECTURE.md §15. Corrige los defectos de supabase/migrations/0001_init.sql:
--   D-01 (doble columna estado en usuarios) · D-03 (política anon暴露 clientes)
--   D-04 (sin sesiones/CHECK/FK) · E-09.
-- Fuente de verdad: docs/requirements/SOURCE_PROMPT.md (nombres en español).
-- Convenciones: DATA_MODEL.md §2. RLS: RLS_POLICIES.md.
-- Orden: 1 extensiones · 2 tablas · 3 FK retarding · 4 índices · 5 vistas ·
--        6 helpers RLS · 7 triggers · 8 RLS · 9 storage · 10 notas seed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensiones y zona horaria
-- ---------------------------------------------------------------------------
create extension if not exists "pg_trgm";
create extension if not exists "pgcrypto";

set timezone = 'America/Sao_Paulo';  -- E-06 (se fija en database settings en despliegue)

-- ---------------------------------------------------------------------------
-- 2. Tablas (23) — nombres SP literales; FK RESTRICT por defecto (RB-022),
--    CASCADE solo tablas línea sin identidad propia (DATA_MODEL.md §5).
-- ---------------------------------------------------------------------------

-- 2.1 Configuración de empresa (registro único: trigger en §7.1)
create table if not exists empresa (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  cnpj        text,
  ie          text,
  calle       text, numero text, barrio text, ciudad text, provincia text,
  telefono    text, correo text,
  url_logo    text
);

-- 2.2 Permisos (grupos; código da actividad SP §11 — jsonb array)
create table if not exists permisos (
  id_permiso uuid primary key default gen_random_uuid(),
  nombre     text not null,
  permisos   jsonb not null default '[]'::jsonb,
  estado     boolean not null default true,
  fecha      date not null default current_date
);

-- 2.3 Usuarios (perfile; identidad+hash en auth.users — ADR-017.3)
create table if not exists usuarios (
  id_usuario       uuid primary key default gen_random_uuid(),  -- = auth.users.id
  nombre           text not null,
  rg               text,
  cpf              text,
  calle            text, numero text, barrio text, ciudad text,
  estado           text,               -- región (dirección) — ADR-017.1
  correo           text not null unique,
  telefono         text, celular text,
  estado_usuario   boolean not null default true,   -- activo/inactivo — ADR-017.1
  fecha_registro   timestamptz not null default now(),
  permiso_id       uuid references permisos(id_permiso),
  fecha_expiracion date             -- RB-024
);

-- 2.4 Clientes (sujeto del portal: corre+documento — RB-012)
create table if not exists clientes (
  id_cliente      uuid primary key default gen_random_uuid(),
  nombre_cliente  text not null,
  sexo            text,
  persona_fisica  boolean not null default true,
  documento       text,
  telefono        text, celular text,
  correo          text,
  fecha_registro  timestamptz not null default now(),
  calle           text, numero text, barrio text, ciudad text,
  estado          text, codigo_postal text
);

-- 2.5 Marcas (sub-recurso Clientes/Órdenes — E-04)
create table if not exists marcas (
  id_marca        uuid primary key default gen_random_uuid(),
  marca           text not null,
  fecha_registro  timestamptz not null default now(),
  estado          boolean not null default true
);

-- 2.6 Equipos (sub-recurso Clientes/Órdenes — E-04)
create table if not exists equipos (
  id_equipo          uuid primary key default gen_random_uuid(),
  equipo             text not null,
  numero_serie       text, modelo text, color text, descripcion text,
  tension            text, potencia text, voltaje text,
  fecha_fabricacion  date,
  marca_id           uuid references marcas(id_marca),
  cliente_id         uuid references clientes(id_cliente)
);

-- 2.7 Productos
create table if not exists productos (
  id_producto    uuid primary key default gen_random_uuid(),
  descripcion    text not null,
  unidad         text,
  precio_compra  numeric(12,2) not null default 0,
  precio_venta   numeric(12,2) not null default 0,
  stock          numeric(12,2) not null default 0,
  stock_minimo   numeric(12,2) not null default 0,
  salida         boolean not null default false,
  entrada        boolean not null default false,
  constraint chk_producto_valores check (
    stock >= 0 and stock_minimo >= 0 and precio_compra >= 0 and precio_venta >= 0
  )                                   -- RB-008/020
);

-- 2.8 Servicios
create table if not exists servicios (
  id_servicio  uuid primary key default gen_random_uuid(),
  nombre       text not null,
  descripcion  text,
  precio       numeric(12,2) not null default 0,
  constraint chk_servicio_precio check (precio >= 0)
);

-- 2.9 Garantías (términos)
create table if not exists garantias (
  id_garantia     uuid primary key default gen_random_uuid(),
  fecha_garantia  date not null default current_date,
  referencia      text,
  texto_garantia  text,
  usuario_id      uuid references usuarios(id_usuario)
);

-- 2.10 Categorías financieras
create table if not exists categorias (
  id_categoria    uuid primary key default gen_random_uuid(),
  categoria       text not null,
  fecha_registro  timestamptz not null default now(),
  estado          boolean not null default true,
  tipo            text not null,
  constraint chk_categoria_tipo check (tipo in ('ingreso','egreso'))
);

-- 2.11 Cuentas
create table if not exists cuentas (
  id_cuenta       uuid primary key default gen_random_uuid(),
  cuenta          text not null,
  banco           text,
  numero          text,
  saldo           numeric(12,2) not null default 0,
  fecha_registro  timestamptz not null default now(),
  estado          boolean not null default true,
  tipo            text not null,
  constraint chk_cuenta_tipo check (tipo in ('ingreso','egreso'))  -- ídem TASK-0003 §7.1.6
);

-- 2.12 Órdenes de trabajo (lanzamiento_id y FK retarding: §3.9)
create table if not exists ordenes_trabajo (
  id_orden              uuid primary key default gen_random_uuid(),
  fecha_inicial         date not null default current_date,
  fecha_final           date,
  garantia              text,          -- condición declarada (E-07)
  descripcion_producto  text,
  defecto               text,
  estado                text not null default 'Presupuesto',
  observaciones         text,
  laudo_tecnico         text,
  valor_total           numeric(12,2) not null default 0,   -- controlado por trigger §7.4
  cliente_id            uuid references clientes(id_cliente),
  usuario_id            uuid references usuarios(id_usuario),
  lanzamiento_id        uuid,          -- FK en §3.9 (movimientos_financieros)
  facturado             boolean not null default false,
  garantia_id           uuid references garantias(id_garantia),
  constraint chk_orden_estado check (estado in (
    'Presupuesto','Abierta','En Proceso','Finalizado','Cancelado','Aguardando Piezas'
  )),                                   -- RB-010 (SP literal)
  constraint chk_orden_fechas check ((fecha_final is null) or (fecha_final >= fecha_inicial)),
  constraint chk_orden_valor check (valor_total >= 0),
  constraint chk_orden_facturada check ((lanzamiento_id is null) or facturado)  -- RB-003/027
);

-- 2.13 Líneas de producto de la orden (snapshot RB-021; stock vía RPC TASK-0004)
create table if not exists productos_orden (
  id_producto_orden  uuid primary key default gen_random_uuid(),
  cantidad           numeric(12,2) not null default 1,
  descripcion        text,
  precio             numeric(12,2) not null default 0,
  orden_id           uuid not null references ordenes_trabajo(id_orden) on delete cascade,
  producto_id        uuid references productos(id_producto),
  subtotal           numeric(12,2) not null default 0,
  constraint chk_po_valores check (cantidad > 0 and precio >= 0 and subtotal >= 0)  -- RB-019
);

-- 2.14 Líneas de servicio de la orden (sin stock)
create table if not exists servicios_orden (
  id_servicio_orden  uuid primary key default gen_random_uuid(),
  servicio           text,               -- snapshot del nombre (RB-021)
  cantidad           numeric(12,2) not null default 1,
  precio             numeric(12,2) not null default 0,
  orden_id           uuid not null references ordenes_trabajo(id_orden) on delete cascade,
  servicio_id        uuid references servicios(id_servicio) on delete set null,
  subtotal           numeric(12,2) not null default 0,
  constraint chk_so_valores check (cantidad > 0 and precio >= 0 and subtotal >= 0)
);

-- 2.15 Ventas (FK retarding lanzamiento_id: §3.9)
create table if not exists ventas (
  id_venta        uuid primary key default gen_random_uuid(),
  fecha_venta     date not null default current_date,
  valor_total     numeric(12,2) not null default 0,       -- Σ items − descuento (RB-019)
  descuento       numeric(12,2) not null default 0,
  facturado       boolean not null default false,
  cliente_id      uuid references clientes(id_cliente),
  usuario_id      uuid references usuarios(id_usuario),
  lanzamiento_id  uuid,                                    -- FK en §3.9
  constraint chk_venta_valores check (descuento >= 0 and valor_total >= 0),
  constraint chk_venta_facturada check ((lanzamiento_id is null) or facturado)  -- RB-004/027
);

-- 2.16 Líneas de venta (también descontar stock vía RPC)
create table if not exists items_venta (
  id_item_venta  uuid primary key default gen_random_uuid(),
  cantidad       numeric(12,2) not null default 1,
  descripcion    text,
  precio         numeric(12,2) not null default 0,
  venta_id       uuid not null references ventas(id_venta) on delete cascade,
  producto_id    uuid references productos(id_producto) on delete set null,
  subtotal       numeric(12,2) not null default 0,
  constraint chk_iv_valores check (cantidad > 0 and precio >= 0 and subtotal >= 0)
);

-- 2.17 Movimientos financieros (FK venta_id retarding: §3.9)
create table if not exists movimientos_financieros (
  id_movimiento       uuid primary key default gen_random_uuid(),
  descripcion         text not null,
  valor               numeric(12,2) not null default 0,
  fecha_vencimiento   date,
  fecha_pago          date,
  pagado              boolean not null default false,
  cliente_proveedor   text,
  forma_pago          text,
  tipo                text not null,
  anexo               text,
  cliente_id          uuid references clientes(id_cliente),
  categoria_id        uuid references categorias(id_categoria),
  cuenta_id           uuid references cuentas(id_cuenta),
  venta_id            uuid,
  constraint chk_mov_tipo check (tipo in ('ingreso','egreso')),
  constraint chk_mov_valor check (valor > 0),
  constraint chk_mov_pago check ((pagado = false) or (fecha_pago is not null))  -- RB-014
);

-- 2.18 Anexos (adjuntos de orden; ruta autoritativa — ADR-013)
create table if not exists anexos (
  id_anexo   uuid primary key default gen_random_uuid(),
  anexo      text not null,
  miniatura  text,
  url        text,         -- URL firmada temporal; NUNCA autoritativa
  ruta       text not null, -- bucket/ruta Storage (autoritativa)
  orden_id   uuid not null references ordenes_trabajo(id_orden) on delete cascade
);

-- 2.19 Documentos (Archivos/Documentos)
create table if not exists documentos (
  id_documento    uuid primary key default gen_random_uuid(),
  documento       text not null,
  descripcion     text,
  archivo         text,
  ruta            text,
  url             text,
  fecha_registro  timestamptz not null default now(),
  categoria       text,          -- texto con sugerencias DISTINCT (E-04)
  tipo            text,
  tamanio         bigint         -- SP «tamaño» — ADR-017.2
);

-- 2.20 Equipos por orden (equipo(s) intervenido(s))
create table if not exists equipos_orden (
  id_equipo_orden      uuid primary key default gen_random_uuid(),
  defecto_declarado    text,
  defecto_encontrado   text,
  solucion             text,
  equipo_id            uuid references equipos(id_equipo),
  orden_id             uuid not null references ordenes_trabajo(id_orden) on delete cascade
);

-- 2.21 Auditoría (SP literal: usuario, tarea, fecha, hora, ip)
create table if not exists logs_auditoria (
  id_log   uuid primary key default gen_random_uuid(),
  usuario  text,
  tarea    text,
  fecha    date not null default current_date,
  hora     time not null default current_time,
  ip       text
);

-- 2.22 Cola de emails (4 estados SP literales — RB-015)
create table if not exists cola_emails (
  id           uuid primary key default gen_random_uuid(),
  para         text not null,
  cc           text,
  cco          text,
  mensaje      text,
  estado       text not null default 'pendiente',
  fecha        timestamptz not null default now(),
  encabezados  text,          -- JSON serializado: asunto/intentos/ultimo_error
  constraint chk_email_estado check (estado in ('pendiente','enviando','enviado','fallido'))
);

-- 2.23 Sesiones (SP «sesiones»; materializa las sesiones de Auth — ADR E-08)
create table if not exists sesiones (
  id_sesion      uuid primary key default gen_random_uuid(),  -- id de la sesión de Auth
  usuario_id     uuid references usuarios(id_usuario) on delete cascade,
  cliente_id     uuid references clientes(id_cliente) on delete cascade,
  tipo           text not null,
  inicio_sesion  timestamptz not null default now(),
  expiracion     timestamptz not null,       -- 12 h admin / 24 h cliente (RNF-S-08)
  ip             text,
  activa         boolean not null default true,
  constraint chk_sesion_tipo check (tipo in ('administrador','cliente')),       -- RB-032
  constraint chk_sesion_sujeto check (num_nonnulls(usuario_id, cliente_id) = 1)
);

comment on column anexos.ruta is 'Ruta Storage bucket/objeto (autoritativa; url es firma temporal)';

-- ---------------------------------------------------------------------------
-- 3. FK retardadas (ciclos ventas ↔ movimientos_financieros y orden ↔ mov)
-- ---------------------------------------------------------------------------
alter table movimientos_financieros
  add constraint fk_mov_venta foreign key (venta_id) references ventas(id_venta);

alter table ventas
  add constraint fk_venta_lanzamiento foreign key (lanzamiento_id)
    references movimientos_financieros(id_movimiento);

alter table ordenes_trabajo
  add constraint fk_orden_lanzamiento foreign key (lanzamiento_id)
    references movimientos_financieros(id_movimiento);

-- Un solo vínculo de facturación por documento (RB-003/004/027)
create unique index if not exists uq_orden_lanzamiento
  on ordenes_trabajo (lanzamiento_id) where lanzamiento_id is not null;
create unique index if not exists uq_venta_lanzamiento
  on ventas (lanzamiento_id) where lanzamiento_id is not null;
create unique index if not exists uq_mov_venta
  on movimientos_financieros (venta_id) where venta_id is not null;

-- ---------------------------------------------------------------------------
-- 4. Índices (búsqueda, filtros, paginación, autocompletado — DATA_MODEL §8)
-- ---------------------------------------------------------------------------
create index if not exists idx_clientes_nombre    on clientes (lower(nombre_cliente) text_pattern_ops);
create index if not exists idx_clientes_documento on clientes (documento);
create index if not exists idx_clientes_correo    on clientes (lower(correo) text_pattern_ops);
create index if not exists idx_clientes_registro  on clientes (fecha_registro desc);

create unique index if not exists uq_clientes_documento
  on clientes (documento) where documento is not null;
create unique index if not exists uq_clientes_portal_par
  on clientes (lower(correo), documento) where correo is not null and documento is not null;

create index if not exists idx_usuarios_registro on usuarios (fecha_registro desc);
create unique index if not exists uq_usuarios_cpf on usuarios (cpf) where cpf is not null;

create index if not exists idx_productos_desc on productos (lower(descripcion) text_pattern_ops);
create index if not exists idx_servicios_nom  on servicios (lower(nombre) text_pattern_ops);
create index if not exists idx_marcas_nom     on marcas (lower(marca) text_pattern_ops);
create index if not exists idx_garantias_ref  on garantias (lower(referencia) text_pattern_ops);
create index if not exists idx_garantias_fecha on garantias (fecha_garantia desc);

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

create index if not exists idx_doc_doc      on documentos (lower(documento) text_pattern_ops);
create index if not exists idx_doc_categoria on documentos (categoria);
create index if not exists idx_doc_fecha    on documentos (fecha_registro desc);

create index if not exists idx_logs_fecha on logs_auditoria (fecha desc, hora desc);
create index if not exists idx_logs_user  on logs_auditoria (usuario);

create index if not exists idx_email_estado on cola_emails (estado);
create index if not exists idx_email_fecha  on cola_emails (fecha desc);

create index if not exists idx_sesiones_user    on sesiones (usuario_id);
create index if not exists idx_sesiones_cli     on sesiones (cliente_id);
create index if not exists idx_sesiones_activa  on sesiones (activa);
create index if not exists idx_sesiones_vence   on sesiones (expiracion);

-- ---------------------------------------------------------------------------
-- 5. Vistas (security_invoker ⇒ heredan RLS)
-- ---------------------------------------------------------------------------
create view if not exists v_stock_alerta with (security_invoker = true) as
  select id_producto, descripcion, unidad, stock, stock_minimo,
         (stock_minimo - stock) as faltante
  from productos
  where stock < stock_minimo;                    -- RF-016/RF-007

create view if not exists v_movimientos_situacion with (security_invoker = true) as
  select m.*,
         (m.pagado = false and m.fecha_vencimiento < current_date) as vencido,   -- RB-025
         case
           when m.pagado then 'realizado'
           when m.fecha_vencimiento < current_date  then 'atrasado'
           when m.fecha_vencimiento > current_date  then 'previsto'
           else 'pendiente'  -- vence hoy (filtro «pendiente» broader: pagado=false)
         end as situacion                                                       -- RB-026
  from movimientos_financieros m;

create view if not exists v_cliente_vinculos with (security_invoker = true) as
  select c.id_cliente,
         (select count(*) from ordenes_trabajo o where o.cliente_id = c.id_cliente)      as ordenes,
         (select count(*) from ventas v where v.cliente_id = c.id_cliente)               as ventas,
         (select count(*) from movimientos_financieros mf where mf.cliente_id = c.id_cliente) as movimientos,
         (select count(*) from equipos eq where eq.cliente_id = c.id_cliente)            as equipos
  from clientes c;                                 -- RF-013 / RB-022

-- ---------------------------------------------------------------------------
-- 6. Helpers RLS (SECURITY DEFINER ⇒ leen usuarios/permisos sin recurrir RLS)
-- ---------------------------------------------------------------------------
create or replace function public.jwt_app_metadata()
returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata',
    '{}'::jsonb
  );
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

-- claim primero (O(1)); fallback tabla si el claim no trae 'permisos' (RNF-P-01)
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
      and u.estado_usuario is true                                  -- RB-023
      and p.estado is true                                          -- RB-023
      and (u.fecha_expiracion is null or u.fecha_expiracion >= current_date)  -- RB-024
      and p.permisos ? p_codigo
  );
end;
$$;

-- propiedad del portal (definer para EXISTS sin recursión de RLS)
create or replace function public.es_cliente_duenio_orden(p_orden uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_orden is not null and exists (
    select 1 from ordenes_trabajo o
    where o.id_orden = p_orden and o.cliente_id = public.cliente_actual()
  );
$$;

create or replace function public.es_cliente_duenio_venta(p_venta uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select p_venta is not null and exists (
    select 1 from ventas v
    where v.id_venta = p_venta and v.cliente_id = public.cliente_actual()
  );
$$;

revoke all on function public.jwt_app_metadata() from public, anon;

-- ---------------------------------------------------------------------------
-- 7. Triggers del modelo (invariantes; RPC compuestas → TASK-0004)
-- ---------------------------------------------------------------------------

-- 7.1 Empresa única (RB-030)
create or replace function public.f_empresa_unica() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from empresa where id <> new.id) then
    raise exception 'La empresa ya está registrada: edite los datos existentes (solo un registro).'
      using hint = 'empresa_unica';
  end if;
  return new;
end;
$$;
drop trigger if exists tg_empresa_unica on empresa;
create trigger tg_empresa_unica
  before insert or update on empresa
  for each row execute function public.f_empresa_unica();

-- 7.2 Portal no cambia credenciales (E-05 / RF-079)
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
end;
$$;
drop trigger if exists tg_cliente_no_credenciales on clientes;
create trigger tg_cliente_no_credenciales
  before update on clientes
  for each row execute function public.f_cliente_no_credenciales();

-- 7.3 Guard de stock: solo RPC/ajuste de catálogo toca productos.stock (RB-002/017/020)
create or replace function public.f_stock_no_directo() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app_permite_stock_write', true), 'off') <> 'on' then
    raise exception 'El stock solo se actualiza mediante órdenes/ventas o ajuste de inventario.'
      using hint = 'stock_guard';
  end if;
  return new;
end;
$$;
drop trigger if exists tg_stock_no_directo on productos;
create trigger tg_stock_no_directo
  before update on productos
  for each row execute function public.f_stock_no_directo();

-- 7.4 Recálculo de totales (RB-018/019)
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
end;
$$;
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
end;
$$;
drop trigger if exists tg_recalcular_total_compra on items_venta;
create trigger tg_recalcular_total_compra
  after insert or update or delete on items_venta
  for each row execute function public.f_recalcular_total_venta();

-- update de descuento también recalcula
create or replace function public.f_recalcular_total_venta_upd() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.valor_total := (
    (select coalesce(sum(subtotal), 0) from items_venta i where i.venta_id = new.id_venta)
    - new.descuento
  );
  return new;
end;
$$;
drop trigger if exists tg_recalcular_total_descuento on ventas;
create trigger tg_recalcular_total_descuento
  before update of descuento on ventas
  for each row execute function public.f_recalcular_total_venta_upd();

-- 7.5 Fecha final al finalizar (RF-021)
create or replace function public.f_orden_fecha_final() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.estado = 'Finalizado' and new.fecha_final is null then
    new.fecha_final := current_date;
  end if;
  return new;
end;
$$;
drop trigger if exists tg_orden_fecha_final on ordenes_trabajo;
create trigger tg_orden_fecha_final
  before update of estado on ordenes_trabajo
  for each row execute function public.f_orden_fecha_final();

-- 7.6 Auditoría genérica (RB-009/028 — lista cerrada TASK-0003 §9.3)
create or replace function public.f_auditar() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_op text := case tg_op when 'INSERT' then 'agregar'
                          when 'UPDATE' then 'editar' else 'eliminar' end;
  v_ip text;
  v_user text;
begin
  select coalesce(nullif(current_setting('request.headers', true), '')::jsonb
           ->> 'x-forwarded-for', null)
    into v_ip;
  select coalesce(u.nombre, 'system')
    from usuarios u
   where u.id_usuario = public.usuario_actual()
    into v_user;
  insert into logs_auditoria (usuario, tarea, ip)
  values (coalesce(v_user, 'system'),
          v_op || ' ' || tg_table_name, v_ip);
  return null;
end;
$$;
do $$
declare
  t text;
begin
  foreach t in array array['clientes','productos','servicios','garantias',
                           'movimientos_financieros','documentos','usuarios',
                           'permisos','empresa','ventas','ordenes_trabajo',
                           'categorias','cuentas','marcas','equipos'] loop
    execute format('drop trigger if exists tg_auditar on %I', t);
    execute format(
      'create trigger tg_auditar after insert or update or delete on %I
         for each row execute function public.f_auditar()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. RLS — 23/23 tablas (RB-031). Detalle y matriz: RLS_POLICIES.md.
--    Plantilla: admin = es_administrador() AND tiene_permiso(código);
--    portal (donde aplica): es_cliente() AND propiedad (RB-032).
--    Ninguna política para anon (corrige D-03).
-- ---------------------------------------------------------------------------
alter table empresa                enable row level security;
alter table permisos               enable row level security;
alter table usuarios               enable row level security;
alter table clientes               enable row level security;
alter table marcas                 enable row level security;
alter table equipos                enable row level security;
alter table productos              enable row level security;
alter table servicios              enable row level security;
alter table garantias              enable row level security;
alter table categorias             enable row level security;
alter table cuentas                enable row level security;
alter table ordenes_trabajo        enable row level security;
alter table productos_orden        enable row level security;
alter table servicios_orden        enable row level security;
alter table equipos_orden          enable row level security;
alter table anexos                 enable row level security;
alter table ventas                 enable row level security;
alter table items_venta            enable row level security;
alter table movimientos_financieros enable row level security;
alter table documentos             enable row level security;
alter table logs_auditoria         enable row level security;
alter table cola_emails            enable row level security;
alter table sesiones               enable row level security;

-- (drop defensivo de las políticas permissivas del prototipo 0001_init.sql)
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;
end;
$$;

-- --- clientes (portal: lee/edita SOLO su fila) ---
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

-- --- productos / servicios: admin CRUD ---
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

-- --- marcas y equipos: sub-recursos de Clientes/Órdenes (E-04) ---
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

-- --- ordenes_trabajo (portal lee solo sus órdenes) ---
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

-- --- tablas línea de la orden (portal select si el padre es suyo) ---
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

-- --- garantías (el portal ve la garantía de su orden — impresión E-07) ---
create policy garantias_sel on garantias for select to authenticated using (
  (es_administrador() and tiene_permiso('vGarantia'))
  or (es_cliente() and exists (
        select 1 from ordenes_trabajo o
        where o.garantia_id = garantias.id_garantia
          and o.cliente_id = cliente_actual()
     ))
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

-- --- logs_auditoria: lectura/borrado con código; escritura SOLO definer/system ---
create policy logs_sel on logs_auditoria for select to authenticated
  using (es_administrador() and tiene_permiso('vAuditoria'));
create policy logs_del on logs_auditoria for delete to authenticated
  using (es_administrador() and tiene_permiso('dAuditoria'));

-- --- cola_emails: lectura/reintento/borrado con código; escritura por servicio ---
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

-- --- sesiones: propia + admin vUsuario (escritura solo definer/EF) ---
create policy ses_sel on sesiones for select to authenticated using (
  (es_administrador() and (tiene_permiso('vUsuario') or usuario_id = usuario_actual()))
  or (es_cliente() and cliente_id = cliente_actual())
);

-- ---------------------------------------------------------------------------
-- 9. Storage buckets + políticas (ADR-013; detalle en RLS_POLICIES.md §6)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('anexos-orden', 'anexos-orden', false),
       ('documentos',   'documentos', false),
       ('comprobantes', 'comprobantes', false),
       ('logos',        'logos', true)
on conflict (id) do nothing;

-- lectura de logo para PDFs del portal/panel
create policy "logos leer" on storage.objects for select to authenticated
  using (bucket_id = 'logos');
-- escritura de logo: solo admin con c/e Empresa
create policy "logos escribir" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and es_administrador()
              and (tiene_permiso('cEmpresa') or tiene_permiso('eEmpresa')));

-- privados: descarga con v-código; subida con a-código
create policy "anexos-orden leer" on storage.objects for select to authenticated
  using (bucket_id = 'anexos-orden' and es_administrador() and tiene_permiso('vOrden'));
create policy "anexos-orden subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos-orden' and es_administrador() and tiene_permiso('aOrden'));

create policy "documentos leer" on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and es_administrador() and tiene_permiso('vArchivo'));
create policy "documentos subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and es_administrador() and tiene_permiso('aArchivo'));

create policy "comprobantes leer" on storage.objects for select to authenticated
  using (bucket_id = 'comprobantes' and es_administrador() and tiene_permiso('vMovimiento'));
create policy "comprobantes subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'comprobantes' and es_administrador() and tiene_permiso('aMovimiento'));

-- ---------------------------------------------------------------------------
-- 10. Notas para TASK-0004 (no ejecutar en F2)
-- ---------------------------------------------------------------------------
-- * Este diseño se reparte en migraciones (ARCHITECTURE.md §15):
--     0002_schema_fixes.sql → §2–§4 (correcciones sobre 0001_init.sql)
--     0003_sesiones.sql     → §2.23 + §8 sesión policies
--     0004_rls.sql          → §6 helpers + §8 políticas completas
--     0006_consultas.sql    → §5 vistas (+ RPC de consultas/panel/reportes)
--     0005_business_logic.sql → RPC compuestas (stock/facturar/auditar/cola)
--     0007_storage.sql      → §9
--     0008_seed_support.sql → seed idempotente RB-001
-- * rpc pendientes (no en este archivo): auth_perfil, orden/venta_*_facturar,
--   orden_agregar/quitar_producto, venta_agregar/quitar_item, limpiar_logs,
--   cola_encolar_email, mov_marcar_pagado, etc.
--   → son entregable de la tarea de implementación (TASK-0004).
-- * pruebas pgTAP por tabla/rol (RNF-S-02) y propiedades de stock/total → supabase/tests.
-- ============================================================================
-- fin del diseño canónico — no aplicar sin revisión de AG-004/AG-005
-- ============================================================================
