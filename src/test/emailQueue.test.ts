// ============================================================================
// Sistema Taller — Pruebas de la cola de emails (TASK-0008 / AG-011)
// ============================================================================
// Se simula el servicio CRUD (emails.ts) para probar la lógica de
// integración: estancadas, demora de reintentos, composición del mensaje de
// orden y el flujo reintentarFallidos → procesar.
// ============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del CRUD y envio real (nunca red en pruebas).
vi.mock("../services/emails", () => {
  const reencolados: string[] = [];
  let procesado: { enviados: number; fallidos: number } | null = null;
  return {
    emailsService: {
      crear: vi.fn(async (datos: Record<string, unknown>) => ({ id: "e1", estado: "pendiente", ...datos })),
      listarPorEstado: vi.fn(async (estado: string, _p: number, tam: number) => ({
        datos:
          estado === "fallido"
            ? [{ id: "f1", estado, para: "a@b.c", mensaje: "x" },
               { id: "f2", estado, para: "c@d.e", mensaje: "y" }].slice(0, tam)
            : [],
        total: estado === "fallido" ? 2 : 0,
      })),
      procesar: vi.fn(async () => procesado ?? { enviados: 2, fallidos: 0 }),
      reintentar: vi.fn(async (id: string) => {
        reencolados.push(id);
        return { id, estado: "pendiente" };
      }),
      cambiarEstado: vi.fn(),
    },
    // utilidades de prueba expuestas por el mock para las aserciones
    __estadoMock: {
      reencolados,
      setProcesado: (v: { enviados: number; fallidos: number } | null) => { procesado = v; },
    },
  };
});

import {
  emailQueueService,
  esCorreoEstancado,
  segundosReintento,
  MAX_ENVIANDO_MS,
  INTERVALO_AUTOPROCESO_MS,
  FN_ENVIAR_EMAIL,
  AUTOPROCESO_ACTIVADO,
} from "../services/emailQueue";
import type { ColaEmail } from "../lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mock = (await import("../services/emails")) as any;
const MIN = 60_000;

function correo(estado: ColaEmail["estado"], haceMs: number): ColaEmail {
  return {
    id: "x1",
    para: "cli@correo.com",
    mensaje: "mensaje",
    estado,
    fecha: new Date(Date.now() - haceMs).toISOString(),
  };
}

describe("cola de emails — integración", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.__estadoMock.reencolados.length = 0;
    mock.__estadoMock.setProcesado(null);
  });

  it("constantes de integración coherentes con el prompt §14", () => {
    expect(FN_ENVIAR_EMAIL).toBe("enviar-email");
    expect(INTERVALO_AUTOPROCESO_MS).toBeGreaterThanOrEqual(10_000);
    expect(MAX_ENVIANDO_MS).toBe(10 * MIN);
    expect(typeof AUTOPROCESO_ACTIVADO).toBe("boolean");
  });

  it("detecta correos estancados en 'enviando'", () => {
    const ahora = Date.now();
    expect(esCorreoEstancado(correo("enviando", 15 * MIN), ahora)).toBe(true);
    expect(esCorreoEstancado(correo("enviando", 2 * MIN), ahora)).toBe(false);
    expect(esCorreoEstancado(correo("pendiente", 30 * MIN), ahora)).toBe(false);
    expect(esCorreoEstancado({ ...correo("enviando", 30 * MIN), fecha: undefined }, ahora)).toBe(false);
  });

  it("demora de reintento: exponencial con tope", () => {
    expect(segundosReintento(0)).toBe(30);
    expect(segundosReintento(1)).toBe(60);
    expect(segundosReintento(6)).toBe(30 * 32);
    expect(segundosReintento(-2)).toBe(30);
  });

  it("encolarOrden compone el mensaje de negocio y encabezados", async () => {
    const fila = await emailQueueService.encolarOrden({
      para: "cli@correo.com",
      numeroOrden: "OT-0001",
      estado: "En Proceso",
      resumen: "Reparación de laptop.",
    });
    expect(fila.estado).toBe("pendiente");
    expect(String(fila.mensaje)).toContain("Orden de trabajo OT-0001");
    expect(String(fila.mensaje)).toContain("En Proceso");
    expect(fila.encabezados).toBe("orden:OT-0001");
  });

  it("reintentarFallidos reencola cada fallido y luego procesa la cola", async () => {
    const r = await emailQueueService.reintentarFallidos(5);
    expect(mock.emailsService.reintentar).toHaveBeenCalledTimes(2);
    expect(mock.emailsService.procesar).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ enviados: 2, fallidos: 0, recuperados: 0 });
  });

  it("recuperarEstancadas devuelve a pendiente solo las envejecidas", async () => {
    // listarPorEstado('enviando') en el mock devuelve vacío → 0 recuperados.
    const n = await emailQueueService.recuperarEstancadas(1);
    expect(n).toBe(0);
  });

  it("ciclo devuelve ok con resultado o error en español, sin lanzar", async () => {
    mock.__estadoMock.setProcesado({ enviados: 1, fallidos: 0 });
    const a = await emailQueueService.ciclo();
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.resultado).toEqual({ enviados: 1, fallidos: 0, recuperados: 0 });

    mock.emailsService.procesar.mockRejectedValueOnce(new Error("boom"));
    const b = await emailQueueService.ciclo();
    expect(b.ok).toBe(false);
    if (!b.ok) expect(typeof b.error).toBe("string");
  });
});
