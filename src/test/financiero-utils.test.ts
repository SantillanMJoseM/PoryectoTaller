import { describe, it, expect } from "vitest";
import { situacion, pasaSituacion, resumenTotales, hayVencidos } from "../lib/financiero-utils";
import { hoyISO } from "../lib/fechas";

describe("situación de movimientos (view v_movimientos_situacion)", () => {
  it("pagado → realizado", () => {
    expect(situacion({ pagado: true, fecha_vencimiento: "2020-01-01" })).toBe("realizado");
  });
  it("no pagado y pasado → atrasado", () => {
    expect(situacion({ pagado: false, fecha_vencimiento: "2020-01-01" })).toBe("atrasado");
  });
  it("no pagado, vence futuro → previsto", () => {
    expect(situacion({ pagado: false, fecha_vencimiento: "2999-01-01" })).toBe("previsto");
  });
  it("no pagado, vence hoy → pendiente", () => {
    expect(situacion({ pagado: false, fecha_vencimiento: hoyISO() })).toBe("pendiente");
  });
  it("sin fecha y no pagado → pendiente", () => {
    expect(situacion({ pagado: false, fecha_vencimiento: null })).toBe("pendiente");
  });

  it("el filtro de situación respeta las opciones del módulo", () => {
    const pendiente = { pagado: false, fecha_vencimiento: hoyISO() };
    const pasado = { pagado: false, fecha_vencimiento: "2020-01-01" };
    expect(pasaSituacion(pendiente, "todos")).toBe(true);
    expect(pasaSituacion(pasado, "atrasado")).toBe(true);
    expect(pasaSituacion(pasado, "realizado")).toBe(false);
  });
});

describe("totales por período", () => {
  it("ingresos − egresos = saldo con 2 decimales", () => {
    const t = resumenTotales([
      { valor: 100, tipo: "ingreso" },
      { valor: 40.5, tipo: "egreso" },
      { valor: 25.25, tipo: "ingreso" },
    ]);
    expect(t.ingresos).toBe(125.25);
    expect(t.egresos).toBe(40.5);
    expect(t.saldo).toBe(84.75);
  });

  it("lista vacía → todo cero", () => {
    expect(resumenTotales([])).toEqual({ ingresos: 0, egresos: 0, saldo: 0 });
  });
});

describe("detección de vencidos", () => {
  const hoy = hoyISO();
  it("hay vencidos si existe uno no pagado y pasado", () => {
    expect(hayVencidos([{ pagado: false, fecha_vencimiento: "2020-01-01" }, { pagado: true }])).toBe(true);
  });
  it("no hay vencidos solo con pendientes a futuro", () => {
    expect(hayVencidos([{ pagado: false, fecha_vencimiento: "2999-01-01" }])).toBe(false);
    expect(hayVencidos([{ pagado: false, fecha_vencimiento: hoy }])).toBe(false);
  });
});
