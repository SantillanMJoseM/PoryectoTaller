insert into empresa (nombre, cnpj, ie, calle, numero, barrio, ciudad, provincia, telefono, correo)
values ('Taller Demo', '00.000.000/0001-00', '000000000', 'Calle Principal', '123', 'Centro', 'Ciudad', 'Provincia', '555-0000', 'contacto@taller.com');

insert into permisos (nombre, permisos, estado)
values ('Administrador', 'aCliente,eCliente,dCliente,vCliente,rCliente,aProducto,eProducto,dProducto,vProducto,rProducto,aServicio,eServicio,dServicio,vServicio,rServicio,aOrden,eOrden,dOrden,vOrden,rOrden,aVenta,eVenta,dVenta,vVenta,rVenta,aGarantia,eGarantia,dGarantia,vGarantia,rGarantia,aMovimiento,eMovimiento,dMovimiento,vMovimiento,rMovimiento,aArchivo,eArchivo,dArchivo,vArchivo,rArchivo,aUsuario,eUsuario,dUsuario,vUsuario,rUsuario,aPermiso,ePermiso,dPermiso,vPermiso,rPermiso,rAuditoria,cEmpresa,aEmail,vEmail', true);

insert into clientes (nombre_cliente, documento, correo, telefono)
values ('Cliente Demo', '12345678', 'cliente@demo.com', '555-1111');

insert into productos (descripcion, unidad, precio_compra, precio_venta, stock, stock_minimo)
values ('Producto Demo', 'UN', 10, 20, 5, 2);

insert into servicios (nombre, descripcion, precio)
values ('Servicio Demo', 'Servicio de ejemplo', 50);
