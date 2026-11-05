import { describe, it, expect } from "vitest";
import {
  redondear,
  subtotalLinea,
  totalDocumento,
  parseMonto,
  formatoDinero,
  descuentoMaximo,
} from "../lib/dinero";

describe("dinero (regla: valores con 2 decimales)", () => {
  it("redondea a 2 decimales sin error binario", () => {
    expect(redondear(0.1 + 0.2)).toBe(0.3);
    expect(redondear(123.455)).toBe(123.46);
    expect(redondear(Math.round(10.999 * 100) / 100 * 1000)).toBe(1099.9);
  });

  it("calcula subtotales cantidad × precio", () => {
    expect(subtotalLinea(3, 10.55)).toBe(31.65);
    expect(subtotalLinea(0, 5)).toBe(0);
  });

  it("total de documento con descuento (venta: bruto − descuento)", () => {
    const lineas = [
      { cantidad: 2, precio: 50 },
      { cantidad: 1, precio: 100 },
    ];
    expect(totalDocumento(lineas, 20)).toBe(180);
    expect(totalDocumento(lineas)).toBe(200);
  });

  it("el total nunca es negativo aunque el descuento exceda el bruto", () => {
    expect(totalDocumento([{ cantidad: 1, precio: 10 }], 99)).toBe(0);
  });

  it("descuento máximo permitido = bruto", () => {
    expect(descuentoMaximo([{ cantidad: 2, precio: 12.5 }])).toBe(25);
  });

  it("parse de montos del usuario acepta coma decimal y rechaza basura", () => {
    expect(parseMonto("1.234,56")).toBe(1.234);
    expect(parseMonto("10,50")).toBe(10.5);
    expect(parseMonto("")).toBe(0);
    expect(parseMonto("abc")).toBe(0);
    expect(parseMonto(12.345)).toBe(12.35);
  });

  it("formato de pantalla con 2 decimales", () => {
    expect(formatoDinero(1234.5).endsWith("1.234,50")).toBe(true);
  });
});
