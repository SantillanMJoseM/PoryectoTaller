// ============================================================================
// Sistema Taller — Fábrica de CRUD genérico (TASK-0007 / AG-008)
// ============================================================================
// Backend TS sobre Supabase (Postgres + RLS). Todos los servicios de dominio
// comparten listado paginado, obtención, alta, edición y borrado; los flujos
// con lógica de negocio (stock, facturación, portal) viven en su servicio.
// Ejecuta el JS en el navegador; el permiso lo impone RLS vía JWT app_metadata
// (ver supabase/migrations/0003_rls.sql) y el frontend consulta los permisos
// con src/lib/permisos.ts para el menú.
// ============================================================================

import { supabase } from "./supabase";
import type { Paginado, OpcionesListado } from "./types";
import { mensajeError } from "./errores";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Crud<T> {
  listar(opciones?: OpcionesListado): Promise<Paginado<T>>;
  obtener(id: string, select?: string): Promise<T | null>;
  crear(datos: Partial<any>): Promise<T>;
  editar(id: string, datos: Partial<any>): Promise<T>;
  eliminar(id: string): Promise<void>;
  contar(filtros?: Record<string, unknown>): Promise<number>;
}

/** Normaliza el texto de búsqueda por columnas ilike (⁎q⁎). */
function condicionBusqueda(q: string, camposBusqueda: string[]) {
  const patron = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const or = camposBusqueda.map((c) => `${c}.ilike.${patron}`).join(",");
  return or;
}

export function crearCrud<T extends Record<string, any>>(
  tabla: string,
  pk: string,
  camposBusqueda: string[] = [],
  selectPorDefecto = "*",
): Crud<T> {
  return {
    async listar(opciones: OpcionesListado = {}): Promise<Paginado<T>> {
      const pagina = Math.max(1, opciones.pagina ?? 1);
      const tamPagina = Math.min(Math.max(1, opciones.tamPagina ?? 20), 200);
      const desde = (pagina - 1) * tamPagina;
      const hasta = desde + tamPagina - 1;

      let consulta = supabase
        .from(tabla)
        .select(selectPorDefecto, { count: "exact" })
        .range(desde, hasta);

      if (opciones.q && camposBusqueda.length > 0) {
        consulta = consulta.or(condicionBusqueda(opciones.q, camposBusqueda));
      }
      if (opciones.filtros) {
        for (const [campo, valor] of Object.entries(opciones.filtros)) {
          if (valor === undefined || valor === null || valor === "") continue;
          consulta = consulta.eq(campo, valor);
        }
      }
      if (opciones.columna) {
        consulta = consulta.order(opciones.columna, {
          ascending: opciones.ascendente ?? false,
        });
      }

      const { data, error, count } = await consulta;
      if (error) throw new Error(mensajeError(error));
      const total = count ?? data?.length ?? 0;
      return {
        datos: (data ?? []) as T[],
        total,
        pagina,
        tamPagina,
        paginas: Math.max(1, Math.ceil(total / tamPagina)),
      };
    },

    async obtener(id: string, select = selectPorDefecto): Promise<T | null> {
      const { data, error } = await supabase
        .from(tabla)
        .select(select)
        .eq(pk, id)
        .maybeSingle();
      if (error) throw new Error(mensajeError(error));
      return (data ?? null) as T | null;
    },

    async crear(datos: Partial<any>): Promise<T> {
      const { data, error } = await supabase
        .from(tabla)
        .insert(datos as any)
        .select(selectPorDefecto)
        .single();
      if (error) throw new Error(mensajeError(error));
      return data as T;
    },

    async editar(id: string, datos: Partial<any>): Promise<T> {
      const { data, error } = await supabase
        .from(tabla)
        .update(datos as any)
        .eq(pk, id)
        .select(selectPorDefecto)
        .single();
      if (error) throw new Error(mensajeError(error));
      return data as T;
    },

    async eliminar(id: string): Promise<void> {
      const { error } = await supabase.from(tabla).delete().eq(pk, id);
      if (error) throw new Error(mensajeError(error));
    },

    async contar(filtros: Record<string, unknown> = {}): Promise<number> {
      let consulta = supabase.from(tabla).select(pk, { count: "exact", head: true });
      for (const [campo, valor] of Object.entries(filtros)) {
        if (valor === undefined || valor === null || valor === "") continue;
        consulta = consulta.eq(campo, valor);
      }
      const { count, error } = await consulta;
      if (error) throw new Error(mensajeError(error));
      return count ?? 0;
    },
  };
}

/** Executa una RPC de negocio (migración 0004) y traduce el error. */
export async function llamarRpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args as any);
  if (error) throw new Error(mensajeError(error));
  return (data ?? null) as T;
}
