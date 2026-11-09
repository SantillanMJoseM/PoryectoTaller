import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { asyncHandler } from "../lib/asyncHandler.js";

const r = Router();
const auth = requireAuth;

// helper: adjust stock
async function ajustarStock(productoId: string, delta: number) {
  const p = await prisma.producto.findUnique({ where: { idProducto: productoId } });
  if (!p) throw new HttpError(400, "Producto inexistente.");
  const newStock = Number(p.stock) + delta;
  if (newStock < 0) throw new HttpError(400, "Stock insuficiente.");
  await prisma.producto.update({ where: { idProducto: productoId }, data: { stock: newStock } });
}

// Ordenes lines
r.post("/orden/agregar-producto", auth, requirePermission("aOrden"), asyncHandler(async (req, res) => {
  const { ordenId, productoId, cantidad, precio } = req.body;
  if (!cantidad || Number(cantidad) <= 0) throw new HttpError(400, "La cantidad debe ser mayor que cero.");
  const prod = await prisma.producto.findUnique({ where: { idProducto: productoId } });
  if (!prod) throw new HttpError(400, "Producto inexistente.");
  if (!prod.salida) throw new HttpError(400, "El producto no está habilitado como salida.");
  await ajustarStock(productoId, -Number(cantidad));
  const vPrecio = precio != null ? Number(precio) : Number(prod.precioVenta);
  const linea = await prisma.productoOrden.create({ data: {
    ordenId, productoId, cantidad: Number(cantidad), descripcion: prod.descripcion,
    precio: vPrecio, subtotal: Number(cantidad)*vPrecio } });
  // recalc total
  await recalcOrden(ordenId);
  res.status(201).json(linea);
}));

async function recalcOrden(ordenId: string) {
  const po = await prisma.productoOrden.findMany({ where: { ordenId } });
  const so = await prisma.servicioOrden.findMany({ where: { ordenId } });
  const total = po.reduce((a,l)=>a+Number(l.subtotal),0) + so.reduce((a,l)=>a+Number(l.subtotal),0);
  await prisma.ordenTrabajo.update({ where: { idOrden: ordenId }, data: { valorTotal: total } });
}
async function recalcVenta(ventaId: string, descuento: number = 0) {
  const items = await prisma.itemVenta.findMany({ where: { ventaId } });
  const total = items.reduce((a,l)=>a+Number(l.subtotal),0) - descuento;
  await prisma.venta.update({ where: { idVenta: ventaId }, data: { valorTotal: total } });
}

r.post("/orden/cambiar-cantidad-producto", auth, requirePermission("eOrden"), asyncHandler(async (req, res) => {
  const { lineaId, cantidad } = req.body;
  if (!cantidad || Number(cantidad) <= 0) throw new HttpError(400, "La cantidad debe ser mayor que cero.");
  const linea = await prisma.productoOrden.findUnique({ where: { idProductoOrden: lineaId } });
  if (!linea) throw new HttpError(400, "Línea inexistente.");
  const delta = Number(linea.cantidad) - Number(cantidad);
  await ajustarStock(linea.productoId!, delta);
  await prisma.productoOrden.update({ where: { idProductoOrden: lineaId }, data: { cantidad: Number(cantidad), subtotal: Number(cantidad)*Number(linea.precio) } });
  await recalcOrden(linea.ordenId);
  res.json({ ok: true });
}));

r.post("/orden/quitar-producto", auth, requirePermission("eOrden"), asyncHandler(async (req, res) => {
  const { lineaId } = req.body;
  const linea = await prisma.productoOrden.findUnique({ where: { idProductoOrden: lineaId } });
  if (!linea) throw new HttpError(400, "Línea inexistente.");
  await prisma.productoOrden.delete({ where: { idProductoOrden: lineaId } });
  await ajustarStock(linea.productoId!, Number(linea.cantidad));
  await recalcOrden(linea.ordenId);
  res.json({ ok: true });
}));

// Servicios orden lines (no stock)
r.post("/orden/agregar-servicio", auth, requirePermission("aOrden"), asyncHandler(async (req, res) => {
  const { ordenId, servicioId, cantidad, precio } = req.body;
  const svc = await prisma.servicio.findUnique({ where: { idServicio: servicioId } });
  if (!svc) throw new HttpError(400, "Servicio inexistente.");
  const vPrecio = precio != null ? Number(precio) : Number(svc.precio);
  const cant = Number(cantidad ?? 1);
  const linea = await prisma.servicioOrden.create({ data: { ordenId, servicioId, servicio: svc.nombre, cantidad: cant, precio: vPrecio, subtotal: cant*vPrecio } });
  await recalcOrden(ordenId);
  res.status(201).json(linea);
}));
r.post("/orden/cambiar-cantidad-servicio", auth, requirePermission("eOrden"), asyncHandler(async (req, res) => {
  const { lineaId, cantidad } = req.body;
  const linea = await prisma.servicioOrden.findUnique({ where: { idServicioOrden: lineaId } });
  if (!linea) throw new HttpError(400, "Línea inexistente.");
  const cant = Number(cantidad);
  await prisma.servicioOrden.update({ where: { idServicioOrden: lineaId }, data: { cantidad: cant, subtotal: cant*Number(linea.precio) } });
  await recalcOrden(linea.ordenId);
  res.json({ ok: true });
}));
r.post("/orden/quitar-servicio", auth, requirePermission("eOrden"), asyncHandler(async (req, res) => {
  const { lineaId } = req.body;
  const linea = await prisma.servicioOrden.findUnique({ where: { idServicioOrden: lineaId } });
  if (!linea) throw new HttpError(400, "Línea inexistente.");
  await prisma.servicioOrden.delete({ where: { idServicioOrden: lineaId } });
  await recalcOrden(linea.ordenId);
  res.json({ ok: true });
}));

// Equipos orden
r.post("/orden/agregar-equipo", auth, requirePermission("aOrden"), asyncHandler(async (req, res) => {
  const { ordenId, equipoId, defectoDeclarado } = req.body;
  const e = await prisma.equipoOrden.create({ data: { ordenId, equipoId, defectoDeclarado } });
  res.status(201).json(e);
}));


r.post("/orden/cambiar-cantidad-servicio", auth, requirePermission("eOrden"), asyncHandler(async (req, res) => {
  const { lineaId, cantidad } = req.body;
  const linea = await prisma.servicioOrden.findUnique({ where: { idServicioOrden: lineaId } });
  if (!linea) throw new HttpError(400, "Línea inexistente.");
  const cant = Number(cantidad);
  if (cant <= 0) throw new HttpError(400, "La cantidad debe ser mayor que cero.");
  await prisma.servicioOrden.update({ where: { idServicioOrden: lineaId }, data: { cantidad: cant, subtotal: cant*Number(linea.precio) } });
  // recalc orden
  const po = await prisma.productoOrden.findMany({ where: { ordenId: linea.ordenId } });
  const so = await prisma.servicioOrden.findMany({ where: { ordenId: linea.ordenId } });
  const total = po.reduce((a,l)=>a+Number(l.subtotal),0)+so.reduce((a,l)=>a+Number(l.subtotal),0);
  await prisma.ordenTrabajo.update({ where: { idOrden: linea.ordenId }, data: { valorTotal: total } });
  res.json({ ok: true });
}));
r.post("/orden/quitar-servicio", auth, requirePermission("eOrden"), asyncHandler(async (req, res) => {
  const { lineaId } = req.body;
  const linea = await prisma.servicioOrden.findUnique({ where: { idServicioOrden: lineaId } });
  if (!linea) throw new HttpError(400, "Línea inexistente.");
  await prisma.servicioOrden.delete({ where: { idServicioOrden: lineaId } });
  const po = await prisma.productoOrden.findMany({ where: { ordenId: linea.ordenId } });
  const so = await prisma.servicioOrden.findMany({ where: { ordenId: linea.ordenId } });
  const total = po.reduce((a,l)=>a+Number(l.subtotal),0)+so.reduce((a,l)=>a+Number(l.subtotal),0);
  await prisma.ordenTrabajo.update({ where: { idOrden: linea.ordenId }, data: { valorTotal: total } });
  res.json({ ok: true });
}));

// Ventas lines
r.post("/venta/agregar-item", auth, requirePermission("aVenta"), asyncHandler(async (req, res) => {
  const { ventaId, productoId, cantidad, precio } = req.body;
  if (!cantidad || Number(cantidad) <= 0) throw new HttpError(400, "La cantidad debe ser mayor que cero.");
  const prod = await prisma.producto.findUnique({ where: { idProducto: productoId } });
  if (!prod) throw new HttpError(400, "Producto inexistente.");
  if (!prod.salida) throw new HttpError(400, "El producto no está habilitado como salida.");
  await ajustarStock(productoId, -Number(cantidad));
  const vPrecio = precio != null ? Number(precio) : Number(prod.precioVenta);
  const item = await prisma.itemVenta.create({ data: { ventaId, productoId, cantidad: Number(cantidad), descripcion: prod.descripcion, precio: vPrecio, subtotal: Number(cantidad)*vPrecio } });
  await recalcVenta(ventaId, 0);
  // apply descuento from venta
  const v = await prisma.venta.findUnique({ where: { idVenta: ventaId } });
  if (v) await recalcVenta(ventaId, Number(v.descuento));
  res.status(201).json(item);
}));
r.post("/venta/cambiar-cantidad-item", auth, requirePermission("eVenta"), asyncHandler(async (req, res) => {
  const { itemId, cantidad } = req.body;
  const item = await prisma.itemVenta.findUnique({ where: { idItemVenta: itemId } });
  if (!item) throw new HttpError(400, "Item inexistente.");
  const cant = Number(cantidad);
  if (cant <= 0) throw new HttpError(400, "La cantidad debe ser mayor que cero.");
  await ajustarStock(item.productoId!, Number(item.cantidad) - cant);
  await prisma.itemVenta.update({ where: { idItemVenta: itemId }, data: { cantidad: cant, subtotal: cant*Number(item.precio) } });
  const v = await prisma.venta.findUnique({ where: { idVenta: item.ventaId } });
  await recalcVenta(item.ventaId, Number(v?.descuento ?? 0));
  res.json({ ok: true });
}));
r.post("/venta/quitar-item", auth, requirePermission("eVenta"), asyncHandler(async (req, res) => {
  const { itemId } = req.body;
  const item = await prisma.itemVenta.findUnique({ where: { idItemVenta: itemId } });
  if (!item) throw new HttpError(400, "Item inexistente.");
  await prisma.itemVenta.delete({ where: { idItemVenta: itemId } });
  await ajustarStock(item.productoId!, Number(item.cantidad));
  const v = await prisma.venta.findUnique({ where: { idVenta: item.ventaId } });
  await recalcVenta(item.ventaId, Number(v?.descuento ?? 0));
  res.json({ ok: true });
}));

// Facturacion
r.post("/orden/facturar", auth, requirePermission("aMovimiento"), asyncHandler(async (req, res) => {
  const { ordenId, fechaVencimiento, formaPago, categoriaId, cuentaId } = req.body;
  const orden = await prisma.ordenTrabajo.findUnique({ where: { idOrden: ordenId } });
  if (!orden) throw new HttpError(400, "Orden inexistente.");
  if (orden.facturado) throw new HttpError(400, "La orden ya está facturada.");
  if (Number(orden.valorTotal) <= 0) throw new HttpError(400, "No se puede facturar una orden sin valor total.");
  const mov = await prisma.$transaction(async (tx) => {
    const m = await tx.movimientoFinanciero.create({ data: {
      descripcion: "Facturación de orden", valor: orden.valorTotal,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : new Date(),
      pagado: false, formaPago, tipo: "ingreso", clienteId: orden.clienteId,
      categoriaId: categoriaId || null, cuentaId: cuentaId || null } });
    await tx.ordenTrabajo.update({ where: { idOrden: ordenId }, data: { facturado: true, lanzamientoId: m.idMovimiento } });
    return m;
  });
  res.json(mov);
}));
r.post("/venta/facturar", auth, requirePermission("aMovimiento"), asyncHandler(async (req, res) => {
  const { ventaId, fechaVencimiento, formaPago, categoriaId, cuentaId } = req.body;
  const venta = await prisma.venta.findUnique({ where: { idVenta: ventaId } });
  if (!venta) throw new HttpError(400, "Venta inexistente.");
  if (venta.facturado) throw new HttpError(400, "La venta ya está facturada.");
  if (Number(venta.valorTotal) <= 0) throw new HttpError(400, "No se puede facturar una venta sin valor total.");
  const mov = await prisma.$transaction(async (tx) => {
    const m = await tx.movimientoFinanciero.create({ data: {
      descripcion: "Facturación de venta", valor: venta.valorTotal,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : new Date(),
      pagado: false, formaPago, tipo: "ingreso", clienteId: venta.clienteId,
      categoriaId: categoriaId || null, cuentaId: cuentaId || null } });
    await tx.venta.update({ where: { idVenta: ventaId }, data: { facturado: true, lanzamientoId: m.idMovimiento } });
    return m;
  });
  res.json(mov);
}));

r.post("/mov/marcar-pagado", auth, requirePermission("eMovimiento"), asyncHandler(async (req, res) => {
  const { movimientoId, fechaPago } = req.body;
  await prisma.movimientoFinanciero.update({ where: { idMovimiento: movimientoId }, data: { pagado: true, fechaPago: fechaPago ? new Date(fechaPago) : new Date() } });
  res.json({ ok: true });
}));

r.post("/mov/ajustar-stock", auth, requirePermission("aProducto"), asyncHandler(async (req, res) => {
  const { productoId, delta } = req.body;
  await ajustarStock(productoId, Number(delta));
  res.json({ ok: true });
}));

// Anexos upload handled separately in storage router; here delete anexo
r.delete("/anexo/:id", auth, requirePermission("dOrden"), asyncHandler(async (req, res) => {
  await prisma.anexo.delete({ where: { idAnexo: req.params.id } });
  res.status(204).send();
}));

// Logs limpiar
r.post("/logs/limpiar", auth, requirePermission("dAuditoria"), asyncHandler(async (req, res) => {
  const count = await prisma.logAuditoria.count();
  await prisma.logAuditoria.deleteMany({});
  res.json({ borrados: count });
}));

// Sesiones
r.post("/sesion/registrar", auth, asyncHandler(async (req, res) => {
  const { tipo, sujeto, duracionHoras } = req.body;
  const horas = duracionHoras ?? (tipo === "administrador" ? 12 : 24);
  const s = await prisma.sesion.create({ data: {
    usuarioId: tipo === "administrador" ? sujeto : null,
    clienteId: tipo === "cliente" ? sujeto : null,
    tipo, expiracion: new Date(Date.now() + horas*3600*1000) } });
  res.json(s.idSesion);
}));
r.post("/sesion/cerrar", auth, asyncHandler(async (req, res) => {
  const { sesionId } = req.body;
  if (sesionId) await prisma.sesion.update({ where: { idSesion: sesionId }, data: { activa: false } }).catch(()=>{});
  res.json({ ok: true });
}));
r.post("/sesion/purgar", auth, asyncHandler(async (_req, res) => {
  const n = await prisma.sesion.deleteMany({ where: { OR: [{ expiracion: { lt: new Date() } }, { activa: false }] } });
  res.json({ purgados: n.count });
}));

// Auditar helper (optional) - frontend can call audit log
r.post("/auditoria/log", auth, asyncHandler(async (req, res) => {
  const { usuario, tarea, ip } = req.body;
  await prisma.logAuditoria.create({ data: { usuario, tarea, ip } });
  res.json({ ok: true });
}));

// Email queue: enqueue
r.post("/email/enqueue", auth, requirePermission("vEmail"), asyncHandler(async (req, res) => {
  const e = await prisma.colaEmail.create({ data: req.body });
  res.status(201).json(e);
}));

export default r;
