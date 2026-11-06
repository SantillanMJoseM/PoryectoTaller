// ============================================================================
// Sistema Taller — Cliente Supabase + integración Storage (TASK-0008 / AG-011)
// ============================================================================
// Fuente única del cliente de Supabase para todo el sistema:
//   • Auth           → src/contexts/AuthContext.tsx + src/services/autenticacion.ts
//   • Base de datos  → src/lib/crud.ts (Postgres + RLS, migraciones 0001–0004)
//   • Storage        → helpers de buckets (migración 0005: «documentos»,
//                      «anexos») reutilizados por src/services/archivos.ts y
//                      src/services/ordenes.ts
//
// Las credenciales se leen de variables de entorno VITE_*: nunca se colocan
// claves privadas en el frontend (SOURCE_PROMPT.md «Seguridad»).
// ============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generarUuid } from "./uuid";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? "";
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? "";

/** ¿Hay URL y clave anon configuradas? (evita caer en un cliente de prueba). */
export const esSupabaseConfigurado = url !== "" && anonKey !== "";

/** URL del proyecto (útil para documentación/pantallas de diagnóstico). */
export const SUPABASE_URL = url || "http://localhost";

/** Claves privadas/SERVICE_ROLE: jamás en el frontend. Solo la anon key. */
export const SUPABASE_ANON_KEY = anonKey || "anon";

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true, // sesión persistente con expiración automática
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "sistema-taller-sesion",
  },
});

/** Mensaje de configuración pendiente (para pantallas de diagnóstico). */
export function avisoConfiguracion(): string | null {
  if (esSupabaseConfigurado) return null;
  return "Configure VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).";
}

/* ---------------------------------------------------------------------------
 * Storage — buckets privados (migración 0005_storage.sql)
 * ------------------------------------------------------------------------ */

/** Buckets privados del sistema. El acceso pasa por firmas URL de 1 hora. */
export const BUCKETS = {
  documentos: "documentos",
  anexos: "anexos-orden",
} as const;

export type NombreBucket = (typeof BUCKETS)[keyof typeof BUCKETS];

/** Límite de tamaño por archivo (20 MB, coherente con la migración 0005). */
export const LIMITE_ALMACEN_BYTES = 20 * 1024 * 1024;

/** Sanitiza el nombre del archivo para la ruta dentro del bucket. */
export function rutaSegura(nombre: string): string {
  return `${generarUuid()}-${nombre.replace(/[^\w.\-]/g, "_")}`;
}

/** Sube un archivo a un bucket privado. Devuelve la ruta almacenada. */
export async function subirAlBucket(
  bucket: NombreBucket,
  archivo: File | Blob,
  ruta: string,
): Promise<{ ruta: string }> {
  const { error } = await supabase.storage.from(bucket).upload(ruta, archivo, { upsert: false });
  if (error) throw error;
  return { ruta };
}

/** Crea una URL firmada (1 hora por defecto) para descargar el archivo. */
export async function firmarUrlBucket(ruta: string, bucket: NombreBucket, segundos = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(ruta, segundos);
  if (error || !data) throw error ?? new Error("No se pudo firmar la URL del archivo.");
  return data.signedUrl;
}

/** Descarga el contenido binario del archivo (para descargas locales). */
export async function descargarDelBucket(ruta: string, bucket: NombreBucket): Promise<Blob> {
  const { data, error } = await supabase.storage.from(bucket).download(ruta);
  if (error || !data) throw error ?? new Error("No se pudo descargar el archivo.");
  return data;
}

/** Elimina el objeto del bucket (ignora «no encontrado» para ser idempotente). */
export async function eliminarDelBucket(ruta: string, bucket: NombreBucket): Promise<void> {
  if (!ruta) return;
  const { error } = await supabase.storage.from(bucket).remove([ruta]);
  if (error && !/not.?found/i.test(error.message)) throw error;
}
