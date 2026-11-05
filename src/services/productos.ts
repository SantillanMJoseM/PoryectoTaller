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
import { supabase } from "../lib/supabase";
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
    const { data, error } = await supabase
      .from("v_stock_alerta")
      .select("id_producto, descripcion, stock, stock_minimo, faltante")
      .order("faltante", { ascending: false });
    if (error) throw new Error(mensajeError(error));
    return data ?? [];
  },

  /** Habilitado para vender/usar en órdenes (salida=true). */
  async habilitadosSalida(q?: string, limite = 20): Promise<Producto[]> {
    let consulta = supabase
      .from("productos")
      .select("id_producto, descripcion, precio_venta, stock, unidad")
      .eq("salida", true)
      .order("descripcion")
      .limit(limite);
    if (q && q.trim()) consulta = consulta.ilike("descripcion", `%${q.trim()}%`);
    const { data, error } = await consulta;
    if (error) throw new Error(mensajeError(error));
    return (data ?? []) as Producto[];
  },

  /** Autocompletado de productos (aparece en órdenes y ventas). */
  async autocompletar(q: string, limite = 10): Promise<Producto[]> {
    if (!q?.trim()) return [];
    const { data, error } = await supabase
      .from("productos")
      .select("id_producto, descripcion, precio_venta, precio_compra, stock, unidad")
      .ilike("descripcion", `%${q.trim()}%`)
      .order("descripcion")
      .limit(limite);
    if (error) throw new Error(mensajeError(error));
    return (data ?? []) as Producto[];
  },

  /** Ajuste de inventario autorizado (única vía sin orden/venta). */
  ajustarStock: async (idProducto: string, delta: number): Promise<void> => {
    await llamarRpc("ajustar_stock", { p_producto: idProducto, p_delta: delta });
  },
};
