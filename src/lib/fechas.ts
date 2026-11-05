// ============================================================================
// Sistema Taller — Utilidades de fecha (TASK-0007 / AG-008)
// ============================================================================
// Regla de negocio: las fechas se muestran en formato dd/mm/aaaa.
// Filtros del módulo Financiero por período: día, semana, mes, año, todos.
// ============================================================================

/** yyyy-mm-dd → dd/mm/aaaa. Tolera timestamps (ignora la hora). */
export function formatoFecha(valor?: string | null): string {
  if (!valor) return "";
  const d = valor.slice(0, 10); // yyyy-mm-dd
  const [y, m, dia] = d.split("-");
  if (!y || !m || !dia) return valor;
  return `${dia.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/** dd/mm/aaaa → yyyy-mm-dd (para inputs y consultas). */
export function fromFormatoFecha(valor: string): string {
  const [dia, mes, anio] = valor.split("/");
  if (anio && mes && dia) return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  return valor;
}

/** Fecha de hoy como yyyy-mm-dd (fecha local, sin desfase UTC). */
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export type Periodo = "dia" | "semana" | "mes" | "anio" | "todos";

/** Rango [fechaInicial, fechaFinal] para un período (formato yyyy-mm-dd).
 *  "todos" devuelve rango nulo (sin filtro). */
export function rangoPeriodo(periodo: Periodo): { fechaInicial: string | null; fechaFinal: string | null } {
  if (periodo === "todos") return { fechaInicial: null, fechaFinal: null };
  const d = new Date();
  const iso = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const inicio = new Date(d);
  switch (periodo) {
    case "dia":
      return { fechaInicial: iso(d), fechaFinal: iso(d) };
    case "semana": {
      const dow = (d.getDay() + 6) % 7; // lunes = 0
      inicio.setDate(d.getDate() - dow);
      const fin = new Date(inicio);
      fin.setDate(inicio.getDate() + 6);
      return { fechaInicial: iso(inicio), fechaFinal: iso(fin) };
    }
    case "mes":
      inicio.setDate(1);
      {
        const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return { fechaInicial: iso(inicio), fechaFinal: iso(fin) };
      }
    case "anio":
      return {
        fechaInicial: `${d.getFullYear()}-01-01`,
        fechaFinal: `${d.getFullYear()}-12-31`,
      };
  }
}

/** ¿Es fecha_vencimiento < hoy y no pagado? (vencidos — financiero). */
export function estaVencido(fechaVencimiento?: string | null, pagado?: boolean): boolean {
  if (pagado) return false;
  if (!fechaVencimiento) return false;
  const venc = new Date(`${fechaVencimiento.slice(0, 10)}T00:00:00`);
  const hoy = new Date(`${hoyISO()}T00:00:00`);
  return venc.getTime() < hoy.getTime();
}
