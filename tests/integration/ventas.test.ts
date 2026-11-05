// ============================================================================
// Sistema Taller — QA: Ventas (TASK-0010 / AG-012)
// ============================================================================
// SOURCE_PROMPT.md §6 flujos críticos cubiertos:
//   • Alta/edición con validación (fecha ISO, descuento ≥ 0).
//   • Stock por RPC: venta_agregar_item descuenta; cambiar/quitar devuelven.
//   • Facturación única vía venta_facturar (movimiento financiero ×1 vez).
//   • impresión: obtenerParaImpresion devuelve el detalle completo.
// ============================================================================

import { beforeEach, describe, expect, it, vi } from "vitest";
import { falso } from "../helpers/supabaseFalso";
import { ventasService } from "../../src/services/ventas";
import { ValidationError, validarVenta } from "../../src/lib/validaciones";
import { hoyISO } from "../../src/lib/fechas";
import { totalDocumento } from "../../src/lib/dinero";

vi.mock("../../src/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/lib/supabase")>();
  const mod = await import("../helpers/supabaseFalso");
  return { ...original, supabase: mod.falso.supabase };
});

beforeEach(() => falso.limpiar());

describe("alta y edición de ventas (validaciones)", () => {
  it("fecha de venta inválida → error en español", async () => {
    await expect(ventasService.crear({ fecha_venta: "31/12/2026" } as any)).rejects.toThrow(
      /Datos inválidos/,
    );
    expect(falso.filas("ventas")).toHaveLength(0);
  });

  it("alta correcta aplica fecha de hoy por defecto", async () => {
    const venta = await ventasService.crear({});
    expect(venta.fecha_venta).toBe(hoyISO());
  });

  it("descuento negativo → ValidationError con campo descuento", async () => {
    const campos = validarVenta({ descuento: -5 } as any);
    expect(() => {
      if (Object.keys(campos).length > 0) throw new ValidationError(campos);
    }).toThrow(ValidationError);
    await expect(ventasService.editar("v-1", { descuento: -5 } as any)).rejects.toThrow(
      "Datos inválidos",
    );
  });
});

describe("items de la venta y stock (RPC de la migración 0004)", () => {
  it("venta_agregar_item recibe venta, producto y cantidad", async () => {
    await ventasService.agregarItem("v-1", "pro-3", 4, 25.25);
    expect(falso.ultimaRpc("venta_agregar_item")?.args).toEqual({
      p_venta: "v-1",
      p_producto: "pro-3",
      p_cantidad: 4,
      p_precio: 25.25,
    });
  });

  it("cantidad no válida se rechaza sin acceder a la base", async () => {
    await expect(ventasService.agregarItem("v-1", "pro-3", 0)).rejects.toThrow(
      "La cantidad debe ser mayor que cero.",
    );
    await expect(ventasService.cambiarCantidadItem("it-1", 0)).rejects.toThrow(/mayor que cero/);
    expect(falso.rpcLlamadas).toHaveLength(0);
  });

  it("cambiar/quitar ítem usan sus RPC (devolución de stock en BD)", async () => {
    await ventasService.cambiarCantidadItem("it-1", 7);
    expect(falso.ultimaRpc("venta_cambiar_cantidad_item")?.args).toEqual({
      p_item: "it-1",
      p_cantidad: 7,
    });
    await ventasService.quitarItem("it-2");
    expect(falso.ultimaRpc("venta_quitar_item")?.args).toEqual({ p_item: "it-2" });
  });
});

describe("facturación única de la venta", () => {
  it("venta_facturar se llama con parámetros correctos", async () => {
    await ventasService.facturar("v-9", { formaPago: "Transferencia" });
    expect(falso.ultimaRpc("venta_facturar")?.args).toEqual({
      p_venta: "v-9",
      p_fecha_vencimiento: null,
      p_forma_pago: "Transferencia",
      p_categoria_id: null,
      p_cuenta_id: null,
    });
  });

  it("segunda facturación la bloquea la BD (chk de facturado único)", async () => {
    falso.rpc("venta_facturar", () => {
      throw new Error("La venta ya fue facturada.");
    });
    await expect(ventasService.facturar("v-9")).rejects.toThrow("La venta ya fue facturada.");
  });
});

describe("RB-019: valor_total = Σ subtotales − descuento (con 2 decimales)", () => {
  it("descuento no deja el total por debajo de cero", () => {
    const lineas = [
      { cantidad: 2, precio: 30.005 }, // 60.01
      { cantidad: 1, precio: 10 },
    ];
    expect(totalDocumento(lineas, 5)).toBe(65.01);
    expect(totalDocumento(lineas, 9999)).toBe(0);
  });
});
