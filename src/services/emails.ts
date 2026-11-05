// ============================================================================
// Sistema Taller — Servicio de Cola de Emails (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §14: crear emails con destinatario, cc, cco, mensaje y
// encabezados; estados pendiente → enviando → enviado | fallido; procesar
// la cola; reintentar fallidos; eliminar emails.
// El envío real se delega a una función de borde «enviar-email» (SMTP/Edge);
// si no está configurada, el servicio marca el correo como fallido con la
// causa registrada en encabezados (para reintento manual).
// ============================================================================

import { crearCrud } from "../lib/crud";
import { mensajeError } from "../lib/errores";
import { supabase } from "../lib/supabase";
import type { ColaEmail, EstadoEmail } from "../lib/types";

const ESTADOS: EstadoEmail[] = ["pendiente", "enviando", "enviado", "fallido"];
const crud = crearCrud<ColaEmail>("cola_emails", "id", ["para", "mensaje"]);

export const emailsService = {
  listar: crud.listar,
  obtener: crud.obtener,
  contar: crud.contar,

  /** Encola un correo con validación básica de direcciones. */
  async crear(datos: {
    para: string;
    cc?: string;
    cco?: string;
    mensaje: string;
    encabezados?: string;
  }): Promise<ColaEmail> {
    if (!datos.para?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.para.trim()))
      throw new Error("Destinatario inválido.");
    if (datos.cc && datos.cc.split(",").some((e) => e.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())))
      throw new Error("Correo inválido en CC.");
    if (datos.cco && datos.cco.split(",").some((e) => e.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())))
      throw new Error("Correo inválido en CCO.");
    if (!datos.mensaje?.trim()) throw new Error("El mensaje es obligatorio.");
    return crud.crear({ ...datos, estado: "pendiente" });
  },

  eliminar: crud.eliminar,

  /**Marco de estado explícito (para pantalla de cola). */
  async cambiarEstado(id: string, estado: EstadoEmail): Promise<ColaEmail> {
    if (!ESTADOS.includes(estado)) throw new Error("Estado de email inválido.");
    return crud.editar(id, { estado } as Partial<ColaEmail>);
  },

  /** Reintenta un correo fallido: lo devuelve a pendiente. */
  async reintentar(id: string): Promise<ColaEmail> {
    return crud.editar(id, { estado: "pendiente" } as Partial<ColaEmail>);
  },

  /** Procesa la cola: toma pendientes secuencialmente y envía.
   *  Devuelve { enviados, fallidos }. Serializa las transiciones
   *  pendiente → enviando → enviado/fallido (estados del prompt). */
  async procesar(limite = 10): Promise<{ enviados: number; fallidos: number }> {
    const { data, error } = await supabase
      .from("cola_emails")
      .select("*")
      .eq("estado", "pendiente")
      .order("fecha", { ascending: true })
      .limit(limite);
    if (error) throw new Error(mensajeError(error));

    let enviados = 0;
    let fallidos = 0;
    for (const correoRaw of data ?? []) {
      const correo = correoRaw as ColaEmail;
      // 1) enviando
      await crud.editar(correo.id, { estado: "enviando" } as Partial<ColaEmail>);
      try {
        const { error: errSend } = await supabase.functions.invoke("enviar-email", {
          body: {
            para: correo.para,
            cc: correo.cc ?? null,
            cco: correo.cco ?? null,
            mensaje: correo.mensaje,
            encabezados: correo.encabezados ?? null,
          },
        });
        if (errSend) throw errSend;
        await crud.editar(correo.id, { estado: "enviado" } as Partial<ColaEmail>);
        enviados++;
      } catch (err) {
        // 2) fallido con causa registrada en encabezados
        await crud.editar(correo.id, {
          estado: "fallido",
          encabezados: `fallido: ${mensajeError(err)}`,
        } as Partial<ColaEmail>);
        fallidos++;
      }
    }
    return { enviados, fallidos };
  },

  /** Filtra por estado (para tabs de la pantalla). */
  async listarPorEstado(estado: EstadoEmail, pagina = 1, tamPagina = 20) {
    return crud.listar({
      pagina,
      tamPagina,
      filtros: { estado },
      columna: "fecha",
      ascendente: false,
    });
  },
};
