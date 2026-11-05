import { describe, it, expect } from "vitest";
import {
  formatoFecha,
  fromFormatoFecha,
  rangoPeriodo,
  estaVencido,
  hoyISO,
} from "../lib/fechas";

describe("fechas (regla: mostrar dd/mm/aaaa)", () => {
  it("convierte ISO a dd/mm/aaaa", () => {
    expect(formatoFecha("2026-11-05")).toBe("05/11/2026");
    expect(formatoFecha("2026-11-05T12:30:00Z")).toBe("05/11/2026");
    expect(formatoFecha(null)).toBe("");
  });

  it("convierte dd/mm/aaaa a ISO", () => {
    expect(fromFormatoFecha("05/11/2026")).toBe("2026-11-05");
    // passthrough
    expect(fromFormatoFecha("2026-11-05")).toBe("2026-11-05");
  });

  it("hoyISO es una fecha local sin desfase", () => {
    expect(hoyISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rango del período día es el día", () => {
    const { fechaInicial, fechaFinal } = rangoPeriodo("dia");
    expect(fechaInicial).toBe(hoyISO());
    expect(fechaFinal).toBe(hoyISO());
  });

  it("período todos devuelve rango nulo (sin filtro)", () => {
    expect(rangoPeriodo("todos")).toEqual({ fechaInicial: null, fechaFinal: null });
  });

  it("rango del mes abarca primer y último día", () => {
    const r = rangoPeriodo("mes");
    expect(r.fechaInicial?.endsWith("-01")).toBe(true);
  });

  it("rango del año cubre enero–diciembre", () => {
    const r = rangoPeriodo("anio");
    expect(r.fechaInicial).toBe(`${new Date().getFullYear()}-01-01`);
    expect(r.fechaFinal).toBe(`${new Date().getFullYear()}-12-31`);
  });
});

describe("estaVencido (detección de vencidos — financiero)", () => {
  it("vence con fecha anterior a hoy y no pagado", () => {
    expect(estaVencido("2000-01-01", false)).toBe(true);
  });
  it("no está vencido si está pagado", () => {
    expect(estaVencido("2000-01-01", true)).toBe(false);
  });
  it("no está vencido si vence hoy o a futuro", () => {
    expect(estaVencido(hoyISO(), false)).toBe(false);
    expect(estaVencido("2999-01-01", false)).toBe(false);
  });
  it("sin fecha de vencimiento no hay vencido", () => {
    expect(estaVencido(null, false)).toBe(false);
  });
});
