// ============================================================================
// Sistema Taller — Servicio de Archivos/Documentos (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §9: crear, editar, eliminar documentos; carga de archivos;
// metadatos (nombre, descripción, categoría, tipo, tamaño, fecha); descarga;
// organización por categoría. Archivo físico en bucket privado «documentos»
// (migración 0005_storage.sql, límite 20 MB).
// ============================================================================

import { crearCrud } from "../lib/crud";
import { mensajeError } from "../lib/errores";
import { formatoFecha } from "../lib/fechas";
import { generarUuid } from "../lib/uuid";
import { subirAlBucket, firmarUrlBucket, eliminarDelBucket } from "../lib/supabase";
import type { Documento } from "../lib/types";

const LIMITE_BYTES = 20 * 1024 * 1024;
const crud = crearCrud<Documento>("documentos", "id_documento", ["documento", "descripcion"]);

export const archivosService = {
  listar: crud.listar,
  obtener: crud.obtener,
  contar: crud.contar,

  async crear(datos: Partial<Documento>): Promise<Documento> {
    if (!datos.documento?.trim()) throw new Error("El nombre del documento es obligatorio.");
    return crud.crear(datos);
  },

  async editar(id: string, datos: Partial<Documento>): Promise<Documento> {
    if ("documento" in datos && !datos.documento?.trim())
      throw new Error("El nombre del documento es obligatorio.");
    return crud.editar(id, datos);
  },

  eliminar: crud.eliminar,

  /** Lista agrupada por categoría para la pantalla organizada. */
  async listarPorCategoria(): Promise<{ categoria: string; documentos: Documento[] }[]> {
    const res = await crud.listar({ tamPagina: 200, columna: "categoria", ascendente: true });
    const grupos = new Map<string, Documento[]>();
    for (const d of res.datos) {
      const clave = d.categoria ?? "Sin categoría";
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave)!.push(d);
    }
    return [...grupos.entries()].map(([categoria, documentos]) => ({ categoria, documentos }));
  },

  /** Carga el archivo al bucket privado y registra sus metadatos. */
  async subir(
    archivo: File,
    metadatos: Omit<Partial<Documento>, "documento" | "archivo" | "ruta" | "url" | "tamanio"> & { documento?: string },
  ): Promise<Documento> {
    if (archivo.size > LIMITE_BYTES) throw new Error("El archivo supera el límite de 20 MB.");
    const sanitizado = archivo.name.replace(/[^\w.\-]/g, "_");
    const ruta = `${generarUuid()}-${sanitizado}`;
    await subirAlBucket("documentos", archivo, ruta);
    const url = await firmarUrlBucket(ruta, "documentos", 3600);
    return crud.crear({
      ...metadatos,
      documento: metadatos.documento ?? archivo.name,
      archivo: archivo.name,
      ruta,
      url,
      tipo: archivo.type ?? "application/octet-stream",
      tamanio: archivo.size,
    });
  },

  /** Descarga: crea enlace firmado (60 min, política de migración 0005). */
  async descargar(idDocumento: string): Promise<string> {
    const doc = await crud.obtener(idDocumento);
    if (!doc?.ruta) throw new Error("Documento sin archivo físico.");
    return firmarUrlBucket(doc.ruta, "documentos", 3600);
  },

  /** Elimina el archivo físico y la fila de metadatos. */
  async eliminarConArchivo(idDocumento: string): Promise<void> {
    const doc = await crud.obtener(idDocumento);
    if (doc?.ruta) await eliminarDelBucket(doc.ruta, "documentos");
    await crud.eliminar(idDocumento);
  },
};

/** Etiqueta con fecha formateada dd/mm/aaaa para la tabla de documentos. */
export function etiquetaDocumento(d: Documento): string {
  return `${d.documento} · ${formatoFecha(d.fecha_registro)}`;
}
