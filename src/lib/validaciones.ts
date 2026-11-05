// ============================================================================
// Sistema Taller — Validadores (TASK-0007 / AG-008)
// ============================================================================
// Validaciones reutilizadas por los servicios (capa backend TS) y las
// pantallas: SOURCE_PROMPT.md — «Validar formularios en frontend y backend».
// Los mensajes son en español y prestados a mostrar al usuario.
// ============================================================================

import type { Cliente, EstadoOrden, MovimientoFinanciero, Producto, Servicio, Usuario, Venta, Garantia } from "./types";
import { ESTADOS_ORDEN as ESTADOS } from "./types";

export class ValidationError extends Error {
  campos: Record<string, string>;
  constructor(campos: Record<string, string>) {
    super("Datos inválidos");
    this.name = "ValidationError";
    this.campos = campos;
  }
}

export function esCorreo(valor?: string | null): boolean {
  if (!valor) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
}

export function esFechaISO(valor?: string | null): boolean {
  if (!valor) return false;
  return /^\d{4}-\d{2}-\d{2}/.test(valor) && !Number.isNaN(Date.parse(valor.slice(0, 10)));
}

export function esNumeroPositivo(valor: unknown, incluirCero = true): boolean {
  const n = Number(valor);
  if (!Number.isFinite(n)) return false;
  return incluirCero ? n >= 0 : n > 0;
}

function texto(valor: unknown, campo: string, campos: Record<string, string>, largoMax = 255): string {
  const t = typeof valor === "string" ? valor.trim() : "";
  if (!t) campos[campo] = "El campo es obligatorio.";
  else if (t.length > largoMax) campos[campo] = `Máximo ${largoMax} caracteres.`;
  return t;
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

export function validarCliente(c: Partial<Cliente>): Record<string, string> {
  const campos: Record<string, string> = {};
  if (c.nombre_cliente !== undefined) texto(c.nombre_cliente, "nombre_cliente", campos);
  if (c.correo !== undefined && !esCorreo(c.correo))
    campos.correo = "Correo electrónico inválido.";
  if (c.documento !== undefined && String(c.documento).trim().length < 4)
    campos.documento = "Documento inválido.";
  return campos;
}

// ---------------------------------------------------------------------------
// Productos
// ---------------------------------------------------------------------------

export function validarProducto(p: Partial<Producto>): Record<string, string> {
  const campos: Record<string, string> = {};
  if (p.descripcion !== undefined) texto(p.descripcion, "descripcion", campos);
  for (const [campo, nombre] of [
    ["precio_compra", "Precio de compra"],
    ["precio_venta", "Precio de venta"],
    ["stock", "Stock"],
    ["stock_minimo", "Stock mínimo"],
  ] as const) {
    if (p[campo] !== undefined && !esNumeroPositivo(p[campo]))
      campos[campo] = `${nombre}: número ≥ 0 requerido.`;
  }
  return campos;
}

// ---------------------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------------------

export function validarServicio(s: Partial<Servicio>): Record<string, string> {
  const campos: Record<string, string> = {};
  if (s.nombre !== undefined) texto(s.nombre, "nombre", campos);
  if (s.precio !== undefined && !esNumeroPositivo(s.precio))
    campos.precio = "Precio: número ≥ 0 requerido.";
  return campos;
}

// ---------------------------------------------------------------------------
// Garantías
// ---------------------------------------------------------------------------

export function validarGarantia(g: Partial<Garantia>): Record<string, string> {
  const campos: Record<string, string> = {};
  if (g.referencia !== undefined) texto(g.referencia, "referencia", campos);
  if (g.fecha_garantia !== undefined && !esFechaISO(g.fecha_garantia))
    campos.fecha_garantia = "Fecha inválida.";
  return campos;
}

// ---------------------------------------------------------------------------
// Órdenes de trabajo
// ---------------------------------------------------------------------------

export function validarOrden(o: {
  estado?: string | null;
  fecha_inicial?: string | null;
  fecha_final?: string | null;
  cliente_id?: string | null;
  usuario_id?: string | null;
}): Record<string, string> {
  const campos: Record<string, string> = {};
  if (!o.estado || !ESTADOS.includes(o.estado as EstadoOrden))
    campos.estado = "Estado de orden inválido.";
  if (!esFechaISO(o.fecha_inicial)) campos.fecha_inicial = "Fecha inicial inválida.";
  if (o.fecha_final && esFechaISO(o.fecha_inicial) && o.fecha_final < o.fecha_inicial.slice(0, 10))
    campos.fecha_final = "La fecha final no puede ser anterior a la inicial.";
  if (!o.cliente_id) campos.cliente_id = "Debe seleccionar un cliente.";
  if (!o.usuario_id) campos.usuario_id = "Debe seleccionar un usuario/técnico.";
  return campos;
}

// ---------------------------------------------------------------------------
// Ventas
// ---------------------------------------------------------------------------

export function validarVenta(v: Partial<Venta>): Record<string, string> {
  const campos: Record<string, string> = {};
  if (v.fecha_venta !== undefined && !esFechaISO(v.fecha_venta))
    campos.fecha_venta = "Fecha de venta inválida.";
  if (v.descuento !== undefined && !esNumeroPositivo(v.descuento))
    campos.descuento = "El descuento no puede ser negativo.";
  return campos;
}

// ---------------------------------------------------------------------------
// Movimientos financieros
// ---------------------------------------------------------------------------

export function validarMovimiento(m: Partial<MovimientoFinanciero>): Record<string, string> {
  const campos: Record<string, string> = {};
  if (m.descripcion !== undefined) texto(m.descripcion, "descripcion", campos);
  if (m.tipo !== undefined && m.tipo !== "ingreso" && m.tipo !== "egreso")
    campos.tipo = "Tipo inválido (ingreso o egreso).";
  if (m.valor !== undefined && !esNumeroPositivo(m.valor, false))
    campos.valor = "Valor debe ser mayor que cero.";
  if (m.pagado && !m.fecha_pago) campos.fecha_pago = "Un movimiento pagado requiere fecha de pago.";
  return campos;
}

// ---------------------------------------------------------------------------
// Usuarios
// ---------------------------------------------------------------------------

export function validarUsuario(u: Partial<Usuario>): Record<string, string> {
  const campos: Record<string, string> = {};
  if (u.nombre !== undefined) texto(u.nombre, "nombre", campos);
  if (u.correo !== undefined && !esCorreo(u.correo))
    campos.correo = "Correo electrónico inválido.";
  return campos;
}

/** Contraseña para la credencial de acceso (mínimo 6, SOURCE_PROMPT). */
export function validarContrasena(clave?: string | null): string | null {
  if (!clave || clave.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
  return null;
}

// ---------------------------------------------------------------------------
// Cola de emails
// ---------------------------------------------------------------------------

export function validarEmail(e: { para?: string | null; mensaje?: string | null; cc?: string | null }): Record<string, string> {
  const campos: Record<string, string> = {};
  if (!esCorreo(e.para)) campos.para = "Destinatario inválido.";
  const listaCC = (e as { cc?: string | null }).cc;
  const listaCCO = (e as { cco?: string | null }).cco;
  if (listaCC && !listaCC.split(",").every(esCorreo))
    campos.cc = "Correo inválido en CC.";
  if (listaCCO && !listaCCO.split(",").every(esCorreo))
    campos.cco = "Correo inválido en CCO.";
  return campos;
}

/** Lanza ValidationError si hay campos con error. */
export function asegurarValido(campos: Record<string, string>): void {
  if (Object.keys(campos).length > 0) throw new ValidationError(campos);
}
