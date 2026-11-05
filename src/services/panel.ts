// ============================================================================
// Sistema Taller — Servicio del Panel principal (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §1: resumen operativo — órdenes abiertas, productos con
// stock bajo, últimas ventas, movimientos pendientes; accesos rápidos a
// módulos (los definimos con etiquetas y ruta) y menú según permisos.
// ============================================================================

import { mensajeError } from "../lib/errores";
import { supabase } from "../lib/supabase";
import { productosService } from "./productos";
import { financieroService } from "./financiero";
import type { OrdenTrabajo, Producto, Venta, MovimientoFinanciero } from "../lib/types";

/** Accesos rápidos (etiqueta y ruta) que el panel muestra como atajos. */
export const ACCESOS_RAPIDOS = [
  { etiqueta: "Órdenes de trabajo", ruta: "/ordenes" },
  { etiqueta: "Clientes", ruta: "/clientes" },
  { etiqueta: "Productos", ruta: "/productos" },
  { etiqueta: "Ventas", ruta: "/ventas" },
  { etiqueta: "Financiero", ruta: "/financiero" },
  { etiqueta: "Informes", ruta: "/reportes" },
] as const;

export interface ResumenPanel {
  ordenesAbiertas: number;
  productosStockBajo: { producto: string; stock: number; minimo: number }[];
  ultimasVentas: Venta[];
  movimientosPendientes: {
    total: number;
    vencidos: number;
    datos: (MovimientoFinanciero & { vencido: boolean })[];
  };
  ordenesRecientes: OrdenTrabajo[];
}

export const panelService = {
  /** Resumen operativo completo para la pantalla principal. */
  async resumen(): Promise<ResumenPanel> {
    const [ordenesAbiertas, alertas, ventas, movimientos, ordenesRecientes] = await Promise.all([
      // Abiertas = Abierta, En Proceso o Aguardando Piezas (no presupuesto,
      // no canceladas, no finalizadas).
      supabase
        .from("ordenes_trabajo")
        .select("id_orden", { count: "exact", head: true })
        .in("estado", ["Abierta", "En Proceso", "Aguardando Piezas"]),
      productosService.alertaStock(),
      supabase
        .from("ventas")
        .select("*, clientes:cliente_id(nombre_cliente)")
        .order("fecha_venta", { ascending: false })
        .limit(5),
      financieroService.listarFiltradas({ periodo: "todos", situacionFiltro: "pendiente", tamPagina: 10 }),
      supabase
        .from("ordenes_trabajo")
        .select("*")
        .order("fecha_inicial", { ascending: false })
        .limit(5),
    ]);

    if (ordenesAbiertas.error) throw new Error(mensajeError(ordenesAbiertas.error));
    if (ventas.error) throw new Error(mensajeError(ventas.error));
    if (ordenesRecientes.error) throw new Error(mensajeError(ordenesRecientes.error));

    return {
      ordenesAbiertas: ordenesAbiertas.count ?? 0,
      productosStockBajo: alertas.map((a) => ({
        producto: a.descripcion,
        stock: Number(a.stock),
        minimo: Number(a.stock_minimo),
      })),
      ultimasVentas: (ventas.data ?? []) as Venta[],
      movimientosPendientes: {
        total: movimientos.total,
        vencidos: movimientos.vencidos,
        datos: movimientos.datos,
      },
      ordenesRecientes: (ordenesRecientes.data ?? []) as OrdenTrabajo[],
    };
  },

  /** Conteo de productos con stock bajo (tarjeta del panel). */
  async conteoStockBajo(): Promise<number> {
    const alertas = await productosService.alertaStock();
    return alertas.length;
  },

  /** Órdenes abiertas por estado (mini-report para el panel). */
  async ordenesPorEstado(): Promise<{ estado: string; cantidad: number }[]> {
    const { data, error } = await supabase.from("ordenes_trabajo").select("estado");
    if (error) throw new Error(mensajeError(error));
    const conteo = new Map<string, number>();
    for (const fila of (data ?? []) as { estado: string }[]) {
      conteo.set(fila.estado, (conteo.get(fila.estado) ?? 0) + 1);
    }
    return [...conteo.entries()].map(([estado, cantidad]) => ({ estado, cantidad }));
  },
};

/** tipo alias para listados de productos en el panel */
export type { Producto };
