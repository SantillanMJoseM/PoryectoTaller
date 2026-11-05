// ============================================================================
// Sistema Taller — Servicio de Financiero (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §8: movimientos ingreso/egreso; valor, vencimiento, pago;
// cliente/proveedor, categoría, cuenta, forma de pago, anexo; vinculación con
// venta; filtros por período (día/semana/mes/año/todos) y situación
// (todos/previsto/atrasado/realizado/pendiente); totales por período;
// detección de vencidos. RB-014: pagado exige fecha_pago (RPC mov_marcar_pagado).
// También gestiona categorías y cuentas (tablas del prompt).
// ============================================================================

import { crearCrud, llamarRpc } from "../lib/crud";
import { mensajeError } from "../lib/errores";
import { rangoPeriodo, estaVencido, type Periodo } from "../lib/fechas";
import { supabase } from "../lib/supabase";
import {
  pasaSituacion,
  resumenTotales,
  situacion,
  type Situacion,
  type TotalPorTipo,
} from "../lib/financiero-utils";
import { validarMovimiento, asegurarValido } from "../lib/validaciones";
import type { Categoria, Cuenta, MovimientoFinanciero, TipoMovimiento } from "../lib/types";

const crud = crearCrud<MovimientoFinanciero>("movimientos_financieros", "id_movimiento", [
  "descripcion",
  "cliente_proveedor",
]);

export interface ResumenFinanciero extends TotalPorTipo {
  vencidos: number;
  pendientes: number;
  totalRegistros: number;
}

export const financieroService = {
  listar: crud.listar,
  obtener: crud.obtener,
  contar: crud.contar,

  /** Listado con filtros de período + situación + tipo + cliente.
   *  La situación puede venir de la vista v_movimientos_situacion; para no
   *  depender de la vista se calcula con la misma regla (financiero-utils). */
  async listarFiltradas(opciones: {
    periodo?: Periodo;
    situacionFiltro?: Situacion;
    tipo?: TipoMovimiento;
    clienteId?: string;
    categoriaId?: string;
    cuentaId?: string;
    q?: string;
    pagina?: number;
    tamPagina?: number;
  }): Promise<{
    datos: (MovimientoFinanciero & { situacion: string; vencido: boolean })[];
    totales: TotalPorTipo;
    vencidos: number;
    pendientes: number;
    total: number;
    pagina: number;
    tamPagina: number;
    paginas: number;
  }> {
    const pagina = Math.max(1, opciones.pagina ?? 1);
    const tamPagina = Math.min(Math.max(1, opciones.tamPagina ?? 20), 200);
    const rango = rangoPeriodo(opciones.periodo ?? "todos");

    // Consulta amplia (sin paginar) para aplicar el filtro de situación,
    // que no es una columna (es una regla), y luego paginar en memoria.
    let consulta = supabase
      .from("movimientos_financieros")
      .select(`*, clientes:cliente_id(nombre_cliente), categorias:categoria_id(categoria), cuentas:cuenta_id(cuenta)`);
    if (rango.fechaInicial) consulta = consulta.gte("fecha_vencimiento", rango.fechaInicial);
    if (rango.fechaFinal) consulta = consulta.lte("fecha_vencimiento", rango.fechaFinal);
    if (opciones.tipo) consulta = consulta.eq("tipo", opciones.tipo);
    if (opciones.clienteId) consulta = consulta.eq("cliente_id", opciones.clienteId);
    if (opciones.categoriaId) consulta = consulta.eq("categoria_id", opciones.categoriaId);
    if (opciones.cuentaId) consulta = consulta.eq("cuenta_id", opciones.cuentaId);
    if (opciones.q?.trim())
      consulta = consulta.or(
        `descripcion.ilike.%${opciones.q.trim()}%,cliente_proveedor.ilike.%${opciones.q.trim()}%`,
      );
    consulta = consulta.order("fecha_vencimiento", { ascending: true });

    const { data, error } = await consulta;
    if (error) throw new Error(mensajeError(error));

    const filtroSit = opciones.situacionFiltro ?? "todos";
    const enriquecidos = (data ?? []).map((m) => {
      const mov = m as unknown as MovimientoFinanciero;
      return {
        ...mov,
        situacion: situacion(mov),
        vencido: estaVencido(mov.fecha_vencimiento, mov.pagado),
      };
    });
    const filtrados = enriquecidos.filter((m) => pasaSituacion(m, filtroSit));
    const total = filtrados.length;
    const desde = (pagina - 1) * tamPagina;
    const paginaDatos = filtrados.slice(desde, desde + tamPagina);
    return {
      datos: paginaDatos,
      totales: resumenTotales(filtrados),
      vencidos: filtrados.filter((m) => m.vencido).length,
      pendientes: filtrados.filter((m) => !m.pagado).length,
      total,
      pagina,
      tamPagina,
      paginas: Math.max(1, Math.ceil(total / tamPagina)),
    };
  },

  /** Crea movimiento; RB-014: si pagado=true exige fecha_pago. */
  async crear(datos: Partial<MovimientoFinanciero>): Promise<MovimientoFinanciero> {
    if (!datos.descripcion?.trim()) throw new Error("La descripción es obligatoria.");
    if (datos.tipo !== "ingreso" && datos.tipo !== "egreso")
      throw new Error("Tipo inválido (ingreso o egreso).");
    asegurarValido(validarMovimiento(datos));
    return crud.crear(datos);
  },

  async editar(id: string, datos: Partial<MovimientoFinanciero>): Promise<MovimientoFinanciero> {
    const errores = validarMovimiento({ ...datos });
    delete (errores as Record<string, string>).descripcion;
    if (Object.keys(errores).length > 0)
      throw new Error("Datos inválidos: " + Object.values(errores).join(" "));
    return crud.editar(id, datos);
  },

  eliminar: crud.eliminar,

  /** Marca el pago con fecha (RPC mov_marcar_pagado; permiso eMovimiento). */
  async marcarPagado(idMovimiento: string, fechaPago?: string): Promise<void> {
    await llamarRpc("mov_marcar_pagado", {
      p_movimiento: idMovimiento,
      p_fecha_pago: fechaPago ?? undefined,
    });
  },

  /** Resumen del período: ingresos, egresos, saldo, vencidos. */
  async resumen(periodo: Periodo = "todos"): Promise<ResumenFinanciero> {
    const res = await this.listarFiltradas({ periodo, situacionFiltro: "todos", tamPagina: 1 });
    return {
      ...res.totales,
      vencidos: res.vencidos,
      pendientes: res.pendientes,
      totalRegistros: res.total,
    };
  },

  // ------------------------------- Categorías -------------------------------

  categorias: crearCrud<Categoria>("categorias", "id_categoria", ["categoria"]),

  /** Solo categorías activas (para el formulario de movimientos). */
  async listarCategorias(tipo?: TipoMovimiento): Promise<Categoria[]> {
    let consulta = supabase
      .from("categorias")
      .select("*")
      .eq("estado", true)
      .order("categoria");
    if (tipo) consulta = consulta.eq("tipo", tipo);
    const { data, error } = await consulta;
    if (error) throw new Error(mensajeError(error));
    return (data ?? []) as Categoria[];
  },

  // -------------------------------- Cuentas ---------------------------------

  cuentas: crearCrud<Cuenta>("cuentas", "id_cuenta", ["cuenta", "banco"]),

  /** Solo cuentas activas. */
  async listarCuentas(): Promise<Cuenta[]> {
    const { data, error } = await supabase
      .from("cuentas")
      .select("*")
      .eq("estado", true)
      .order("cuenta");
    if (error) throw new Error(mensajeError(error));
    return (data ?? []) as Cuenta[];
  },
};
