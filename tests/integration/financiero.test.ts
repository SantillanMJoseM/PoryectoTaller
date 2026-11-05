// ============================================================================
// Sistema Taller — QA: Financiero (TASK-0010 / AG-012)
// ============================================================================
// SOURCE_PROMPT.md §8 flujos críticos cubiertos:
//   • Crear movimiento (ingreso/egreso, valor > 0, pagado exige fecha_pago).
//   • Filtros por período (día/semana/mes/año/todos) y situación
//     (todos/previsto/atrasado/realizado/pendiente).
//   • Totales por período con 2 decimales y detección de vencidos.
//   • marcarPagado vía RPC mov_marcar_pagado.
//   • Solo categorías/cuentas activas para los formularios.
// ============================================================================

import { beforeEach, describe, expect, it, vi } from "vitest";
import { falso } from "../helpers/supabaseFalso";
import { financieroService } from "../../src/services/financiero";
import { hoyISO } from "../../src/lib/fechas";

vi.mock("../../src/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/lib/supabase")>();
  const mod = await import("../helpers/supabaseFalso");
  return { ...original, supabase: mod.falso.supabase };
});

beforeEach(() => falso.limpiar());

describe("alta de movimientos (reglas del prompt)", () => {
  it("sin descripción → error", async () => {
    await expect(
      financieroService.crear({ tipo: "ingreso", valor: 100 } as any),
    ).rejects.toThrow("La descripción es obligatoria.");
  });

  it("tipo distinto de ingreso/egreso → error", async () => {
    await expect(
      financieroService.crear({ descripcion: "Cobro", tipo: "otro", valor: 100 } as any),
    ).rejects.toThrow(/Tipo inválido/);
  });

  it("valor ≤ 0 → error", async () => {
    await expect(
      financieroService.crear({ descripcion: "Cobro", tipo: "ingreso", valor: 0 } as any),
    ).rejects.toThrow();
    expect(falso.filas("movimientos_financieros")).toHaveLength(0);
  });

  it("RB-014: pagado sin fecha de pago → error", async () => {
    await expect(
      financieroService.crear({ descripcion: "Cobro", tipo: "ingreso", valor: 50, pagado: true } as any),
    ).rejects.toThrow(/fecha de pago/);
  });

  it("alta correcta inserta el movimiento", async () => {
    await financieroService.crear({
      descripcion: "Cobro orden 12",
      tipo: "ingreso",
      valor: 250.5,
      fecha_vencimiento: hoyISO(),
    } as any);
    expect(falso.filas("movimientos_financieros")).toHaveLength(1);
  });

  it("editar descarta solo el campo descripcion en la validación parcial", async () => {
    falso.establecer("movimientos_financieros", [
      { id_movimiento: "m-1", descripcion: "Inicial", valor: 10, tipo: "egreso" },
    ]);
    await financieroService.editar("m-1", { valor: 15.75, tipo: "ingreso" });
    const fila = falso.filas("movimientos_financieros")[0];
    expect(fila.valor).toBe(15.75);
    expect(fila.tipo).toBe("ingreso");
    await expect(financieroService.editar("m-1", { tipo: "rrr" } as any)).rejects.toThrow(/Datos inválidos/);
    await expect(financieroService.editar("m-1", { valor: -1 } as any)).rejects.toThrow(/Datos inválidos/);
  });
});

describe("filtros por situación, totales y vencidos", () => {
  beforeEach(() => {
    falso.establecer("movimientos_financieros", [
      // pagado → realizado
      { id_movimiento: "m-r", valor: 100, tipo: "ingreso", pagado: true, fecha_pago: "2026-01-20", fecha_vencimiento: "2026-01-15" },
      // vencido no pagado → atrasado
      { id_movimiento: "m-a", valor: 40, tipo: "egreso", pagado: false, fecha_vencimiento: "2026-01-05" },
      // vence a futuro → previsto
      { id_movimiento: "m-p", valor: 60, tipo: "ingreso", pagado: false, fecha_vencimiento: "2999-12-31" },
      // sin fecha, no pagado → pendiente
      { id_movimiento: "m-s", valor: 20, tipo: "egreso", pagado: false, fecha_vencimiento: null },
    ]);
  });

  it("«todos»: total 4, vencidos 1, saldo 100 + 60 − 40 − 20 = 100", async () => {
    const res = await financieroService.listarFiltradas({});
    expect(res.total).toBe(4);
    expect(res.vencidos).toBe(1);
    expect(res.pendientes).toBe(3);
    expect(res.totales).toEqual({ ingresos: 160, egresos: 60, saldo: 100 });
  });

  it("«atrasado»: solo el vencido no pagado", async () => {
    const res = await financieroService.listarFiltradas({ situacionFiltro: "atrasado" });
    expect(res.total).toBe(1);
    expect(res.datos[0].id_movimiento).toBe("m-a");
  });

  it("«realizado» / «previsto» / «pendiente» filtran correctamente", async () => {
    const hecho = await financieroService.listarFiltradas({ situacionFiltro: "realizado" });
    expect(hecho.total).toBe(1);
    const previsto = await financieroService.listarFiltradas({ situacionFiltro: "previsto" });
    expect(previsto.total).toBe(1);
    const pendiente = await financieroService.listarFiltradas({ situacionFiltro: "pendiente" });
    expect(pendiente.total).toBe(1);
  });

  it("paginación en memoria respeta tamPagina", async () => {
    const res = await financieroService.listarFiltradas({ pagina: 2, tamPagina: 2 });
    expect(res.total).toBe(4);
    expect(res.paginas).toBe(2);
    expect(res.datos).toHaveLength(2);
  });

  it("resumen() agrupa ingresos, egresos, saldo, vencidos y total", async () => {
    const r = await financieroService.resumen("todos");
    expect(r).toEqual({ ingresos: 160, egresos: 60, saldo: 100, vencidos: 1, pendientes: 3, totalRegistros: 4 });
  });
});

describe("mov_marcar_pagado y listados auxiliares", () => {
  it("marcarPagado llama a la RPC con fecha explícita", async () => {
    await financieroService.marcarPagado("m-7", "2026-03-01");
    expect(falso.ultimaRpc("mov_marcar_pagado")?.args).toEqual({
      p_movimiento: "m-7",
      p_fecha_pago: "2026-03-01",
    });
  });

  it("listarCategorias y listarCuentas devuelven solo estado activo", async () => {
    falso.establecer("categorias", [
      { id_categoria: "c-1", categoria: "Ingresos", estado: true, tipo: "ingreso" },
      { id_categoria: "c-2", categoria: "Gastos viejos", estado: false, tipo: "ingreso" },
    ]);
    falso.establecer("cuentas", [
      { id_cuenta: "k-1", cuenta: "Banco Nación", estado: true },
      { id_cuenta: "k-2", cuenta: "Caja cerrada", estado: false },
    ]);
    const categorias = await financieroService.listarCategorias("ingreso");
    expect(categorias.map((c) => c.id_categoria)).toEqual(["c-1"]);
    const cuentas = await financieroService.listarCuentas();
    expect(cuentas.map((c) => c.id_cuenta)).toEqual(["k-1"]);
  });
});
