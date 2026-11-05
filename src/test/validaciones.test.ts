import { describe, it, expect } from "vitest";
import {
  validarCliente,
  validarProducto,
  validarMovimiento,
  validarOrden,
  validarEmail,
  esCorreo,
} from "../lib/validaciones";
import { ESTADOS_ORDEN } from "../lib/types";
import { mensajeError } from "../lib/errores";

describe("validaciones — clientes", () => {
  it("nombre obligatorio y correo con formato", () => {
    expect(Object.keys(validarCliente({ nombre_cliente: "" }))).toContain("nombre_cliente");
    expect(validarCliente({ nombre_cliente: "Ana", correo: "no-es-correo" })).toHaveProperty("correo");
    expect(validarCliente({ nombre_cliente: "Ana", correo: "ana@taller.com" })).toEqual({});
  });
});

describe("validaciones — productos", () => {
  it("valores no negativos obligatorios", () => {
    const errs = validarProducto({ descripcion: "P", stock: -1, precio_venta: 0 });
    expect(errs).toHaveProperty("stock");
    expect(Object.keys(validarProducto({ descripcion: "P" }))).toHaveLength(0);
  });
  it("descripción obligatoria", () => {
    expect(validarProducto({})).toHaveProperty("descripcion");
  });
});

describe("validaciones — movimientos financieros (RB-014)", () => {
  it("pagado exige fecha de pago", () => {
    const errs = validarMovimiento({
      descripcion: "Pago luz",
      tipo: "egreso",
      valor: 100,
      pagado: true,
    });
    expect(errs).toHaveProperty("fecha_pago");
    expect(
      validarMovimiento({
        descripcion: "Pago luz",
        tipo: "egreso",
        valor: 100,
        pagado: true,
        fecha_pago: "2026-11-05",
      }),
    ).toEqual({});
  });
  it("valor debe ser mayor que cero", () => {
    expect(validarMovimiento({ descripcion: "x", tipo: "ingreso", valor: 0 })).toHaveProperty("valor");
  });
  it("tipo solo ingreso o egreso", () => {
    expect(validarMovimiento({ descripcion: "x", valor: 5, tipo: "otro" as never })).toHaveProperty("tipo");
  });
});

describe("validaciones — órdenes", () => {
  it("estados válidos del prompt", () => {
    expect(ESTADOS_ORDEN).toContain("Aguardando Piezas");
    const errs = validarOrden({
      estado: "Abierta",
      fecha_inicial: "2026-11-01",
      cliente_id: "c1",
      usuario_id: "u1",
    });
    expect(errs).toEqual({});
  });
  it("fecha final no puede preceder a la inicial", () => {
    const errs = validarOrden({
      estado: "Abierta",
      fecha_inicial: "2026-11-05",
      fecha_final: "2026-11-01",
      cliente_id: "c1",
      usuario_id: "u1",
    });
    expect(errs).toHaveProperty("fecha_final");
  });
});

describe("validaciones — cola de emails", () => {
  it("destinatario obligatorio y cc válidos", () => {
    const errs = validarEmail({ para: "mal", mensaje: "hola" });
    expect(errs).toHaveProperty("para");
    expect(validarEmail({ para: "x@y.com", mensaje: "hola", cc: "a@b.com,c@d.com" })).toEqual({});
  });
  it("esCorreo conoce los formatos clave", () => {
    expect(esCorreo("ana@dominio.com")).toBe(true);
    expect(esCorreo("sin-arroba")).toBe(false);
  });
});

describe("traducción de errores de BD", () => {
  it("stock insuficiente con hint de la RPC", () => {
    expect(mensajeError({ message: "Stock insuficiente...", hint: "stock_insuficiente" })).toContain(
      "Stock insuficiente",
    );
  });
  it("permiso denegado", () => {
    expect(mensajeError({ message: "No tiene permiso para esta operación (aOrden).", hint: "permiso_denegado" })).toContain(
      "No tiene permiso",
    );
  });
  it("duplicado único → mensaje amable", () => {
    expect(mensajeError({ message: "duplicate key value violates unique constraint" })).toContain("duplica");
  });
  it("guard de stock (f_stock_no_directo)", () => {
    expect(mensajeError({ message: "El stock solo se actualiza mediante órdenes/ventas." })).toContain(
      "ajuste de inventario",
    );
  });
});
