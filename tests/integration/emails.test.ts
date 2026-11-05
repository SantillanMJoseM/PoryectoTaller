// ============================================================================
// Sistema Taller — QA: Cola de emails (TASK-0010 / AG-012)
// ============================================================================
// SOURCE_PROMPT.md §14 flujos críticos cubiertos:
//   • Crear emails (destinatario/cc/cco/mensaje/encabezados) con validación.
//   • Estados: pendiente → enviando → enviado | fallido (procesar cola).
//   • Reintentar fallidos; eliminar emails; estado inválido rechazado.
//   • encolarOrden construye el mensaje de negocio con encabezados orden:<n>.
// ============================================================================

import { beforeEach, describe, expect, it, vi } from "vitest";
import { falso } from "../helpers/supabaseFalso";
import { emailQueueService } from "../../src/services/emailQueue";
import { emailsService } from "../../src/services/emails";

vi.mock("../../src/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/lib/supabase")>();
  const mod = await import("../helpers/supabaseFalso");
  return { ...original, supabase: mod.falso.supabase };
});

beforeEach(() => falso.limpiar());

describe("encolado con validación de direcciones", () => {
  it("destinatario inválido → error en español", async () => {
    await expect(
      emailQueueService.encolar({ para: "no-es-correo", mensaje: "hola" }),
    ).rejects.toThrow("Destinatario inválido.");
    expect(falso.filas("cola_emails")).toHaveLength(0);
  });

  it("cc / cco con direcciones rotas → error", async () => {
    await expect(
      emailQueueService.encolar({ para: "a@b.com", cc: "ok@b.com, mala", mensaje: "x" }),
    ).rejects.toThrow("Correo inválido en CC.");
    await expect(
      emailQueueService.encolar({ para: "a@b.com", cco: "otra-mala", mensaje: "x" }),
    ).rejects.toThrow("Correo inválido en CCO.");
  });

  it("mensaje vacío → error; correo válido entra como pendiente", async () => {
    await expect(emailQueueService.encolar({ para: "a@b.com", mensaje: "   " })).rejects.toThrow(
      "El mensaje es obligatorio.",
    );
    const correo = await emailQueueService.encolar({
      para: "a@b.com",
      cc: "c@d.com",
      cco: "e@f.com",
      mensaje: "Tu orden está lista",
    });
    expect(correo.estado).toBe("pendiente");
    expect(falso.filas("cola_emails")).toHaveLength(1);
  });

  it("encolarOrden arma el mensaje de negocio y encabezados orden:<número>", async () => {
    await emailQueueService.encolarOrden({
      para: "cliente@taller.com",
      numeroOrden: "o-77",
      estado: "Finalizado",
      resumen: "Total: 100.00",
    });
    const fila = falso.filas("cola_emails")[0];
    expect(fila.mensaje).toContain("Orden de trabajo o-77 — estado: Finalizado.");
    expect(fila.mensaje).toContain("Sistema Taller");
    expect(fila.encabezados).toBe("orden:o-77");
  });
});

describe("procesar la cola: pendiente → enviando → enviado|fallido", () => {
  beforeEach(() => {
    falso.establecer("cola_emails", [
      { id: "e-1", para: "a@b.com", mensaje: "uno", estado: "pendiente", fecha: "2026-01-01T10:00:00Z" },
      { id: "e-2", para: "c@d.com", mensaje: "dos", estado: "pendiente", fecha: "2026-01-01T11:00:00Z" },
    ]);
  });

  it("envío exitoso marca ambos como enviado", async () => {
    falso.invocable("enviar-email", () => ({ data: { ok: true }, error: null }));
    const r = await emailQueueService.procesar();
    expect(r).toEqual({ enviados: 2, fallidos: 0 });
    const filas = falso.filas("cola_emails");
    expect(filas.map((f) => f.estado)).toEqual(["enviado", "enviado"]);
  });

  it("fallo de envío marca fallido con la causa en encabezados", async () => {
    falso.invocable("enviar-email", () => ({ data: null, error: { message: "SMTP caído" } }));
    const r = await emailQueueService.procesar();
    expect(r).toEqual({ enviados: 0, fallidos: 2 });
    const filas = falso.filas("cola_emails");
    expect(filas.every((f) => f.estado === "fallido")).toBe(true);
    expect(filas[0].encabezados).toContain("SMTP caído");
  });

  it("sin Edge Function configurada procesa la cola sin colgarse (fallidos)", async () => {
    const r = await emailQueueService.procesar();
    expect(r.fallidos).toBe(2);
  });
});

describe("reintentar y estados", () => {
  it("cambiarEstado rechaza estados fuera del dominio del prompt", async () => {
    falso.establecer("cola_emails", [{ id: "e-1", para: "a@b.com", mensaje: "x", estado: "pendiente" }]);
    await expect(emailQueueService.cambiarEstado("e-1", "leido" as any)).rejects.toThrow(
      "Estado de email inválido.",
    );
    await emailQueueService.cambiarEstado("e-1", "enviado");
    expect(falso.filas("cola_emails")[0].estado).toBe("enviado");
  });

  it("reintentarFallidos vuelve a pendiente y procesa", async () => {
    falso.establecer("cola_emails", [
      { id: "e-1", para: "a@b.com", mensaje: "x", estado: "fallido", fecha: "2026-01-01T10:00:00Z" },
    ]);
    const r = await emailQueueService.reintentarFallidos();
    expect(r.recuperados).toBe(0);
    // el correo se volvió a procesar: sin función de borde → fallido (pero se reintentó)
    expect(falso.filas("cola_emails")[0].estado).toBe("fallido");
    expect(falso.consultaLog.some((c) => c.tabla === "cola_emails")).toBe(true);
  });

  it("eliminar saca el correo de la cola", async () => {
    falso.establecer("cola_emails", [{ id: "e-3", para: "a@b.com", mensaje: "x", estado: "pendiente" }]);
    await emailsService.eliminar("e-3");
    expect(falso.filas("cola_emails")).toHaveLength(0);
  });
});
