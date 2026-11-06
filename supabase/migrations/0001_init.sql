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
