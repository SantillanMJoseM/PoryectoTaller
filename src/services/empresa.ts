// ============================================================================
// Sistema Taller — Servicio de Empresa (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §16: crear/editar datos de la empresa (nombre, CNPJ, IE,
// dirección, teléfono, correo) y logo para reportes PDF (bucket público
// «logos», migración 0005). Regla de negocio RB-030: solo existe un registro
// (trigger f_empresa_unica en BD); el servicio devuelve/actualiza ese único.
// El logo se usa en los encabezados de los PDF de Informes/Ordenes/Ventas.
// ============================================================================

import { crearCrud } from "../lib/crud";
import { mensajeError } from "../lib/errores";
import { generarUuid } from "../lib/uuid";
import { supabase } from "../lib/supabase";
import type { Empresa } from "../lib/types";

const LIMITE_BYTES = 5 * 1024 * 1024; // 5 MB para un logo es de sobra
const crud = crearCrud<Empresa>("empresa", "id");

export const empresaService = {
  /** Devuelve el registro único de la empresa (o null si aún no existe). */
  async obtener(): Promise<Empresa | null> {
    const { data, error } = await supabase.from("empresa").select("*").limit(1).maybeSingle();
    if (error) throw new Error(mensajeError(error));
    return (data ?? null) as Empresa | null;
  },

  /** Crea la empresa si no existe; el trigger bloquea un segundo registro. */
  async crear(datos: Partial<Empresa>): Promise<Empresa> {
    if (!datos.nombre?.trim()) throw new Error("El nombre de la empresa es obligatorio.");
    return crud.crear(datos);
  },

  /** Actualiza el registro único (si existe). */
  async actualizar(id: string, datos: Partial<Empresa>): Promise<Empresa> {
    if ("nombre" in datos && !datos.nombre?.trim())
      throw new Error("El nombre de la empresa es obligatorio.");
    return crud.editar(id, datos);
  },

  /** Sube el logo al bucket público «logos» y guarda url_logo. */
  async subirLogo(id: string, archivo: File): Promise<Empresa> {
    if (archivo.size > LIMITE_BYTES) throw new Error("El logo supera el límite de 5 MB.");
    if (!/^image\//.test(archivo.type)) throw new Error("El logo debe ser una imagen.");
    const sanitizado = archivo.name.replace(/[^\w.\-]/g, "_");
    const ruta = `${generarUuid()}-${sanitizado}`;
    const { error: errUpload } = await supabase.storage
      .from("logos")
      .upload(ruta, archivo, { upsert: false });
    if (errUpload) throw new Error(mensajeError(errUpload));
    const { data: pub } = supabase.storage.from("logos").getPublicUrl(ruta);
    return crud.editar(id, { url_logo: pub.publicUrl } as Partial<Empresa>);
  },
};

/** Datos para el encabezado de los reportes PDF (nombre, dirección, logo). */
export async function cabeceraEmpresa(): Promise<{
  nombre?: string;
  direccion?: string;
  telefono?: string;
  correo?: string;
  logo?: string;
}> {
  const e = await empresaService.obtener();
  if (!e) return {};
  return {
    nombre: e.nombre,
    direccion: [e.calle, e.numero, e.barrio, e.ciudad, e.provincia].filter(Boolean).join(", "),
    telefono: e.telefono ?? undefined,
    correo: e.correo ?? undefined,
    logo: await logoComoDataUrl(e.url_logo),
  };
}

/** Convierte la URL pública del logo a data URL para incrustarlo en PDFs. */
export async function logoComoDataUrl(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}
