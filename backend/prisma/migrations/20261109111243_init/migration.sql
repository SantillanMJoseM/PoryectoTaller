-- CreateTable
CREATE TABLE "empresa" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "cnpj" TEXT,
    "ie" TEXT,
    "calle" TEXT,
    "numero" TEXT,
    "barrio" TEXT,
    "ciudad" TEXT,
    "provincia" TEXT,
    "telefono" TEXT,
    "correo" TEXT,
    "url_logo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permisos" (
    "id_permiso" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "permisos" JSONB NOT NULL DEFAULT '[]',
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "fecha" DATE NOT NULL DEFAULT current_date,

    CONSTRAINT "permisos_pkey" PRIMARY KEY ("id_permiso")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id_usuario" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "rg" TEXT,
    "cpf" TEXT,
    "calle" TEXT,
    "numero" TEXT,
    "barrio" TEXT,
    "ciudad" TEXT,
    "correo" TEXT NOT NULL,
    "telefono" TEXT,
    "celular" TEXT,
    "estado_usuario" BOOLEAN NOT NULL DEFAULT true,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "permiso_id" UUID,
    "fecha_expiracion" DATE,
    "estado" TEXT,
    "debe_cambiar_contrasena" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id_cliente" UUID NOT NULL,
    "nombre_cliente" TEXT NOT NULL,
    "sexo" TEXT,
    "persona_fisica" BOOLEAN NOT NULL DEFAULT true,
    "documento" TEXT,
    "telefono" TEXT,
    "celular" TEXT,
    "correo" TEXT,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calle" TEXT,
    "numero" TEXT,
    "barrio" TEXT,
    "ciudad" TEXT,
    "estado" TEXT,
    "codigo_postal" TEXT,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "marcas" (
    "id_marca" UUID NOT NULL,
    "marca" TEXT NOT NULL,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "marcas_pkey" PRIMARY KEY ("id_marca")
);

-- CreateTable
CREATE TABLE "equipos" (
    "id_equipo" UUID NOT NULL,
    "equipo" TEXT NOT NULL,
    "numero_serie" TEXT,
    "modelo" TEXT,
    "color" TEXT,
    "descripcion" TEXT,
    "tension" TEXT,
    "potencia" TEXT,
    "voltaje" TEXT,
    "fecha_fabricacion" DATE,
    "marca_id" UUID,
    "cliente_id" UUID,

    CONSTRAINT "equipos_pkey" PRIMARY KEY ("id_equipo")
);

-- CreateTable
CREATE TABLE "productos" (
    "id_producto" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "unidad" TEXT,
    "precio_compra" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "precio_venta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stock_minimo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "salida" BOOLEAN NOT NULL DEFAULT false,
    "entrada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id_producto")
);

-- CreateTable
CREATE TABLE "servicios" (
    "id_servicio" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id_servicio")
);

-- CreateTable
CREATE TABLE "garantias" (
    "id_garantia" UUID NOT NULL,
    "fecha_garantia" DATE NOT NULL DEFAULT current_date,
    "referencia" TEXT,
    "texto_garantia" TEXT,
    "usuario_id" UUID,

    CONSTRAINT "garantias_pkey" PRIMARY KEY ("id_garantia")
);

-- CreateTable
CREATE TABLE "categorias" (
    "id_categoria" UUID NOT NULL,
    "categoria" TEXT,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "categorias_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "cuentas" (
    "id_cuenta" UUID NOT NULL,
    "cuenta" TEXT,
    "banco" TEXT,
    "numero" TEXT,
    "saldo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" BOOLEAN NOT NULL DEFAULT true,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "cuentas_pkey" PRIMARY KEY ("id_cuenta")
);

-- CreateTable
CREATE TABLE "ordenes_trabajo" (
    "id_orden" UUID NOT NULL,
    "fecha_inicial" DATE NOT NULL DEFAULT current_date,
    "fecha_final" DATE,
    "garantia" TEXT,
    "descripcion_producto" TEXT,
    "defecto" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Presupuesto',
    "observaciones" TEXT,
    "laudo_tecnico" TEXT,
    "valor_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cliente_id" UUID,
    "usuario_id" UUID,
    "lanzamiento_id" UUID,
    "facturado" BOOLEAN NOT NULL DEFAULT false,
    "garantia_id" UUID,

    CONSTRAINT "ordenes_trabajo_pkey" PRIMARY KEY ("id_orden")
);

-- CreateTable
CREATE TABLE "productos_orden" (
    "id_producto_orden" UUID NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "descripcion" TEXT,
    "precio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "orden_id" UUID NOT NULL,
    "producto_id" UUID,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "productos_orden_pkey" PRIMARY KEY ("id_producto_orden")
);

-- CreateTable
CREATE TABLE "servicios_orden" (
    "id_servicio_orden" UUID NOT NULL,
    "servicio" TEXT,
    "cantidad" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "precio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "orden_id" UUID NOT NULL,
    "servicio_id" UUID,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "servicios_orden_pkey" PRIMARY KEY ("id_servicio_orden")
);

-- CreateTable
CREATE TABLE "equipos_orden" (
    "id_equipo_orden" UUID NOT NULL,
    "defecto_declarado" TEXT,
    "defecto_encontrado" TEXT,
    "solucion" TEXT,
    "equipo_id" UUID,
    "orden_id" UUID NOT NULL,

    CONSTRAINT "equipos_orden_pkey" PRIMARY KEY ("id_equipo_orden")
);

-- CreateTable
CREATE TABLE "anexos" (
    "id_anexo" UUID NOT NULL,
    "anexo" TEXT NOT NULL,
    "miniatura" TEXT,
    "url" TEXT,
    "ruta" TEXT NOT NULL,
    "orden_id" UUID NOT NULL,

    CONSTRAINT "anexos_pkey" PRIMARY KEY ("id_anexo")
);

-- CreateTable
CREATE TABLE "ventas" (
    "id_venta" UUID NOT NULL,
    "fecha_venta" DATE NOT NULL DEFAULT current_date,
    "valor_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "facturado" BOOLEAN NOT NULL DEFAULT false,
    "cliente_id" UUID,
    "usuario_id" UUID,
    "lanzamiento_id" UUID,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id_venta")
);

-- CreateTable
CREATE TABLE "items_venta" (
    "id_item_venta" UUID NOT NULL,
    "cantidad" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "descripcion" TEXT,
    "precio" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "venta_id" UUID NOT NULL,
    "producto_id" UUID,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "items_venta_pkey" PRIMARY KEY ("id_item_venta")
);

-- CreateTable
CREATE TABLE "movimientos_financieros" (
    "id_movimiento" UUID NOT NULL,
    "descripcion" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fecha_vencimiento" DATE,
    "fecha_pago" DATE,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "cliente_proveedor" TEXT,
    "forma_pago" TEXT,
    "tipo" TEXT NOT NULL,
    "anexo" TEXT,
    "cliente_id" UUID,
    "categoria_id" UUID,
    "cuenta_id" UUID,
    "venta_id" UUID,

    CONSTRAINT "movimientos_financieros_pkey" PRIMARY KEY ("id_movimiento")
);

-- CreateTable
CREATE TABLE "documentos" (
    "id_documento" UUID NOT NULL,
    "documento" TEXT NOT NULL,
    "descripcion" TEXT,
    "archivo" TEXT,
    "ruta" TEXT,
    "url" TEXT,
    "fecha_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoria" TEXT,
    "tipo" TEXT,
    "tamanio" BIGINT,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id_documento")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id_log" UUID NOT NULL,
    "usuario" TEXT,
    "tarea" TEXT,
    "fecha" DATE NOT NULL DEFAULT current_date,
    "hora" TIME(6) NOT NULL DEFAULT current_time,
    "ip" TEXT,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id_log")
);

-- CreateTable
CREATE TABLE "cola_emails" (
    "id" UUID NOT NULL,
    "para" TEXT NOT NULL,
    "cc" TEXT,
    "cco" TEXT,
    "mensaje" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encabezados" TEXT,

    CONSTRAINT "cola_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesiones" (
    "id_sesion" UUID NOT NULL,
    "usuario_id" UUID,
    "cliente_id" UUID,
    "tipo" TEXT NOT NULL,
    "inicio_sesion" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiracion" TIMESTAMPTZ(6) NOT NULL,
    "ip" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sesiones_pkey" PRIMARY KEY ("id_sesion")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_cpf_key" ON "usuarios"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_documento_key" ON "clientes"("documento");

-- CreateIndex
CREATE INDEX "clientes_correo_documento_idx" ON "clientes"("correo", "documento");

-- CreateIndex
CREATE INDEX "equipos_cliente_id_idx" ON "equipos"("cliente_id");

-- CreateIndex
CREATE INDEX "equipos_marca_id_idx" ON "equipos"("marca_id");

-- CreateIndex
CREATE UNIQUE INDEX "ordenes_trabajo_lanzamiento_id_key" ON "ordenes_trabajo"("lanzamiento_id");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_estado_idx" ON "ordenes_trabajo"("estado");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_cliente_id_idx" ON "ordenes_trabajo"("cliente_id");

-- CreateIndex
CREATE INDEX "ordenes_trabajo_usuario_id_idx" ON "ordenes_trabajo"("usuario_id");

-- CreateIndex
CREATE INDEX "productos_orden_orden_id_idx" ON "productos_orden"("orden_id");

-- CreateIndex
CREATE INDEX "productos_orden_producto_id_idx" ON "productos_orden"("producto_id");

-- CreateIndex
CREATE INDEX "servicios_orden_orden_id_idx" ON "servicios_orden"("orden_id");

-- CreateIndex
CREATE INDEX "servicios_orden_servicio_id_idx" ON "servicios_orden"("servicio_id");

-- CreateIndex
CREATE INDEX "equipos_orden_orden_id_idx" ON "equipos_orden"("orden_id");

-- CreateIndex
CREATE INDEX "equipos_orden_equipo_id_idx" ON "equipos_orden"("equipo_id");

-- CreateIndex
CREATE INDEX "anexos_orden_id_idx" ON "anexos"("orden_id");

-- CreateIndex
CREATE UNIQUE INDEX "ventas_lanzamiento_id_key" ON "ventas"("lanzamiento_id");

-- CreateIndex
CREATE INDEX "ventas_fecha_venta_idx" ON "ventas"("fecha_venta");

-- CreateIndex
CREATE INDEX "ventas_cliente_id_idx" ON "ventas"("cliente_id");

-- CreateIndex
CREATE INDEX "items_venta_venta_id_idx" ON "items_venta"("venta_id");

-- CreateIndex
CREATE INDEX "items_venta_producto_id_idx" ON "items_venta"("producto_id");

-- CreateIndex
CREATE UNIQUE INDEX "movimientos_financieros_venta_id_key" ON "movimientos_financieros"("venta_id");

-- CreateIndex
CREATE INDEX "movimientos_financieros_fecha_vencimiento_idx" ON "movimientos_financieros"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "movimientos_financieros_pagado_idx" ON "movimientos_financieros"("pagado");

-- CreateIndex
CREATE INDEX "movimientos_financieros_tipo_idx" ON "movimientos_financieros"("tipo");

-- CreateIndex
CREATE INDEX "movimientos_financieros_cliente_id_idx" ON "movimientos_financieros"("cliente_id");

-- CreateIndex
CREATE INDEX "sesiones_usuario_id_idx" ON "sesiones"("usuario_id");

-- CreateIndex
CREATE INDEX "sesiones_cliente_id_idx" ON "sesiones"("cliente_id");

-- CreateIndex
CREATE INDEX "sesiones_activa_idx" ON "sesiones"("activa");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permisos"("id_permiso") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_marca_id_fkey" FOREIGN KEY ("marca_id") REFERENCES "marcas"("id_marca") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garantias" ADD CONSTRAINT "garantias_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_garantia_id_fkey" FOREIGN KEY ("garantia_id") REFERENCES "garantias"("id_garantia") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordenes_trabajo" ADD CONSTRAINT "ordenes_trabajo_lanzamiento_id_fkey" FOREIGN KEY ("lanzamiento_id") REFERENCES "movimientos_financieros"("id_movimiento") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_orden" ADD CONSTRAINT "productos_orden_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_trabajo"("id_orden") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_orden" ADD CONSTRAINT "productos_orden_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id_producto") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_orden" ADD CONSTRAINT "servicios_orden_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_trabajo"("id_orden") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "servicios_orden" ADD CONSTRAINT "servicios_orden_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id_servicio") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos_orden" ADD CONSTRAINT "equipos_orden_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id_equipo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos_orden" ADD CONSTRAINT "equipos_orden_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_trabajo"("id_orden") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "anexos" ADD CONSTRAINT "anexos_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "ordenes_trabajo"("id_orden") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_lanzamiento_id_fkey" FOREIGN KEY ("lanzamiento_id") REFERENCES "movimientos_financieros"("id_movimiento") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_venta" ADD CONSTRAINT "items_venta_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id_venta") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items_venta" ADD CONSTRAINT "items_venta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id_producto") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id_cliente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias"("id_categoria") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_financieros" ADD CONSTRAINT "movimientos_financieros_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas"("id_cuenta") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sesiones" ADD CONSTRAINT "sesiones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id_cliente") ON DELETE CASCADE ON UPDATE CASCADE;
