-- ============================================================================
-- Sistema Taller — seed.sql (TASK-0006 / AG-010)
-- ============================================================================
-- Datos de ejemplo mínimos para pruebas (SP §ENTREGABLE), regeneración
-- idempotente (RB-001 — nunca elimina ni modifica datos existentes).
-- Alcance: empresa, grupos de permisos, 2 usuarios, clientes, productos
-- (incluye alerta de stock), servicios, garantía, categorías, cuentas,
-- órdenes con líneas, venta facturada con movimiento financiero, movimientos
-- con las 4 situaciones (RB-026), documentos, anexos, equipos, logs y emails
-- de cola en los 4 estados.
-- NOTA: la identidad y contraseña de los usuarios viven en Supabase Auth
-- (auth.users, bcrypt) según DATA_MODEL §2.6; estos perfiles son la ficha
-- administrativa enlazada por correo.
-- ============================================================================

do $$
declare
  -- Grupos de permisos (códigos de actividad SP §11)
  v_modulos    text[] := array['Cliente','Producto','Servicio','Orden','Venta',
                               'Garantia','Movimiento','Archivo','Usuario','Permiso'];
  v_actividades text[] := array['a','e','d','v','r'];
  v_codigos    text[] := '{}';
  m text; a text;
begin
  -- Guard idempotente: si la empresa ya está registrada no resiembra nada.
  if exists (select 1 from empresa) then
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- Empresa (registro único, RB-030)
  -- -------------------------------------------------------------------------
  insert into empresa (id, nombre, cnpj, ie, calle, numero, barrio, ciudad, provincia, telefono, correo)
  values ('00000000-0000-4000-8000-0000000000e1',
          'Taller Demo', '00.000.000/0001-00', '000000000',
          'Calle Principal', '123', 'Centro', 'Ciudad', 'Provincia',
          '555-0000', 'contacto@taller.com');

  -- -------------------------------------------------------------------------
  -- Permisos: grupo Administrador (todos los códigos) y Técnico (solo v/r)
  -- -------------------------------------------------------------------------
  v_codigos := '{}';
  foreach m in array v_modulos loop
    foreach a in array v_actividades loop
      v_codigos := v_codigos || (a || m);
    end loop;
  end loop;
  -- Respaldo, Auditoría, Email y Empresa (módulos con códigos acotados)
  v_codigos := v_codigos || array['cRespaldo','vAuditoria','dAuditoria',
                                  'aEmail','vEmail','dEmail','cEmpresa','eEmpresa'];

  insert into permisos (id_permiso, nombre, permisos, estado)
  values ('00000000-0000-4000-8000-000000000001', 'Administrador',
          to_jsonb(v_codigos), true);

  v_codigos := '{}';
  foreach m in array v_modulos loop
    foreach a in array array['v','r'] loop
      v_codigos := v_codigos || (a || m);
    end loop;
  end loop;
  v_codigos := v_codigos || array['aOrden','eOrden','vAuditoria','vEmail'];

  insert into permisos (id_permiso, nombre, permisos, estado)
  values ('00000000-0000-4000-8000-000000000002', 'Técnico',
          to_jsonb(v_codigos), true);

  -- -------------------------------------------------------------------------
  -- Usuarios (identidad + contraseña bcrypt en auth.users)
  -- -------------------------------------------------------------------------
  insert into usuarios (id_usuario, nombre, rg, cpf, calle, numero, barrio, ciudad, estado,
                        correo, telefono, celular, estado_usuario, permiso_id)
  values
    ('00000000-0000-4000-8000-000000000011', 'Admin Sistema', '10.111.111', '111.111.111-11',
     'Avenida Central', '100', 'Centro', 'Ciudad', 'Provincia',
     'admin@taller.com', '555-1000', '555-6000', true,
     '00000000-0000-4000-8000-000000000001'),
    ('00000000-0000-4000-8000-000000000012', 'Carlos Técnico', '22.222.222', '222.222.222-22',
     'Calle Dos', '45', 'Norte', 'Ciudad', 'Provincia',
     'tecnico@taller.com', '555-1001', '555-6001', true,
     '00000000-0000-4000-8000-000000000002');

  -- -------------------------------------------------------------------------
  -- Clientes (c1/c2 con credenciales del portal: correo + documento)
  -- -------------------------------------------------------------------------
  insert into clientes (id_cliente, nombre_cliente, sexo, persona_fisica, documento,
                        telefono, celular, correo, fecha_registro,
                        calle, numero, barrio, ciudad, estado, codigo_postal)
  values
    ('00000000-0000-4000-8000-000000000021', 'Juan Pérez', 'Masculino', true,
     '12345678', '555-1111', '555-2111', 'cliente@demo.com', now() - interval '90 days',
     'Calle Uno', '10', 'Centro', 'Ciudad', 'Provincia', '1000'),
    ('00000000-0000-4000-8000-000000000022', 'María Gómez', 'Femenino', true,
     '87654321', '555-1112', '555-2112', 'maria@demo.com', now() - interval '60 days',
     'Avenida Dos', '222', 'Sur', 'Ciudad', 'Provincia', '2000'),
    ('00000000-0000-4000-8000-000000000023', 'Comercial Andina SA', null, false,
     '30-71234567-9', '555-1113', '555-2113', 'comercial@andina.com', now() - interval '30 days',
     'Calle Industrial', '900', 'Zona Norte', 'Ciudad', 'Provincia', '3000');

  -- -------------------------------------------------------------------------
  -- Marcas y equipos (sub-recursos E-04)
  -- -------------------------------------------------------------------------
  insert into marcas (id_marca, marca)
  values ('00000000-0000-4000-8000-000000000031', 'ElectroGen');

  insert into equipos (id_equipo, equipo, numero_serie, modelo, color, descripcion,
                       tension, potencia, voltaje, fecha_fabricacion, marca_id, cliente_id)
  values
    ('00000000-0000-4000-8000-000000000041', 'Generador 5 kVA', 'SN-0001',
     'G5000', 'Azul', 'Generador portátil', '220', '5000', '220', date '2019-05-14',
     '00000000-0000-4000-8000-000000000031',
     '00000000-0000-4000-8000-000000000021'),
    ('00000000-0000-4000-8000-000000000042', 'Compresor de aire', 'SN-0002',
     'C300', 'Rojo', 'Compresor 30 L', '220', '1500', '220', date '2021-11-02',
     '00000000-0000-4000-8000-000000000031',
     '00000000-0000-4000-8000-000000000022');

  -- -------------------------------------------------------------------------
  -- Productos (p2 y p5 con stock bajo para v_stock_alerta)
  -- -------------------------------------------------------------------------
  insert into productos (id_producto, descripcion, unidad, precio_compra, precio_venta,
                         stock, stock_minimo, salida, entrada)
  values
    ('00000000-0000-4000-8000-000000000051', 'Kit de mantenimiento', 'un', 45.00, 80.00, 5, 2, true, true),
    ('00000000-0000-4000-8000-000000000052', 'Filtro de aceite', 'un', 90.00, 150.00, 1, 3, true, true),
    ('00000000-0000-4000-8000-000000000053', 'Aceite lubricante', 'lt', 12.00, 24.00, 12, 5, true, true),
    ('00000000-0000-4000-8000-000000000054', 'Correa transmission', 'un', 25.00, 60.00, 20, 4, true, true),
    ('00000000-0000-4000-8000-000000000055', 'Bujía industrial', 'un', 15.00, 45.00, 3, 5, true, true),
    ('00000000-0000-4000-8000-000000000056', 'Repuesto obsoleto', 'un', 5.00, 10.00, 0, 0, false, false);

  -- -------------------------------------------------------------------------
  -- Servicios
  -- -------------------------------------------------------------------------
  insert into servicios (id_servicio, nombre, descripcion, precio)
  values
    ('00000000-0000-4000-8000-000000000061', 'Diagnóstico técnico',
     'Revisión y diagnóstico del equipo', 120.00),
    ('00000000-0000-4000-8000-000000000062', 'Reparación de placa electrónica',
     'Reparación de placas y electrónica general', 350.00),
    ('00000000-0000-4000-8000-000000000063', 'Instalación de equipo',
     'Instalación y puesta en marcha', 250.00);

  -- -------------------------------------------------------------------------
  -- Garantía (términos) — autocompletado en órdenes
  -- -------------------------------------------------------------------------
  insert into garantias (id_garantia, fecha_garantia, referencia, texto_garantia, usuario_id)
  values ('00000000-0000-4000-8000-000000000071', current_date,
          'Garantía estándar 90 días',
          'Garantía de 90 días sobre el trabajo realizado, la cual cubre defectos de la intervención. No cubre mal uso del equipo.',
          '00000000-0000-4000-8000-000000000012');

  -- -------------------------------------------------------------------------
  -- Categorías y cuentas financieras
  -- -------------------------------------------------------------------------
  insert into categorias (id_categoria, categoria, tipo)
  values
    ('00000000-0000-4000-8000-000000000081', 'Ventas', 'ingreso'),
    ('00000000-0000-4000-8000-000000000082', 'Servicios técnicos', 'ingreso'),
    ('00000000-0000-4000-8000-000000000083', 'Compra de repuestos', 'egreso'),
    ('00000000-0000-4000-8000-000000000084', 'Gastos operativos', 'egreso');

  insert into cuentas (id_cuenta, cuenta, banco, numero, saldo, tipo)
  values
    ('00000000-0000-4000-8000-000000000091', 'Caja principal', null, null, 1500.00, 'ingreso'),
    ('00000000-0000-4000-8000-000000000092', 'Banco principal', 'Banco Demo', '0001234-5', 8500.00, 'ingreso');

  -- -------------------------------------------------------------------------
  -- Órdenes de trabajo
  -- -------------------------------------------------------------------------
  insert into ordenes_trabajo (id_orden, fecha_inicial, fecha_final, garantia,
                               descripcion_producto, defecto, estado, observaciones,
                               laudo_tecnico, cliente_id, usuario_id, garantia_id)
  values ('00000000-0000-4000-8000-0000000000a1',
          current_date - 5, null,
          '90 días',
          'Generador 5 kVA', 'No arranca en frío',
          'En Proceso', 'Cliente reportó ruido anómalo.',
          null,
          '00000000-0000-4000-8000-000000000021',  -- Juan Pérez
          '00000000-0000-4000-8000-000000000012',  -- Carlos Técnico
          '00000000-0000-4000-8000-000000000071');

  insert into ordenes_trabajo (id_orden, fecha_inicial, garantia,
                               descripcion_producto, defecto, estado,
                               cliente_id, usuario_id)
  values ('00000000-0000-4000-8000-0000000000a2',
          current_date - 2, 'Garantía estándar 90 días',
          'Compresor de aire', 'Pérdida de presión',
          'Presupuesto',
          '00000000-0000-4000-8000-000000000022',
          '00000000-0000-4000-8000-000000000012');

  -- Equipo intervenido por la orden 1 (RF-031)
  insert into equipos_orden (id_equipo_orden, defecto_declarado, defecto_encontrado,
                             solucion, equipo_id, orden_id)
  values ('00000000-0000-4000-8000-0000000000b1',
          'No arranca en frío',
          'Bujía deteriorada y filtro saturado',
          null,
          '00000000-0000-4000-8000-000000000041',
          '00000000-0000-4000-8000-0000000000a1');

  -- Líneas de producto (el stock registrado ya refleja el descuento)
  insert into productos_orden (id_producto_orden, cantidad, descripcion, precio,
                               orden_id, producto_id, subtotal)
  values
    ('00000000-0000-4000-8000-0000000000c1', 2, 'Kit de mantenimiento', 80.00,
     '00000000-0000-4000-8000-0000000000a1',
     '00000000-0000-4000-8000-000000000051', 160.00),
    ('00000000-0000-4000-8000-0000000000c2', 1, 'Filtro de aceite', 150.00,
     '00000000-0000-4000-8000-0000000000a1',
     '00000000-0000-4000-8000-000000000052', 150.00);

  insert into servicios_orden (id_servicio_orden, servicio, cantidad, precio,
                               orden_id, servicio_id, subtotal)
  values
    ('00000000-0000-4000-8000-0000000000d1', 'Diagnóstico técnico', 1, 120.00,
     '00000000-0000-4000-8000-0000000000a1',
     '00000000-0000-4000-8000-000000000061', 120.00),
    ('00000000-0000-4000-8000-0000000000d2', 'Instalación de equipo', 1, 250.00,
     '00000000-0000-4000-8000-0000000000a2',
     '00000000-0000-4000-8000-000000000063', 250.00);

  -- Adjunto de orden (Storage: ruta autoritativa; url se firma en runtime)
  insert into anexos (id_anexo, anexo, miniatura, url, ruta, orden_id)
  values ('00000000-0000-4000-8000-0000000000f1', 'foto-equipo.jpg',
          'anexos-orden/00000000-0000-4000-8000-0000000000a1/foto-equipo.thumb.webp',
          null,
          'anexos-orden/00000000-0000-4000-8000-0000000000a1/foto-equipo.jpg',
          '00000000-0000-4000-8000-0000000000a1');

  -- -------------------------------------------------------------------------
  -- Venta facturada (RB-004): items + movimiento financiero asociado
  -- -------------------------------------------------------------------------
  insert into ventas (id_venta, fecha_venta, descuento, facturado,
                      cliente_id, usuario_id)
  values ('00000000-0000-4000-8000-0000000000e5',
          current_date - 2, 20.00, false,
          '00000000-0000-4000-8000-000000000021',
          '00000000-0000-4000-8000-000000000011');

  insert into items_venta (id_item_venta, cantidad, descripcion, precio,
                           venta_id, producto_id, subtotal)
  values
    ('00000000-0000-4000-8000-0000000000e6', 3, 'Correa transmission', 60.00,
     '00000000-0000-4000-8000-0000000000e5',
     '00000000-0000-4000-8000-000000000054', 180.00),
    ('00000000-0000-4000-8000-0000000000e7', 1, 'Bujía industrial', 45.00,
     '00000000-0000-4000-8000-0000000000e5',
     '00000000-0000-4000-8000-000000000055', 45.00);

  -- Movimiento asociado a la venta facturada (valor computado por trigger)
  insert into movimientos_financieros
    (id_movimiento, descripcion, valor, fecha_vencimiento, fecha_pago, pagado,
     cliente_proveedor, forma_pago, tipo, cliente_id, categoria_id, cuenta_id, venta_id)
  select '00000000-0000-4000-8000-0000000000ea',
         'Facturación de venta', valor_total, current_date, current_date, true,
         null, 'Efectivo', 'ingreso',
         '00000000-0000-4000-8000-000000000021',
         '00000000-0000-4000-8000-000000000081',
         '00000000-0000-4000-8000-000000000091',
         '00000000-0000-4000-8000-0000000000e5'
    from ventas where id_venta = '00000000-0000-4000-8000-0000000000e5';

  update ventas
     set facturado = true, lanzamiento_id = '00000000-0000-4000-8000-0000000000ea'
   where id_venta = '00000000-0000-4000-8000-0000000000e5'
     and lanzamiento_id is null;

  -- -------------------------------------------------------------------------
  -- Movimientos con las 4 situaciones (RB-026): realizado / atrasado /
  -- previsto / pendiente (vence hoy)
  -- -------------------------------------------------------------------------
  insert into movimientos_financieros
    (id_movimiento, descripcion, valor, fecha_vencimiento, fecha_pago, pagado,
     cliente_proveedor, forma_pago, tipo, cliente_id, categoria_id, cuenta_id)
  values
    ('00000000-0000-4000-8000-0000000000eb',  -- atrasado
     'Compra de repuestos — Distribuidora XYZ', 320.00,
     current_date - 7, null, false,
     'Distribuidora XYZ', 'Transferencia', 'egreso', null,
     '00000000-0000-4000-8000-000000000083',
     '00000000-0000-4000-8000-000000000092'),
    ('00000000-0000-4000-8000-0000000000ec',  -- previsto
     'Anticipo reparación — Juan Pérez', 150.00,
     current_date + 10, null, false,
     null, 'Efectivo', 'ingreso',
     '00000000-0000-4000-8000-000000000021', null, null),
    ('00000000-0000-4000-8000-0000000000ed',  -- pendiente (vence hoy)
     'Servicios básicos — luz y agua', 60.00,
     current_date, null, false,
     null, 'Débito automático', 'egreso', null,
     '00000000-0000-4000-8000-000000000084',
     '00000000-0000-4000-8000-000000000092'),
    ('00000000-0000-4000-8000-0000000000ee',  -- realizado
     'Venta mostrador', 480.00,
     current_date - 3, current_date - 3, true,
     null, 'Tarjeta', 'ingreso', null,
     '00000000-0000-4000-8000-000000000081',
     '00000000-0000-4000-8000-000000000091');

  -- -------------------------------------------------------------------------
  -- Archivos/Documentos
  -- -------------------------------------------------------------------------
  insert into documentos (id_documento, documento, descripcion, archivo, ruta, url,
                          fecha_registro, categoria, tipo, tamanio)
  values ('00000000-0000-4000-8000-0000000000e3',
          'Manual de procedimientos', 'Manual interno de taller',
          'manual-procedimientos.pdf',
          'documentos/ejemplo/manual-procedimientos.pdf', null,
          now(), 'Manuales', 'application/pdf', 1048576);

  -- -------------------------------------------------------------------------
  -- Auditoría (además de los logs automáticos de tg_auditar)
  -- -------------------------------------------------------------------------
  insert into logs_auditoria (usuario, tarea, fecha, hora, ip)
  values ('Admin Sistema', 'inicia sesion', current_date, '08:00:00', '127.0.0.1');

  -- -------------------------------------------------------------------------
  -- Cola de emails: un registro por cada estado (RB-015)
  -- -------------------------------------------------------------------------
  insert into cola_emails (para, cc, cco, mensaje, estado, encabezados)
  values
    ('cliente@demo.com', null, null,
     'Su orden de trabajo fue recibida.', 'pendiente',
     '{"asunto": "Orden en proceso", "intentos": 0}'),
    ('maria@demo.com', null, 'comercial@andina.com',
     'Su orden fue finalizada.', 'enviando',
     '{"asunto": "Orden finalizada", "intentos": 1}'),
    ('comercial@andina.com', 'contacto@taller.com', null,
     'Venta facturada: detalle adjunto.', 'enviado',
     '{"asunto": "Factura de venta", "intentos": 1, "enviado_en": "ok"}'),
    ('no-envia@demo.com', null, null,
     'Correo con error de envío para reintentar.', 'fallido',
     '{"asunto": "Recordatorio", "intentos": 3, "ultimo_error": "smtp:511 relay denied"}');
end $$;

-- ============================================================================
-- Fin de seed.sql
-- ============================================================================
