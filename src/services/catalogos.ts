// ============================================================================
// Sistema Taller — Catálogos: Marcas, Equipos y Equipos de Orden (TASK-0007)
// ============================================================================
// Tablas del SOURCE_PROMPT ligadas a las órdenes de trabajo: una orden puede
// registrar el equipo intervenido (defecto declarado, defecto encontrado y
// solución) con la marca del equipo. Formularios de órdenes los consumen.
// ============================================================================

import { crearCrud } from "../lib/crud";
import { mensajeError } from "../lib/errores";
import { supabase } from "../lib/supabase";
import type { Equipo, EquipoOrden, Marca } from "../lib/types";

const marcasCrud = crearCrud<Marca>("marcas", "id_marca", ["marca"]);
const equiposCrud = crearCrud<Equipo>("equipos", "id_equipo", ["equipo", "numero_serie", "modelo"]);
const equiposOrdenCrud = crearCrud<EquipoOrden>("equipos_orden", "id_equipo_orden", []);

export const catalogosService = {
  marcas: {
    listar: marcasCrud.listar,
    obtener: marcasCrud.obtener,
    crear: async (datos: Partial<Marca>) => {
      if (!datos.marca?.trim()) throw new Error("El nombre de la marca es obligatorio.");
      const existentes = await marcasCrud.listar({ tamPagina: 200, columna: "marca", ascendente: true });
      const nombre = datos.marca.trim().toLowerCase();
      if ((existentes.datos as Marca[]).some((m) => (m.marca ?? "").trim().toLowerCase() === nombre))
        throw new Error("Ya existe una marca con ese nombre.");
      return marcasCrud.crear({ ...datos, marca: datos.marca.trim(), estado: datos.estado ?? true });
    },
    editar: marcasCrud.editar,
    eliminar: marcasCrud.eliminar,
  },
  equipos: {
    listar: (idCliente?: string, q?: string, opciones?: { pagina?: number; tamPagina?: number }) =>
      equiposCrud.listar({
        q: q ?? "",
        filtros: idCliente ? { cliente_id: idCliente } : {},
        pagina: opciones?.pagina,
        tamPagina: opciones?.tamPagina,
        columna: "equipo",
        ascendente: true,
      }),
    obtener: equiposCrud.obtener,
    crear: async (datos: Partial<Equipo>) => {
      if (!datos.equipo?.trim()) throw new Error("El nombre del equipo es obligatorio.");
      return equiposCrud.crear(datos);
    },
    editar: equiposCrud.editar,
    eliminar: equiposCrud.eliminar,
  },
  equiposOrden: {
    listarDeOrden: async (idOrden: string) => {
      const { data, error, count } = await supabase
        .from("equipos_orden")
        .select("*, equipos:equipo_id(*, marcas:marca_id(marca))", { count: "exact" })
        .eq("orden_id", idOrden)
        .order("id_equipo_orden", { ascending: true });
      if (error) throw new Error(mensajeError(error));
      return {
        datos: (data ?? []) as EquipoOrden[],
        total: count ?? data?.length ?? 0,
        pagina: 1,
        tamPagina: data?.length ?? 0,
        paginas: 1,
      };
    },
    agregar: async (datos: Omit<EquipoOrden, "id_equipo_orden">) => {
      if (!datos.orden_id || !datos.equipo_id)
        throw new Error("Orden y equipo son obligatorios.");
      return equiposOrdenCrud.crear(datos);
    },
    editar: equiposOrdenCrud.editar,
    quitar: equiposOrdenCrud.eliminar,
  },
};
