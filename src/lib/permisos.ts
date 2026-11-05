// ============================================================================
// Sistema Taller — Códigos de actividad y permisos (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §11: los permisos se almacenan como códigos de actividad.
//   a = agregar, e = editar, d = eliminar, v = visualizar, r = reporte,
//   c = configuración.
// Módulos cubiertos: Cliente, Producto, Servicio, Orden, Venta, Garantía,
//   Movimiento, Archivo, Usuario, Permiso, Respaldo, Auditoría, Email,
//   Empresa.
// Ejemplos: aCliente, eCliente, dCliente, vCliente, rCliente; aProducto…
// ============================================================================

export const ACCIONES = ["a", "e", "d", "v", "r", "c"] as const;
export type Accion = (typeof ACCIONES)[number];

export const DESCRIPCION_ACCIONES: Record<Accion, string> = {
  a: "agregar",
  e: "editar",
  d: "eliminar",
  v: "visualizar",
  r: "reporte",
  c: "configuración",
};

export const MODULOS = [
  "Cliente",
  "Producto",
  "Servicio",
  "Orden",
  "Venta",
  "Garantia",
  "Movimiento",
  "Archivo",
  "Usuario",
  "Permiso",
  "Respaldo",
  "Auditoria",
  "Email",
  "Empresa",
] as const;
export type Modulo = (typeof MODULOS)[number];

export const DESCRIPCION_MODULOS: Record<Modulo, string> = {
  Cliente: "Clientes",
  Producto: "Productos",
  Servicio: "Servicios",
  Orden: "Órdenes de trabajo",
  Venta: "Ventas",
  Garantia: "Garantías",
  Movimiento: "Movimientos financieros",
  Archivo: "Archivos/Documentos",
  Usuario: "Usuarios",
  Permiso: "Permisos",
  Respaldo: "Respaldo",
  Auditoria: "Auditoría",
  Email: "Cola de emails",
  Empresa: "Configuración de empresa",
};

/** Código completo, p. ej. codigo("a", "Cliente") → "aCliente". */
export function codigo(accion: Accion, modulo: Modulo): string {
  return `${accion}${modulo}`;
}

/** Todos los códigos de un módulo (a, e, d, v, r, c). */
export function codigosModulo(modulo: Modulo): string[] {
  return ACCIONES.map((a) => codigo(a, modulo));
}

/** La lista completa de códigos (para plantillas de permisos). */
export function todosLosCodigos(): string[] {
  return MODULOS.flatMap((m) => codigosModulo(m));
}

/** ¿El conjunto de permisos incluye un código exacto? */
export function tienePermiso(codigos: string[] | null | undefined, requerido: string): boolean {
  if (!codigos?.length) return false;
  return codigos.includes(requerido);
}

/** ¿Incluye alguno de los códigos pedidos (acceso a un módulo)? */
export function tieneAlgunPermiso(
  codigos: string[] | null | undefined,
  requeridos: string[],
): boolean {
  if (!requeridos.length) return true;
  return requeridos.some((r) => tienePermiso(codigos, r));
}

/** Filtra la lista de códigos eliminando vacíos y duplicados. */
export function normalizarCodigos(codigos: string[]): string[] {
  const resultado: string[] = [];
  const vistos = new Set<string>();
  for (const c of codigos) {
    const limpio = (c ?? "").trim();
    if (!limpio || vistos.has(limpio)) continue;
    vistos.add(limpio);
    resultado.push(limpio);
  }
  return resultado;
}
