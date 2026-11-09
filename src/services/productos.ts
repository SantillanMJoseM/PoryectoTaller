// ============================================================================
// Sistema Taller — Servicio de Productos (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §3: campos de compra/venta, unidad, stock y stock mínimo;
// alerta de stock bajo (vista v_stock_alerta); el stock NO se edita a mano:
// se descuenta al agregar producto a una orden/venta y se incrementa al
// quitarlo (RPCs de 0004_negocio.sql + guard f_stock_no_directo).
// Ajuste de inventario manual solo con ajustarStock(p_delta).
// ============================================================================

import { crearCrud, llamarRpc } from "../lib/crud";
import { mensajeError } from "../lib/errores";
import { api } from "../lib/api";
import { validarProducto } from "../lib/validaciones";
import type { Producto } from "../lib/types";

const crud = crearCrud<Producto>("productos", "id_producto", ["descripcion"]);

export const productosService = {
  listar: crud.listar,
  obtener: crud.obtener,
  contar: crud.contar,

  async crear(datos: Partial<Producto>): Promise<Producto> {
    if (!datos.descripcion?.trim())
      throw new Error("La descripción del producto es obligatoria.");
    const errores = validarProducto(datos);
    if (Object.keys(errores).length > 0)
      throw new Error("Datos inválidos: " + Object.values(errores).join(" "));
    return crud.crear({ ...datos, stock: datos.stock ?? 0 });
  },

  async editar(id: string, datos: Partial<Producto>): Promise<Producto> {
    // Si el payload cambia «stock», se retira: el stock no se toca directo
    // (guard en Postgres); el ajuste es solo con ajustarStock().
    if ("stock" in datos) delete datos.stock;
    const errores = validarProducto(datos);
    if (Object.keys(errores).length > 0)
      throw new Error("Datos inválidos: " + Object.values(errores).join(" "));
    return crud.editar(id, datos);
  },

  eliminar: crud.eliminar,

  /** Productos con stock por debajo del mínimo (alerta RF-016). */
  async alertaStock(): Promise<
    { id_producto: string; descripcion: string; stock: number; stock_minimo: number; faltante: number }[]
  > {
    const r = await api.get("/api/productos?tamPagina=500").catch(()=>({datos:[]}));
    const data = (r?.datos ?? []).filter((p:any)=> Number(p.stock) < Number(p.stock_minimo)).map((p:any)=>({...p, faltante: Number(p.stock_minimo)-Number(p.stock)}));
    return data;
  },

  /** Habilitado para vender/usar en órdenes (salida=true). */
  async habilitadosSalida(q?: string, limite = 20): Promise<Producto[]> {
    const r = await api.get(`/api/productos?salida=true&tamPagina=${limite}${q?`&q=${encodeURIComponent(q.trim())}`:""}`).catch(()=>({datos:[]}));
    return (r?.datos ?? []) as Producto[];
  },

  /** Autocompletado de productos (aparece en órdenes y ventas). */
  async autocompletar(q: string, limite = 10): Promise<Producto[]> {
    if (!q?.trim()) return [];
    const r = await api.get(`/api/productos?q=${encodeURIComponent(q.trim())}&tamPagina=${limite}`).catch(()=>({datos:[]}));
    return (r?.datos ?? []) as Producto[];
  },

  /** Ajuste de inventario autorizado (única vía sin orden/venta). */
  ajustarStock: async (idProducto: string, delta: number): Promise<void> => {
    await llamarRpc("ajustar_stock", { p_producto: idProducto, p_delta: delta });
  },
};
