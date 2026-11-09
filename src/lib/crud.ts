// ============================================================================
// Sistema Taller — CRUD genérico sobre el backend propio (migración PostgreSQL)
// ============================================================================
import { api } from "./api";
import type { Paginado, OpcionesListado } from "./types";

const ENDPOINT: Record<string, string> = {
  empresa: "/api/empresa",
  permisos: "/api/permisos",
  usuarios: "/api/usuarios",
  clientes: "/api/clientes",
  marcas: "/api/marcas",
  equipos: "/api/equipos",
  productos: "/api/productos",
  servicios: "/api/servicios",
  garantias: "/api/garantias",
  categorias: "/api/categorias",
  cuentas: "/api/cuentas",
  ordenes_trabajo: "/api/ordenes",
  productos_orden: "/api/productos-orden",
  servicios_orden: "/api/servicios-orden",
  equipos_orden: "/api/equipos-orden",
  anexos: "/api/anexos",
  ventas: "/api/ventas",
  items_venta: "/api/items-venta",
  movimientos_financieros: "/api/movimientos",
  documentos: "/api/documentos",
  logs_auditoria: "/api/logs",
  cola_emails: "/api/emails",
  sesiones: "/api/sesiones",
};

const RPC_MAP: Record<string, string> = {
  sesion_registrar: "/api/sesion/registrar",
  sesion_cerrar: "/api/sesion/cerrar",
  sesion_purgar: "/api/sesion/purgar",
  orden_agregar_producto: "/api/orden/agregar-producto",
  orden_cambiar_cantidad_producto: "/api/orden/cambiar-cantidad-producto",
  orden_quitar_producto: "/api/orden/quitar-producto",
  venta_agregar_item: "/api/venta/agregar-item",
  venta_cambiar_cantidad_item: "/api/venta/cambiar-cantidad-item",
  venta_quitar_item: "/api/venta/quitar-item",
  orden_facturar: "/api/orden/facturar",
  venta_facturar: "/api/venta/facturar",
  mov_marcar_pagado: "/api/mov/marcar-pagado",
  ajustar_stock: "/api/mov/ajustar-stock",
  limpiar_logs: "/api/logs/limpiar",
  finalizar_cambio_contrasena: "/api/auth/finalizar-cambio-contrasena",
  orden_agregar_servicio: "/api/orden/agregar-servicio",
  orden_cambiar_cantidad_servicio: "/api/orden/cambiar-cantidad-servicio",
  orden_quitar_servicio: "/api/orden/quitar-servicio",
};

export interface Crud<T> {
  listar(opciones?: OpcionesListado): Promise<Paginado<T>>;
  obtener(id: string, select?: string): Promise<T | null>;
  crear(datos: Partial<any>): Promise<T>;
  editar(id: string, datos: Partial<any>): Promise<T>;
  eliminar(id: string): Promise<void>;
  contar(filtros?: Record<string, unknown>): Promise<number>;
}

export function crearCrud<T extends Record<string, any>>(
  tabla: string,
  pk: string,
  camposBusqueda: string[] = [],
  selectPorDefecto = "*",
): Crud<T> {
  const base = ENDPOINT[tabla];
  if (!base) throw new Error(`Sin endpoint para tabla ${tabla}`);
  return {
    async listar(opciones: OpcionesListado = {}): Promise<Paginado<T>> {
      const params = new URLSearchParams();
      if (opciones.pagina) params.set("pagina", String(opciones.pagina));
      if (opciones.tamPagina) params.set("tamPagina", String(opciones.tamPagina));
      if (opciones.q) params.set("q", opciones.q);
      if (opciones.columna) params.set("columna", opciones.columna);
      if (opciones.ascendente !== undefined) params.set("ascendente", String(opciones.ascendente));
      if (opciones.filtros) {
        for (const [k, v] of Object.entries(opciones.filtros)) {
          if (v === undefined || v === null || v === "") continue;
          params.set(k, String(v));
        }
      }
      const qs = params.toString();
      const data = await api.get(`${base}/${qs ? "?" + qs : ""}`);
      return data as Paginado<T>;
    },
    async obtener(id: string): Promise<T | null> {
      try { return await api.get(`${base}/${id}`); } catch { return null; }
    },
    async crear(datos: Partial<any>): Promise<T> {
      return await api.post(base, datos);
    },
    async editar(id: string, datos: Partial<any>): Promise<T> {
      return await api.put(`${base}/${id}`, datos);
    },
    async eliminar(id: string): Promise<void> {
      await api.del(`${base}/${id}`);
    },
    async contar(filtros: Record<string, unknown> = {}): Promise<number> {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(filtros)) {
        if (v === undefined || v === null || v === "") continue;
        params.set(k, String(v));
      }
      const qs = params.toString();
      const data = await api.get(`${base}/count${qs ? "?" + qs : ""}`);
      return (data?.count ?? 0) as number;
    },
  };
}

export async function llamarRpc<T = any>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const endpoint = RPC_MAP[fn];
  if (!endpoint) throw new Error(`RPC no mapeado: ${fn}`);
  // map arg names? backend expects specific body fields. Most RPCs use p_ prefixed? 
  // Our backend negocio endpoints expect camelCase-ish: ordenId, productoId, etc.
  // The frontend calls with p_ prefixed args (p_orden, p_producto...). Need transform.
  const body = transformArgs(fn, args);
  const res = await api.post(endpoint, body);
  return (res ?? null) as T;
}

const ARG_MAP: Record<string, Record<string, string>> = {
  sesion_registrar: { p_tipo: "tipo", p_sujeto: "sujeto", p_duracion_horas: "duracionHoras" },
  sesion_cerrar: { p_sesion: "sesionId" },
  orden_agregar_producto: { p_orden: "ordenId", p_producto: "productoId", p_cantidad: "cantidad", p_precio: "precio" },
  orden_cambiar_cantidad_producto: { p_linea: "lineaId", p_cantidad: "cantidad" },
  orden_quitar_producto: { p_linea: "lineaId" },
  venta_agregar_item: { p_venta: "ventaId", p_producto: "productoId", p_cantidad: "cantidad", p_precio: "precio" },
  venta_cambiar_cantidad_item: { p_item: "itemId", p_cantidad: "cantidad" },
  venta_quitar_item: { p_item: "itemId" },
  orden_facturar: { p_orden: "ordenId", p_fecha_vencimiento: "fechaVencimiento", p_forma_pago: "formaPago", p_categoria_id: "categoriaId", p_cuenta_id: "cuentaId" },
  venta_facturar: { p_venta: "ventaId", p_fecha_vencimiento: "fechaVencimiento", p_forma_pago: "formaPago", p_categoria_id: "categoriaId", p_cuenta_id: "cuentaId" },
  mov_marcar_pagado: { p_movimiento: "movimientoId", p_fecha_pago: "fechaPago" },
  ajustar_stock: { p_producto: "productoId", p_delta: "delta" },
  orden_agregar_servicio: { p_orden: "ordenId", p_servicio: "servicioId", p_cantidad: "cantidad", p_precio: "precio" },
  orden_cambiar_cantidad_servicio: { p_linea: "lineaId", p_cantidad: "cantidad" },
  orden_quitar_servicio: { p_linea: "lineaId" },
};

function transformArgs(fn: string, args: Record<string, unknown>): any {
  const m = ARG_MAP[fn];
  const out: any = {};
  for (const [k, v] of Object.entries(args)) {
    if (m && m[k]) out[m[k]] = v;
    else {
      let key = k.startsWith("p_") ? k.slice(2) : k;
      key = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      out[key] = v;
    }
  }
  return out;
}
