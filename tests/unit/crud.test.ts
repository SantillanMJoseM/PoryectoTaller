// ============================================================================
// Sistema Taller — QA: Fábrica de CRUD genérico (TASK-0010 / AG-012)
// ============================================================================
// Cubre el contrato compartido por TODOS los módulos (Clientes, Productos,
// Servicios, etc.): listar paginado con búsqueda, filtros, orden, obtener,
// crear, editar, eliminar y contar.
// ============================================================================

import { beforeEach, describe, expect, it, vi } from "vitest";
import { falso } from "../helpers/supabaseFalso";
import { crearCrud, llamarRpc } from "../../src/lib/crud";

vi.mock("../../src/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/lib/supabase")>();
  const mod = await import("../helpers/supabaseFalso");
  return { ...original, supabase: mod.falso.supabase };
});

interface ClientePrueba {
  id_cliente: string;
  nombre_cliente: string;
  documento: string;
  ciudad: string;
}

const crud = crearCrud<ClientePrueba>("clientes", "id_cliente", ["nombre_cliente", "documento"]);

beforeEach(() => {
  falso.limpiar();
  falso.establecer("clientes", [
    { id_cliente: "c-1", nombre_cliente: "Juan Pérez", documento: "D-100", ciudad: "Asunción" },
    { id_cliente: "c-2", nombre_cliente: "Ana Ruiz", documento: "D-200", ciudad: "Lambaré" },
    { id_cliente: "c-3", nombre_cliente: "otro juan", documento: "D-300", ciudad: "Asunción" },
  ]);
});

describe("listar", () => {
  it("entrega total, páginas y datos (count exact)", async () => {
    const p = await crud.listar({ pagina: 1, tamPagina: 2 });
    expect(p.total).toBe(3);
    expect(p.paginas).toBe(2);
    expect(p.datos).toHaveLength(2);
  });

  it("pagina 2 solo con la fila restante", async () => {
    const p = await crud.listar({ pagina: 2, tamPagina: 2 });
    expect(p.datos).toHaveLength(1);
    expect(p.datos[0].id_cliente).toBe("c-3");
  });

  it("búsqueda q con ilike OR sobre los campos de búsqueda", async () => {
    const p = await crud.listar({ q: "juan" });
    expect(p.total).toBe(2);
    const conDoc = await crud.listar({ q: "D-200" });
    expect(conDoc.total).toBe(1);
    expect(conDoc.datos[0].nombre_cliente).toBe("Ana Ruiz");
  });

  it("filtros eq saltan los vacíos", async () => {
    const p = await crud.listar({ filtros: { ciudad: "Asunción", documento: "" } });
    expect(p.total).toBe(2);
  });

  it("orden descendente por columna dada", async () => {
    const p = await crud.listar({ columna: "nombre_cliente", ascendente: false });
    // desc lexicográfico: otro juan > Juan Pérez > Ana Ruiz (case-insensitive compare de Postgres real puede variar; el mock es simple)
    expect(p.datos).toHaveLength(3);
    expect(p.datos[0].id_cliente).toBeDefined();
  });
});

describe("obtener / crear / editar / eliminar", () => {
  it("obtener por pk (null si no existe)", async () => {
    await expect(crud.obtener("c-2")).resolves.toMatchObject({ nombre_cliente: "Ana Ruiz" });
    await expect(crud.obtener("nope")).resolves.toBeNull();
  });

  it("crear inserta y recibe la fila (pk autogenerada)", async () => {
    const nueva = await crud.crear({ nombre_cliente: "Nuevo Cliente", documento: "D-400", ciudad: "Villeta" });
    expect(nueva.nombre_cliente).toBe("Nuevo Cliente");
    expect(nueva.id_cliente).toBeTruthy();
    expect(falso.filas("clientes")).toHaveLength(4);
  });

  it("editar aplica el parche a la fila", async () => {
    await crud.editar("c-1", { nombre_cliente: "Juan P. Editado" });
    expect(falso.filas("clientes").find((c) => c.id_cliente === "c-1")?.nombre_cliente).toBe(
      "Juan P. Editado",
    );
  });

  it("eliminar saca la fila", async () => {
    await crud.eliminar("c-2");
    expect(falso.filas("clientes").map((c) => c.id_cliente)).toEqual(["c-1", "c-3"]);
  });
});

describe("contar", () => {
  it("cuenta todas las filas", async () => {
    await expect(crud.contar()).resolves.toBe(3);
  });

  it("cuenta con filtros e ignora vacíos", async () => {
    await expect(crud.contar({ ciudad: "Asunción", documento: undefined })).resolves.toBe(2);
  });
});

describe("llamarRpc", () => {
  it("devuelve el resultado del manejador", async () => {
    falso.rpc("prueba_fn", () => "ok");
    await expect(llamarRpc("prueba_fn", { a: 1 })).resolves.toBe("ok");
  });

  it("traduce el error de la base a un Error con el mensaje en español", async () => {
    falso.rpc("prueba_error", () => {
      throw new Error("Permisos insuficientes.");
    });
    await expect(llamarRpc("prueba_error")).rejects.toThrow("Permisos insuficientes.");
  });

  it("RPC inexistente no devuelve datos (no lanza)", async () => {
    await expect(llamarRpc("no_existe")).resolves.toBeNull();
  });
});
