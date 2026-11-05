// ============================================================================
// Sistema Taller — Utilidades monetarias (TASK-0007 / AG-008)
// ============================================================================
// Reglas de negocio (SOURCE_PROMPT.md): valores monetarios con 2 decimales.
// Las RPC de la base de datos ya redondean con round(x, 2); aquí se aplica la
// misma convención para las validaciones y cálculos en el cliente con el fin
// de que el resultado live siempre coincide con el almacenado.
// ============================================================================

/** Redondea un número a 2 decimales (mitad arriba, como round() de Postgres
 *  para valores positivos). Elimina el error binario típico (0.1 + 0.2). */
export function redondear(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Subtotal de una línea: cantidad × precio, redondeado a 2 decimales. */
export function subtotalLinea(cantidad: number, precio: number): number {
  return redondear(cantidad * precio);
}

/** Total de un documento (orden o venta) a partir de sus líneas. */
export function totalDocumento(
  lineas: { cantidad: number; precio: number }[],
  descuento = 0,
): number {
  const bruto = lineas.reduce((acc, l) => acc + subtotalLinea(l.cantidad, l.precio), 0);
  return redondear(Math.max(0, bruto - descuento));
}

/** Descuento máximo aplicable: no puede superar el bruto. */
export function descuentoMaximo(lineas: { cantidad: number; precio: number }[]): number {
  const bruto = lineas.reduce((acc, l) => acc + subtotalLinea(l.cantidad, l.precio), 0);
  return redondear(bruto);
}

/** Análisis de un monto escrito por el usuario: acepta coma decimal. */
export function parseMonto(texto: string | number | null | undefined): number {
  if (typeof texto === "number") return redondear(texto);
  if (!texto) return 0;
  const limpio = String(texto).trim().replace(/\s/g, "").replace(",", ".");
  const n = Number(limpio);
  return Number.isFinite(n) ? redondear(n) : 0;
}

/** Formato monetario de pantalla: 2 decimales (separador de miles simple). */
export function formatoDinero(valor: number | null | undefined): string {
  const n = redondear(valor ?? 0);
  return n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
