import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword, validatePassword } from "../lib/password.js";
import { signAccess, signRefresh, verifyRefresh } from "../lib/jwt.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { HttpError } from "../middleware/error.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { v4 as uuidv4 } from "uuid";
// @ts-ignore

const r = Router();
const ALL_PERMS = ["vCliente","aCliente","eCliente","dCliente","vProducto","aProducto","eProducto","dProducto","vServicio","aServicio","eServicio","dServicio","vOrden","aOrden","eOrden","dOrden","vVenta","aVenta","eVenta","dVenta","vMovimiento","aMovimiento","eMovimiento","dMovimiento","vArchivo","aArchivo","eArchivo","dArchivo","vUsuario","aUsuario","eUsuario","dUsuario","vPermiso","aPermiso","ePermiso","dPermiso","vAuditoria","dAuditoria","vEmail","dEmail","cEmpresa","eEmpresa","vGarantia","aGarantia","eGarantia","dGarantia"];

// LOGIN admin
r.post("/login", asyncHandler(async (req, res) => {
  const { correo, contrasena } = req.body ?? {};
  const email = String(correo ?? "").trim().toLowerCase();
  const user = await prisma.usuario.findUnique({ where: { correo: email }, include: { permiso: true } });
  if (!user || !user.estadoUsuario) throw new HttpError(401, "Correo o contraseña incorrectos.");
  if (!user.passwordHash) throw new HttpError(401, "Correo o contraseña incorrectos.");
  const ok = await verifyPassword(String(contrasena ?? ""), user.passwordHash);
  if (!ok) throw new HttpError(401, "Correo o contraseña incorrectos.");
  const grupo = user.permiso;
  if (!grupo || !grupo.estado) throw new HttpError(401, "El usuario no tiene un grupo de permisos activo.");
  const permisos = Array.isArray(grupo.permisos) ? (grupo.permisos as string[]) : [];
  // session row
  let sessionId: string | undefined;
  try {
    const s = await prisma.sesion.create({ data: { usuarioId: user.idUsuario, tipo: "administrador", expiracion: new Date(Date.now() + 12*3600*1000) } });
    sessionId = s.idSesion;
  } catch {}
  const jti = uuidv4();
  const access = signAccess({ sub: user.idUsuario, tipo: "administrador", correo: user.correo, permisos, sessionId });
  const refresh = signRefresh({ sub: user.idUsuario, tipo: "administrador", jti });
  res.json({ accessToken: access, refreshToken: refresh, user: { id: user.idUsuario, correo: user.correo, nombre: user.nombre, permisos, debeCambiarContrasena: user.debeCambiarContrasena } });
}));

// PORTAL login (correo + documento)
r.post("/portal-login", asyncHandler(async (req, res) => {
  const { correo, documento } = req.body ?? {};
  const cliente = await prisma.cliente.findFirst({ where: { correo: { equals: String(correo ?? "").trim(), mode: "insensitive" }, documento: String(documento ?? "").trim() } });
  if (!cliente) throw new HttpError(401, "Los datos no coinciden con un cliente registrado.");
  // find/create usuario? no; issue client token directly
  const jti = uuidv4();
  const access = signAccess({ sub: cliente.idCliente, tipo: "cliente", correo: cliente.correo ?? "", permisos: [], sessionId: undefined });
  const refresh = signRefresh({ sub: cliente.idCliente, tipo: "cliente", jti });
  // session row
  try { await prisma.sesion.create({ data: { clienteId: cliente.idCliente, tipo: "cliente", expiracion: new Date(Date.now() + 24*3600*1000) } }); } catch {}
  res.json({ accessToken: access, refreshToken: refresh, cliente: { id_cliente: cliente.idCliente, nombre_cliente: cliente.nombreCliente } });
}));

r.post("/refresh", asyncHandler(async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) throw new HttpError(400, "Falta refreshToken.");
  let payload: any;
  try { payload = verifyRefresh(refreshToken); } catch { throw new HttpError(401, "Refresh token inválido."); }
  // issue new access
  if (payload.tipo === "administrador") {
    const user = await prisma.usuario.findUnique({ where: { idUsuario: payload.sub }, include: { permiso: true } });
    if (!user || !user.estadoUsuario) throw new HttpError(401, "Usuario inactivo.");
    const permisos = Array.isArray(user.permiso?.permisos) ? (user.permiso!.permisos as string[]) : [];
    const access = signAccess({ sub: user.idUsuario, tipo: "administrador", correo: user.correo, permisos });
    res.json({ accessToken: access, refreshToken });
  } else {
    const cliente = await prisma.cliente.findUnique({ where: { idCliente: payload.sub } });
    if (!cliente) throw new HttpError(401, "Cliente no encontrado.");
    const access = signAccess({ sub: cliente.idCliente, tipo: "cliente", correo: cliente.correo ?? "", permisos: [] });
    res.json({ accessToken: access, refreshToken });
  }
}));

r.post("/logout", requireAuth, asyncHandler(async (req, res) => {
  // revoke not tracked; just 200
  res.json({ ok: true });
}));

r.get("/me", requireAuth, asyncHandler(async (req: any, res) => {
  if (req.user.tipo === "administrador") {
    const user = await prisma.usuario.findUnique({ where: { idUsuario: req.user.id }, include: { permiso: true } });
    res.json({ tipo: "administrador", user, permisos: req.user.permisos, debeCambiarContrasena: user?.debeCambiarContrasena });
  } else {
    const cliente = await prisma.cliente.findUnique({ where: { idCliente: req.user.id } });
    res.json({ tipo: "cliente", cliente, permisos: [] });
  }
}));

r.post("/change-password", requireAuth, asyncHandler(async (req: any, res) => {
  const { actual, nueva } = req.body ?? {};
  if (req.user.tipo !== "administrador") throw new HttpError(400, "Solo administradores.");
  const user = await prisma.usuario.findUnique({ where: { idUsuario: req.user.id } });
  if (!user?.passwordHash) throw new HttpError(400, "Sin credencial.");
  const ok = await verifyPassword(String(actual ?? ""), user.passwordHash);
  if (!ok) throw new HttpError(400, "Contraseña actual incorrecta.");
  const err = validatePassword(String(nueva ?? ""));
  if (err) throw new HttpError(400, err);
  await prisma.usuario.update({ where: { idUsuario: user.idUsuario }, data: { passwordHash: await hashPassword(String(nueva)), debeCambiarContrasena: false } });
  res.json({ ok: true });
}));

r.post("/finalizar-cambio-contrasena", requireAuth, asyncHandler(async (req: any, res) => {
  if (req.user.tipo === "administrador") {
    await prisma.usuario.update({ where: { idUsuario: req.user.id }, data: { debeCambiarContrasena: false } });
  }
  res.json({ ok: true });
}));

// forgot/reset stubs
r.post("/forgot-password", asyncHandler(async (_req, res) => { res.json({ ok: true }); }));
r.post("/reset-password", asyncHandler(async (_req, res) => { res.json({ ok: true }); }));


r.post("/crear-credencial", requireAuth, requirePermission("aUsuario"), asyncHandler(async (req, res) => {
  const { correo, contrasena } = req.body ?? {};
  const { hashPassword, validatePassword } = await import("../lib/password.js");
  const err = validatePassword(String(contrasena ?? ""));
  if (err) throw new HttpError(400, err);
  const user = await prisma.usuario.findUnique({ where: { correo: String(correo).trim().toLowerCase() } });
  if (!user) throw new HttpError(404, "Usuario no encontrado.");
  await prisma.usuario.update({ where: { idUsuario: user.idUsuario }, data: { passwordHash: await hashPassword(String(contrasena)) } });
  res.json({ ok: true });
}));


r.post("/force-change-password", requireAuth, asyncHandler(async (req: any, res) => {
  const { nueva } = req.body ?? {};
  const { validatePassword, hashPassword } = await import("../lib/password.js");
  const err = validatePassword(String(nueva ?? ""));
  if (err) throw new HttpError(400, err);
  if (req.user.tipo !== "administrador") throw new HttpError(400, "Solo administradores.");
  await prisma.usuario.update({ where: { idUsuario: req.user.id }, data: { passwordHash: await hashPassword(String(nueva)), debeCambiarContrasena: false } });
  res.json({ ok: true });
}));

export default r;
