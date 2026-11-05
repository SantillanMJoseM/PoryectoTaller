// ============================================================================
// Sistema Taller — Integración de la Cola de Emails (TASK-0008 / AG-011)
// ============================================================================
// SOURCE_PROMPT.md §14: crear emails con destinatario, cc, cco, mensaje y
// encabezados; estados pendiente → enviando → enviado | fallido; procesar la
// cola; reintentar fallidos; eliminar emails.
//
// Esta capa coordina el CRUD de src/services/emails.ts con el Edge Function
// «enviar-email» de Supabase y añade las piezas de integración:
//   • encolar / encolarOrden  → alta validada de correos
//   • procesar                → lote pendiente → enviando → enviado|fallido
//   • reintentarFallidos      → reencola y procesa
//   • recuperarEstancadas     → correos atascados en «enviando» (p. ej. por
//     cierre de pestaña) vuelven a «pendiente»
//   • iniciarAutoproceso / detenerAutoproceso → temporizador ligero en el
//     navegador (desactivable con VITE_EMAILS_AUTO_PROCESAR=false)
// La autorización de escritura/lectura la impone RLS con el JWT en curso.
// ============================================================================

import { mensajeError } from "../lib/errores";
import { emailsService } from "./emails";
import type { ColaEmail, EstadoEmail } from "../lib/types";

/** Nombre del Edge Function que envía realmente el correo (SMTP del taller). */
export const FN_ENVIAR_EMAIL = "enviar-email";

/** Intervalo del autoproceso en el navegador (milisegundos). */
export const INTERVALO_AUTOPROCESO_MS = 60_000;

/** Edad máxima de un correo en «enviando» antes de recuperarlo (10 min, en ms). */
export const MAX_ENVIANDO_MS = 10 * 60_000;

/** ¿Está activado el autoproceso por variables de entorno? (por defecto sí). */
export const AUTOPROCESO_ACTIVADO =
  (import.meta.env.VITE_EMAILS_AUTO_PROCESAR as string | undefined)?.trim() !== "false";

/** ¿Un correo «enviando» lleva más de `maxMs` en ese estado? (función pura). */
export function esCorreoEstancado(
  correo: ColaEmail,
  ahora: number,
  maxMs: number = MAX_ENVIANDO_MS,
): boolean {
  if (correo.estado !== "enviando") return false;
  if (!correo.fecha) return false;
  const t = Date.parse(correo.fecha);
  return Number.isFinite(t) && ahora - t >= maxMs;
}

/** Demora de reintento exponencial en segundos: 30 · 2^intentos (función pura). */
export function segundosReintento(intentos: number): number {
  return 30 * 2 ** Math.max(0, Math.min(intentos, 5));
}

export interface ResultadoCola {
  enviados: number;
  fallidos: number;
  recuperados: number;
}

let intervalo: ReturnType<typeof window.setInterval> | null = null;

export const emailQueueService = {
  /** Encola un correo (validación de direcciones en emailsService). */
  encolar(datos: {
    para: string;
    cc?: string;
    cco?: string;
    mensaje: string;
    encabezados?: string;
  }): Promise<ColaEmail> {
    return emailsService.crear(datos);
  },

  /** Envía la orden de trabajo al cliente construyendo el mensaje de negocio. */
  encolarOrden(datos: {
    para: string;
    numeroOrden: string;
    estado: string;
    resumen: string;
    cc?: string;
    cco?: string;
  }): Promise<ColaEmail> {
    const mensaje = [
      `Orden de trabajo ${datos.numeroOrden} — estado: ${datos.estado}.`,
      "",
      datos.resumen,
      "",
      "Sistema Taller",
    ].join("\n");
    return emailQueueService.encolar({
      para: datos.para,
      cc: datos.cc,
      cco: datos.cco,
      mensaje,
      encabezados: `orden:${datos.numeroOrden}`,
    });
  },

  /** Marca el estado desde la pantalla de la cola. */
  cambiarEstado(id: string, estado: EstadoEmail): Promise<ColaEmail> {
    return emailsService.cambiarEstado(id, estado);
  },

  eliminar: (id: string) => emailsService.eliminar(id),

  listar: emailsService.listar.bind(emailsService),

  listarPorEstado: (estado: EstadoEmail, pagina = 1, tamPagina = 20) =>
    emailsService.listarPorEstado(estado, pagina, tamPagina),

  /** Procesa la cola: hasta `limite` correos pendientes en orden de llegada. */
  async procesar(limite = 10): Promise<{ enviados: number; fallidos: number }> {
    try {
      return await emailsService.procesar(limite);
    } catch (error) {
      throw new Error(mensajeError(error));
    }
  },

  /** Reintenta los correos en estado «fallido»: los vuelve a «pendiente» y
   *  procesa la cola. Devuelve el resultado del procesamiento. */
  async reintentarFallidos(limite = 10): Promise<ResultadoCola> {
    const { datos } = await emailsService.listarPorEstado("fallido", 1, limite);
    for (const correo of datos) {
      try {
        await emailsService.reintentar(correo.id);
      } catch {
        // Un correo que no se pudo reencolar (RLS) no bloquea a los demás.
      }
    }
    const resultado = await emailQueueService.procesar(limite);
    return { ...resultado, recuperados: 0 };
  },

  /** Recupera correos atascados en «enviando» (crash/cierre de pestaña):
   *  vuelven a «pendiente» para el siguiente ciclo. Solo envejecidos. */
  async recuperarEstancadas(msEstancado = MAX_ENVIANDO_MS): Promise<number> {
    const ahora = Date.now();
    const { datos } = await emailsService.listarPorEstado("enviando", 1, 100);
    let recuperados = 0;
    for (const correo of datos) {
      if (!esCorreoEstancado(correo, ahora, msEstancado)) continue;
      try {
        await emailsService.reintentar(correo.id);
        recuperados++;
      } catch {
        // Ignorar: se reintentará en el próximo ciclo.
      }
    }
    return recuperados;
  },

  /** Ciclo completo de mantenimiento: recupera estancadas y procesa la cola.
   *  Nunca lanza: devuelve el resultado (o el error como texto) para no
   *  interrumpir el temporizador del navegador. */
  async ciclo(): Promise<{ ok: true; resultado: ResultadoCola } | { ok: false; error: string }> {
    try {
      const recuperados = await emailQueueService.recuperarEstancadas();
      const { enviados, fallidos } = await emailQueueService.procesar();
      return { ok: true, resultado: { enviados, fallidos, recuperados } };
    } catch (error) {
      return { ok: false, error: mensajeError(error) };
    }
  },

  /* -----------------------------------------------------------------------
   * Autoproceso en el navegador (un reloj único por pestaña).
   * -------------------------------------------------------------------- */

  async iniciarAutoproceso(): Promise<void> {
    if (!AUTOPROCESO_ACTIVADO || intervalo !== null) return;
    try {
      await emailQueueService.ciclo(); // primera pasada inmediata
    } finally {
      intervalo = window.setInterval(() => {
        void emailQueueService.ciclo();
      }, INTERVALO_AUTOPROCESO_MS);
    }
  },

  detenerAutoproceso(): void {
    if (intervalo !== null) {
      window.clearInterval(intervalo);
      intervalo = null;
    }
  },
};
