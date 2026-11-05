import { describe, it, expect } from "vitest";
import {
  ACCIONES,
  MODULOS,
  codigo,
  codigosModulo,
  tienePermiso,
  tieneAlgunPermiso,
  normalizarCodigos,
} from "../lib/permisos";
import { puedeAcceder, puedeVerModulo } from "../services/usuarios";
import type { Permiso, Usuario } from "../lib/types";

describe("códigos de actividad (SOURCE_PROMPT §11)", () => {
  it("acciones y módulos cubiertos", () => {
    expect(ACCIONES).toEqual(["a", "e", "d", "v", "r", "c"]);
    expect(MODULOS).toContain("Cliente");
    expect(MODULOS).toContain("Auditoria");
    expect(MODULOS).toContain("Email");
  });

  it("arma códigos como aCliente, rAutorizado…", () => {
    expect(codigo("a", "Cliente")).toBe("aCliente");
    expect(codigo("r", "Cliente")).toBe("rCliente");
    expect(codigosModulo("Producto")).toEqual([
      "aProducto", "eProducto", "dProducto", "vProducto", "rProducto", "cProducto",
    ]);
  });
});

describe("evaluación de permisos", () => {
  it("permiso exacto", () => {
    expect(tienePermiso(["aCliente", "vOrden"], "aCliente")).toBe(true);
    expect(tienePermiso(["aCliente"], "vOrden")).toBe(false);
    expect(tienePermiso([], "aCliente")).toBe(false);
  });
  it("alguno de un módulo", () => {
    expect(tieneAlgunPermiso(["vOrden"], ["aOrden", "vOrden"])).toBe(true);
    expect(tieneAlgunPermiso(["vOrden"], ["vVenta"])).toBe(false);
  });
  it("normaliza espacios y duplicados", () => {
    expect(normalizarCodigos([" aCliente ", "vOrden", "aCliente", ""])).toEqual([
      "aCliente", "vOrden",
    ]);
  });
});

describe("control de acceso por usuario + grupo", () => {
  const grupoActivo: Permiso = {
    id_permiso: "p1",
    nombre: "Cajero",
    permisos: ["vCliente", "aOrden"],
    estado: true,
  };
  const grupoInactivo: Permiso = { ...grupoActivo, estado: false };

  const usuario: Usuario & { permisos: Permiso } = {
    id_usuario: "u1",
    nombre: "Juana",
    correo: "juana@taller.com",
    estado_usuario: true,
    permisos: grupoActivo,
  };

  it("permite el código incluido y rechaza el demás", () => {
    expect(puedeAcceder(usuario, "vCliente")).toBe(true);
    expect(puedeAcceder(usuario, "dCliente")).toBe(false);
  });
  it("sin grupo o con grupo desactivado no hay acceso", () => {
    expect(puedeAcceder({ ...usuario, permisos: null as unknown as Permiso }, "vCliente")).toBe(false);
    expect(puedeAcceder({ ...usuario, permisos: grupoInactivo }, "vCliente")).toBe(false);
  });
  it("nivel módulo: basta un código de los pedidos", () => {
    expect(puedeVerModulo(usuario, ["aOrden", "eOrden"])).toBe(true);
    expect(puedeVerModulo(usuario, ["aVenta"])).toBe(false);
  });
});
