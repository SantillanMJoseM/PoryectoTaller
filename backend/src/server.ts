import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { errorHandler } from "./middleware/error.js";
import { requireAuth } from "./middleware/auth.js";
import { buildCrudRouter } from "./lib/crudFactory.js";
import authRoutes from "./routes/auth.js";
import negocioRoutes from "./routes/negocio.js";
import storageRoutes from "./routes/storage.js";

const ALL_PERMS = ["vCliente","aCliente","eCliente","dCliente","vProducto","aProducto","eProducto","dProducto","vServicio","aServicio","eServicio","dServicio","vOrden","aOrden","eOrden","dOrden","vVenta","aVenta","eVenta","dVenta","vMovimiento","aMovimiento","eMovimiento","dMovimiento","vArchivo","aArchivo","eArchivo","dArchivo","vUsuario","aUsuario","eUsuario","dUsuario","vPermiso","aPermiso","ePermiso","dPermiso","vAuditoria","dAuditoria","vEmail","dEmail","cEmpresa","eEmpresa","vGarantia","aGarantia","eGarantia","dGarantia"];


function snakeToCamel(s: string) { return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()); }
function camelToSnake(s: string) { return s.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase()); }
function convertKeys(obj: any, fn: (k: string) => string): any {
  if (Array.isArray(obj)) return obj.map((x) => convertKeys(x, fn));
  if (obj && typeof obj === "object" && !(obj instanceof Date)) {
    const out: any = {};
    for (const k of Object.keys(obj)) out[fn(k)] = convertKeys(obj[k], fn);
    return out;
  }
  return obj;
}

const app = express();
app.use(helmet());

app.use((req, res, next) => {
  const orig = res.json.bind(res);
  res.json = (data: any) => orig(convertKeys(data, camelToSnake));
  next();
});

if (env.CORS_ORIGIN && env.CORS_ORIGIN !== "*") app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.use((req, _res, next) => {
  if (req.body && typeof req.body === "object") req.body = convertKeys(req.body, snakeToCamel);
  if (req.query && typeof req.query === "object") req.query = convertKeys(req.query, snakeToCamel) as any;
  next();
});


import { requirePermission } from "./middleware/auth.js";

function crud(model: string, pk: string, search: string[], permisos: any) {
  return buildCrudRouter({ model, pk, searchFields: search, permisos }, requireAuth, requirePermission);
}

// Register crud routers
app.use("/api/empresa", crud("empresa", "id", [], { view: "", add: "cEmpresa", edit: "eEmpresa", del: "" }));
// empresa pk is 'id' not id? schema Empresa has id. yes
app.use("/api/permisos", crud("permiso", "idPermiso", ["nombre"], { view: "vPermiso", add: "aPermiso", edit: "ePermiso", del: "dPermiso" }));
app.use("/api/usuarios", crud("usuario", "idUsuario", ["nombre", "correo"], { view: "vUsuario", add: "aUsuario", edit: "eUsuario", del: "dUsuario" }));
app.use("/api/clientes", crud("cliente", "idCliente", ["nombreCliente", "documento", "correo"], { view: "vCliente", add: "aCliente", edit: "eCliente", del: "dCliente" }));
app.use("/api/marcas", crud("marca", "idMarca", ["marca"], { view: "vCliente", add: "aCliente", edit: "eCliente", del: "dCliente" }));
app.use("/api/equipos", crud("equipo", "idEquipo", ["equipo", "numeroSerie", "modelo"], { view: "vCliente", add: "aCliente", edit: "eCliente", del: "dCliente" }));
app.use("/api/productos", crud("producto", "idProducto", ["descripcion"], { view: "vProducto", add: "aProducto", edit: "eProducto", del: "dProducto" }));
app.use("/api/servicios", crud("servicio", "idServicio", ["nombre", "descripcion"], { view: "vServicio", add: "aServicio", edit: "eServicio", del: "dServicio" }));
app.use("/api/garantias", crud("garantia", "idGarantia", ["referencia", "textoGarantia"], { view: "vGarantia", add: "aGarantia", edit: "eGarantia", del: "dGarantia" }));
app.use("/api/categorias", crud("categoria", "idCategoria", ["categoria"], { view: "vMovimiento", add: "aMovimiento", edit: "eMovimiento", del: "dMovimiento" }));
app.use("/api/cuentas", crud("cuenta", "idCuenta", ["cuenta", "banco"], { view: "vMovimiento", add: "aMovimiento", edit: "eMovimiento", del: "dMovimiento" }));
app.use("/api/ordenes", crud("ordenTrabajo", "idOrden", [], { view: "vOrden", add: "aOrden", edit: "eOrden", del: "dOrden", guardUpdate: async (id: string) => {
  const o = await prisma.ordenTrabajo.findUnique({ where: { idOrden: id } });
  if (o?.facturado) throw new Error("La orden ya está facturada y no puede modificarse.");
}, guardDelete: async (id: string) => {
  const o = await prisma.ordenTrabajo.findUnique({ where: { idOrden: id } });
  if (o?.facturado) throw new Error("La orden ya está facturada y no puede eliminarse.");
} }));
app.use("/api/productos-orden", crud("productoOrden", "idProductoOrden", [], { view: "vOrden", add: "aOrden", edit: "eOrden", del: "dOrden" }));
app.use("/api/servicios-orden", crud("servicioOrden", "idServicioOrden", [], { view: "vOrden", add: "aOrden", edit: "eOrden", del: "dOrden" }));
app.use("/api/equipos-orden", crud("equipoOrden", "idEquipoOrden", [], { view: "vOrden", add: "aOrden", edit: "eOrden", del: "dOrden" }));
app.use("/api/anexos", crud("anexo", "idAnexo", ["anexo"], { view: "vOrden", add: "aOrden", edit: "eOrden", del: "dOrden" }));
app.use("/api/ventas", crud("venta", "idVenta", [], { view: "vVenta", add: "aVenta", edit: "eVenta", del: "dVenta", guardUpdate: async (id: string) => {
  const v = await prisma.venta.findUnique({ where: { idVenta: id } });
  if (v?.facturado) throw new Error("La venta ya está facturada y no puede modificarse.");
}, guardDelete: async (id: string) => {
  const v = await prisma.venta.findUnique({ where: { idVenta: id } });
  if (v?.facturado) throw new Error("La venta ya está facturada y no puede eliminarse.");
} }));
app.use("/api/items-venta", crud("itemVenta", "idItemVenta", [], { view: "vVenta", add: "aVenta", edit: "eVenta", del: "dVenta", guardUpdate: async (id: string) => {
  const it = await prisma.itemVenta.findUnique({ where: { idItemVenta: id } });
  if (!it) return;
  const v = await prisma.venta.findUnique({ where: { idVenta: it.ventaId } });
  if (v?.facturado) throw new Error("La venta ya está facturada y no puede modificarse.");
}, guardDelete: async (id: string) => {
  const it = await prisma.itemVenta.findUnique({ where: { idItemVenta: id } });
  if (!it) return;
  const v = await prisma.venta.findUnique({ where: { idVenta: it.ventaId } });
  if (v?.facturado) throw new Error("La venta ya está facturada y no puede modificarse.");
} }));
app.use("/api/movimientos", crud("movimientoFinanciero", "idMovimiento", ["descripcion", "clienteProveedor"], { view: "vMovimiento", add: "aMovimiento", edit: "eMovimiento", del: "dMovimiento" }));
app.use("/api/documentos", crud("documento", "idDocumento", ["documento", "descripcion"], { view: "vArchivo", add: "aArchivo", edit: "eArchivo", del: "dArchivo" }));
app.use("/api/logs", crud("logAuditoria", "idLog", [], { view: "vAuditoria", add: "", edit: "", del: "dAuditoria" }));
app.use("/api/emails", crud("colaEmail", "id", [], { view: "vEmail", add: "", edit: "", del: "dEmail" }));
app.use("/api/sesiones", crud("sesion", "idSesion", [], { view: "vUsuario", add: "", edit: "", del: "" }));

// auth & negocio & storage
app.use("/api/auth", authRoutes);
app.use("/api", negocioRoutes);
app.use("/api/storage", storageRoutes);

// swagger
const spec = swaggerJsdoc({ definition: { openapi: "3.0.0", info: { title: "Sistema Taller API", version: "1.0.0" } }, apis: [] });
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(spec));

app.use(errorHandler);

// bootstrap admin
async function bootstrap() {
  // create admin permiso if not exists
  let permiso = await prisma.permiso.findFirst({ where: { nombre: "Administrador" } });
  if (!permiso) {
    permiso = await prisma.permiso.create({ data: { nombre: "Administrador", permisos: ALL_PERMS as any, estado: true } });
  } else {
    // ensure all perms
    const cur = Array.isArray(permiso.permisos) ? permiso.permisos : [];
    const merged = Array.from(new Set([...cur, ...ALL_PERMS]));
    if (merged.length !== cur.length) await prisma.permiso.update({ where: { idPermiso: permiso.idPermiso }, data: { permisos: merged as any } });
  }
  // admin user
  const email = env.ADMIN_EMAIL.toLowerCase();
  let user = await prisma.usuario.findUnique({ where: { correo: email } });
  if (!user) {
    user = await prisma.usuario.create({ data: {
      nombre: "Administrador", correo: email, estadoUsuario: true, permisoId: permiso.idPermiso,
      passwordHash: await (await import("./lib/password.js")).hashPassword(env.ADMIN_PASSWORD),
      debeCambiarContrasena: env.FORCE_PASSWORD_CHANGE,
    } });
    console.log("Admin inicial creado:", email);
  }
}

bootstrap().then(() => {
  app.listen(env.PORT, () => console.log(`Backend listening on ${env.PORT}`));
}).catch((e) => { console.error(e); process.exit(1); });
