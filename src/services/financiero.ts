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
import { api } from "../lib/api";
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
    const r = await api.get(`/api/movimientos?tamPagina=500`).catch(()=>({datos:[]}));
    let data = r?.datos ?? [];
    if (rango.fechaInicial) data = data.filter((m:any)=> String(m.fecha_vencimiento ?? m.fechaVencimiento) >= String(rango.fechaInicial));
    if (rango.fechaFinal) data = data.filter((m:any)=> String(m.fecha_vencimiento ?? m.fechaVencimiento) <= String(rango.fechaFinal));
    if (opciones.tipo) data = data.filter((m:any)=> m.tipo === opciones.tipo);
    if (opciones.clienteId) data = data.filter((m:any)=> (m.cliente_id ?? m.clienteId) === opciones.clienteId);
    if (opciones.categoriaId) data = data.filter((m:any)=> (m.categoria_id ?? m.categoriaId) === opciones.categoriaId);
    if (opciones.cuentaId) data = data.filter((m:any)=> (m.cuenta_id ?? m.cuentaId) === opciones.cuentaId);
    if (opciones.q?.trim()) {
      const q = opciones.q.trim().toLowerCase();
      data = data.filter((m:any)=> String(m.descripcion ?? "").toLowerCase().includes(q) || String(m.cliente_proveedor ?? m.clienteProveedor ?? "").toLowerCase().includes(q));
    }
    data.sort((a:any,b:any)=> String(a.fecha_vencimiento ?? a.fechaVencimiento).localeCompare(String(b.fecha_vencimiento ?? b.fechaVencimiento)));

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
    const r = await api.get(`/api/categorias?estado=true&tamPagina=500`).catch(()=>({datos:[]}));
    let data = r?.datos ?? [];
    if (tipo) data = data.filter((c:any)=> c.tipo === tipo);
    return data as Categoria[];
  },

  // -------------------------------- Cuentas ---------------------------------

  cuentas: crearCrud<Cuenta>("cuentas", "id_cuenta", ["cuenta", "banco"]),

  /** Solo cuentas activas. */
  async listarCuentas(): Promise<Cuenta[]> {
    const r = await api.get(`/api/cuentas?estado=true&tamPagina=500`).catch(()=>({datos:[]}));
    return (r?.datos ?? []) as Cuenta[];
  },
};
