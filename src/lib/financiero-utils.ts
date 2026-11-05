// ============================================================================
// Sistema Taller — Reglas puras del módulo Financiero (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §8:
//   • Filtros por período: día, semana, mes, año, todos.
//   • Filtros por situación: todos, previsto, atrasado, realizado, pendiente.
//   • Totales por período, detección de vencidos.
// Funciones puras (sin acceso a Supabase) para disfrutar testing unitario;
// la consulta de datos vive en src/services/financiero.ts.
// ============================================================================

import { estaVencido, rangoPeriodo, type Periodo } from "./fechas";

export const SITUACIONES = [
  "todos",
  "previsto",
  "atrasado",
  "realizado",
  "pendiente",
] as const;
export type Situacion = (typeof SITUACIONES)[number];

export type EstadoSituacion = "realizado" | "atrasado" | "previsto" | "pendiente";

/** Situación de un movimiento (coincide con la vista v_movimientos_situacion):
 *  • pagado                 → realizado
 *  • vencido (no pagado)    → atrasado
 *  • vence a futuro         → previsto
 *  • vence hoy y no pagado  → pendiente */
export function situacion(mov: {
  pagado?: boolean | null;
  fecha_vencimiento?: string | null;
}): EstadoSituacion {
  if (mov.pagado) return "realizado";
  if (!mov.fecha_vencimiento) return "pendiente";
  if (estaVencido(mov.fecha_vencimiento, false)) return "atrasado";
  const venc = mov.fecha_vencimiento.slice(0, 10);
  const hoy = new Date();
  const isoHoy = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(
    hoy.getDate(),
  ).padStart(2, "0")}`;
  return venc > isoHoy ? "previsto" : "pendiente";
}

/** ¿El movimiento pasa el filtro de situación pedido? */
export function pasaSituacion(
  mov: { pagado?: boolean | null; fecha_vencimiento?: string | null },
  filtro: Situacion,
): boolean {
  if (filtro === "todos") return true;
  return situacion(mov) === filtro;
}

/** Rango por período + tipos (para los filtros del módulo Financiero). */
export function filtrosPeriodo(periodo: Periodo): { fechaInicial: string | null; fechaFinal: string | null } {
  return rangoPeriodo(periodo);
}

export interface TotalPorTipo {
  ingresos: number;
  egresos: number;
  saldo: number;
}

/** Totales por período: ingresos, egresos y saldo (2 decimales). */
export function resumenTotales(
  movimientos: { valor: number; tipo: "ingreso" | "egreso" }[],
): TotalPorTipo {
  const redondear = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  const ingresos = redondear(
    movimientos.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + Number(m.valor ?? 0), 0),
  );
  const egresos = redondear(
    movimientos.filter((m) => m.tipo === "egreso").reduce((a, m) => a + Number(m.valor ?? 0), 0),
  );
  return { ingresos, egresos, saldo: redondear(ingresos - egresos) };
}

/** ¿Hay vencidos? (alerta de detección de vencidos) */
export function hayVencidos(
  movimientos: { pagado?: boolean | null; fecha_vencimiento?: string | null }[],
): boolean {
  return movimientos.some((m) => !m.pagado && estaVencido(m.fecha_vencimiento, false));
}
