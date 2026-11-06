// ============================================================================
// Sistema Taller — Utilidades monetarias (TASK-0007 / AG-008)
// ============================================================================
// Reglas de negocio (SOURCE_PROMPT.md): valores monetarios con 2 decimales.
// Las RPC de la base de datos ya redondean con round(x, 2); aquí se aplica la
// misma convención para las validaciones y cálculos en el cliente con el fin
// de que el resultado live siempre coincide con el almacenado.
// ============================================================================

/** Redondea a 2 decimales con desempate hacia arriba, como round(x,2) de
 *  Postgres. La minúscula tolerancia corrige el sesgo binario de valores como
 *  123.455 (en binario 12345.4999…), de modo que el valor en pantalla
 *  coincide siempre con el almacenado. */
export function redondear(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  const escalado = valor * 100;
  return Math.round(escalado + 1e-6) / 100;
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

/** Análisis de un monto escrito por el usuario: acepta coma decimal
 *  («10,50») y separador de miles con puntos («1.234,56»). */
export function parseMonto(texto: string | number | null | undefined): number {
  if (typeof texto === "number") return redondear(texto);
  if (!texto) return 0;
  let limpio = String(texto).trim().replace(/\s/g, "");
  if (limpio.includes(",")) {
    // coma decimal → quitar puntos de miles y convertir coma en punto
    limpio = limpio.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(limpio);
  return Number.isFinite(n) ? redondear(n) : 0;
}

/** Formato monetario de pantalla: 2 decimales (separador de miles simple). */
export function formatoDinero(valor: number | null | undefined): string {
  const n = redondear(valor ?? 0);
  const partes = n.toFixed(2).split(".");
  const entero = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${entero},${partes[1]}`;
}
