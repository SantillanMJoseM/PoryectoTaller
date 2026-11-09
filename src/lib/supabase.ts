// ============================================================================
// Sistema Taller — Storage local (migración PostgreSQL)
// ============================================================================
import { API_URL } from "./api";
const BASE = API_URL || "";

export const esSupabaseConfigurado = true;
export const SUPABASE_URL = API_URL;
export const SUPABASE_ANON_KEY = "";

export const BUCKETS = {
  documentos: "documentos",
  anexos: "anexos-orden",
} as const;

export type NombreBucket = (typeof BUCKETS)[keyof typeof BUCKETS];

export const LIMITE_ALMACEN_BYTES = 20 * 1024 * 1024;

export function rutaSegura(nombre: string): string {
  return `${Date.now()}-${nombre.replace(/[^\w.\-]/g, "_")}`;
}

function token(): string | null { return localStorage.getItem("st_access_token"); }

export async function subirAlBucket(bucket: NombreBucket, archivo: File | Blob, ruta: string): Promise<{ ruta: string }> {
  const fd = new FormData();
  fd.append("file", archivo as any);
  const res = await fetch(`${BASE}/api/storage/upload?bucket=${encodeURIComponent(bucket)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token() ?? ""}` },
    body: fd,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  return { ruta: data.ruta };
}

export async function firmarUrlBucket(ruta: string, bucket: NombreBucket, segundos = 3600): Promise<string> {
  return `${BASE}/api/storage/download?bucket=${encodeURIComponent(bucket)}&ruta=${encodeURIComponent(ruta)}`;
}

export async function descargarDelBucket(ruta: string, bucket: NombreBucket): Promise<Blob> {
  const res = await fetch(`${BASE}/api/storage/download?bucket=${encodeURIComponent(bucket)}&ruta=${encodeURIComponent(ruta)}`, {
    headers: { Authorization: `Bearer ${token() ?? ""}` },
  });
  if (!res.ok) throw new Error("No se pudo descargar.");
  return res.blob();
}

export async function eliminarDelBucket(ruta: string, bucket: NombreBucket): Promise<void> {
  if (!ruta) return;
  await fetch(`${BASE}/api/storage/file?bucket=${encodeURIComponent(bucket)}&ruta=${encodeURIComponent(ruta)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token() ?? ""}` },
  });
}

export function avisoConfiguracion(): string | null { return null; }
