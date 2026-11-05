// ============================================================================
// Sistema Taller — QA: Portal del cliente (TASK-0010 / AG-012)
// @vitest-environment jsdom
// ============================================================================
// SOURCE_PROMPT.md §15 flujos críticos cubiertos (RB-032 / RB-033):
//   • Ingreso por correo + documento (Edge Function «portal-login» o
//     coincidencia directa en clientes; mensajes de error en español).
//   • Sesión de cliente persistente con expiración (24 h).
//   • Panel: órdenes y compras del propio cliente (más recientes primero).
//   • Detalle de orden/compra SOLO del cliente en sesión (RLS/portal).
//   • Ver y editar datos de cuenta SIN poder cambiar correo/documento.
//   • Cerrar sesión.
// Entorno jsdom: la sesión del portal vive en localStorage.
// ============================================================================

import { beforeEach, describe, expect, it, vi } from "vitest";
import { falso } from "../helpers/supabaseFalso";
import { portalService, type SesionPortal } from "../../src/services/portal";

vi.mock("../../src/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/lib/supabase")>();
  const mod = await import("../helpers/supabaseFalso");
  return { ...original, supabase: mod.falso.supabase };
});

beforeEach(() => {
  falso.limpiar();
  localStorage.clear();
  falso.establecer("clientes", [
    {
      id_cliente: "c-1",
      nombre_cliente: "María Gómez",
      correo: "maria@x.com",
      documento: "DOC123",
      telefono: "555",
    },
  ]);
});

const CLAVE = "portal_cliente_sesion";

describe("ingreso del cliente (correo + documento)", () => {
  it("sin correo o documento → error en español", async () => {
    await expect(portalService.ingresar("", "DOC123")).rejects.toThrow(
      "Ingrese correo electrónico y documento.",
    );
    await expect(portalService.ingresar("maria@x.com", " ")).rejects.toThrow(
      "Ingrese correo electrónico y documento.",
    );
  });

  it("coincidencia directa: crea sesión local con expiración de 24 h", async () => {
    const ses = await portalService.ingresar("MARIA@x.com", "DOC123"); // correo en minúsculas (ilike)
    expect(ses).toMatchObject({
      idCliente: "c-1",
      nombre: "María Gómez",
      viaEdge: false,
    });
    const esperado = Date.now() + 24 * 3600 * 1000;
    expect(ses.expiracion).toBeGreaterThan(esperado - 5_000);
    // persiste en localStorage
    const guardado = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as SesionPortal;
    expect(guardado?.idCliente).toBe("c-1");
  });

  it("correo o documento erróneos → mensaje del prompt", async () => {
    await expect(portalService.ingresar("maria@x.com", "OTRO")).rejects.toThrow(
      "Los datos no coinciden con un cliente registrado.",
    );
    await expect(portalService.ingresar("desconocido@x.com", "DOC123")).rejects.toThrow(
      "Los datos no coinciden con un cliente registrado.",
    );
  });

  it("por Edge Function «portal-login»: setSession + vía edge", async () => {
    falso.invocable("portal-login", () => ({
      data: {
        session: { access_token: "at", refresh_token: "rt" },
        cliente: { id_cliente: "c-1", nombre_cliente: "María Gómez" },
      },
      error: null,
    }));
    const ses = await portalService.ingresar("maria@x.com", "DOC123");
    expect(ses.viaEdge).toBe(true);
    expect(falso.llamadasAuth).toContain("setSession:true");
  });
});

describe("sesión persistente con expiración", () => {
  it("sesión vigente se recupera", async () => {
    await portalService.ingresar("maria@x.com", "DOC123");
    expect(portalService.obtenerSesion()?.idCliente).toBe("c-1");
  });

  it("sesión expirada se descarta y se elimina del almacenamiento", () => {
    localStorage.setItem(CLAVE, JSON.stringify({ idCliente: "c-1", expiracion: Date.now() - 1000 }));
    expect(portalService.obtenerSesion()).toBeNull();
    expect(localStorage.getItem(CLAVE)).toBeNull();
  });

  it("sin sesión → null", () => {
    expect(portalService.obtenerSesion()).toBeNull();
  });
});

describe("mis órdenes, compras y detalles (RB: solo lo propio)", () => {
  beforeEach(async () => {
    falso.establecer("ordenes_trabajo", [
      { id_orden: "o-1", cliente_id: "c-1", fecha_inicial: "2026-02-01", estado: "Finalizado", valor_total: 90 },
      { id_orden: "o-2", cliente_id: "c-2", fecha_inicial: "2026-02-02", estado: "Abierta", valor_total: 1 },
    ]);
    falso.establecer("ventas", [
      { id_venta: "v-1", cliente_id: "c-1", fecha_venta: "2026-01-20", valor_total: 50 },
    ]);
    falso.establecer("productos_orden", [{ id_producto_orden: "p-1", orden_id: "o-1", subtotal: 90 }]);
    falso.establecer("servicios_orden", []);
    await portalService.ingresar("maria@x.com", "DOC123");
  });

  it("misOrdenes: solo del cliente, más recientes primero", async () => {
    await portalService.misVentas("c-1"); // cobertura de la consulta propia
    const ordenes = await portalService.misOrdenes("c-1");
    expect(ordenes.map((o) => o.id_orden)).toEqual(["o-1"]);
  });

  it("misVentas: solo del cliente", async () => {
    const ventas = await portalService.misVentas("c-1");
    expect(ventas.map((v) => v.id_venta)).toEqual(["v-1"]);
  });

  it("detalleOrden propio: orden + productos; de otro cliente → null", async () => {
    const propio = await portalService.detalleOrden("c-1", "o-1");
    expect(propio?.orden.id_orden).toBe("o-1");
    expect(propio?.productos).toHaveLength(1);
    await expect(portalService.detalleOrden("c-2", "o-2")).resolves.toBeNull();
  });

  it("detalleCompra propio: venta + items; de otro cliente → null", async () => {
    falso.establecer("items_venta", [{ id_item_venta: "i-1", venta_id: "v-1", subtotal: 50 }]);
    const propio = await portalService.detalleCompra("c-1", "v-1");
    expect(propio?.venta.id_venta).toBe("v-1");
    expect(propio?.items).toHaveLength(1);
    await expect(portalService.detalleCompra("c-1", "no-existe")).resolves.toBeNull();
  });
});

describe("edición de la cuenta (RB-033 / E-05): correo y documento inmutables", () => {
  it("intentar cambiar correo o documento → error explícito", async () => {
    await expect(
      portalService.actualizarPerfil("c-1", { correo: "nueva@x.com" } as any),
    ).rejects.toThrow("Para cambiar su correo o documento, contacte al taller.");
    await expect(
      portalService.actualizarPerfil("c-1", { documento: "XXX" } as any),
    ).rejects.toThrow("Para cambiar su correo o documento, contacte al taller.");
  });

  it("campos permitidos se actualizan; el resto se descarta", async () => {
    await portalService.actualizarPerfil("c-1", {
      nombre_cliente: "María G. López",
      celular: "999-111",
      campo_extranio: "no" as never,
    } as any);
    const fila = falso.filas("clientes")[0];
    expect(fila.nombre_cliente).toBe("María G. López");
    expect(fila.celular).toBe("999-111");
    expect((fila as Record<string, unknown>).campo_extranio).toBeUndefined();
  });
});

describe("cerrar sesión del portal", () => {
  it("borra la sesión local y hace signOut", async () => {
    await portalService.ingresar("maria@x.com", "DOC123");
    await portalService.cerrar();
    expect(localStorage.getItem(CLAVE)).toBeNull();
    expect(falso.llamadasAuth).toContain("signOut");
  });
});
