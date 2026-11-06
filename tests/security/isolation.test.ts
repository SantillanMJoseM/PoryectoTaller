import { describe, it, expect, beforeEach, vi } from "vitest";
import { falso } from "../helpers/supabaseFalso";
import { portalService } from "../../src/services/portal";

vi.mock("../../src/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/lib/supabase")>();
  const mod = await import("../helpers/supabaseFalso");
  return { ...original, supabase: mod.falso.supabase };
});

describe("aislamiento entre clientes", () => {
  beforeEach(() => {
    falso.limpiar();
    falso.establecer("clientes", [{ id_cliente: "c-1", correo: "a@x.com", documento: "D1", nombre_cliente: "A" }, { id_cliente: "c-2", correo: "b@x.com", documento: "D2", nombre_cliente: "B" }]);
    falso.establecer("ordenes_trabajo", [{ id_orden: "o-2", cliente_id: "c-2", estado: "Abierta", fecha_inicial: "2026-01-01" }]);
    falso.establecer("productos_orden", []);
    falso.establecer("servicios_orden", []);
  });
  it("cliente c-1 no puede ver orden de c-2", async () => {
    const res = await portalService.detalleOrden("c-1", "o-2");
    expect(res).toBeNull();
  });
  it("cliente c-2 puede ver su propia orden", async () => {
    const res = await portalService.detalleOrden("c-2", "o-2");
    expect(res?.orden.id_orden).toBe("o-2");
  });
});
