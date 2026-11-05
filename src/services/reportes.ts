// ============================================================================
// Sistema Taller — Servicio de Informes/Reportes (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §12: reportes de clientes, productos (incluye stock bajo),
// servicios, órdenes, ventas y financieros. Versiones rápidas (todos los
// registros) y personalizadas (con filtros por fecha inicial/final, precio
// inicial/final, stock inicial/final). Devuelve filas + definiciones de
// columnas para el generador de PDF (jsPDF) con encabezado de empresa
// (cabeceraEmpresa) y paginación.
// ============================================================================

import { mensajeError } from "../lib/errores";
import { supabase } from "../lib/supabase";
import { rangoPeriodo, type Periodo } from "../lib/fechas";
import { empresaService } from "./empresa";
import type { Cliente, Categoria, Garantia, MovimientoFinanciero, OrdenTrabajo, Producto, Servicio, Venta } from "../lib/types";

export type TipoReporte =
  | "clientes"
  | "productos"
  | "servicios"
  | "ordenes"
  | "ventas"
  | "financiero";

export interface Columna {
  clave: string;
  titulo: string;
  tipo?: "texto" | "dinero" | "fecha" | "numero";
}

export interface FiltrosReporte {
  /** Para ordenes: estado. */
  estado?: string;
  /** Filtro rango por la columna principal del reporte. */
  fechaInicial?: string;
  fechaFinal?: string;
  precioInicial?: number;
  precioFinal?: number;
  stockInicial?: number;
  stockFinal?: number;
  clienteId?: string;
  /** Solo stock bajo (reportes de productos). */
  soloStockBajo?: boolean;
  /** Solo facturadas (órdenes/ventas). */
  soloFacturadas?: boolean;
}

export interface Reporte {
  tipo: TipoReporte;
  titulo: string;
  columnas: Columna[];
  filas: Record<string, unknown>[];
  empresa: {
    nombre?: string;
    direccion?: string;
    telefono?: string;
    correo?: string;
    logo?: string;
  };
  generadoEn: string;
}

const TITULOS: Record<TipoReporte, string> = {
  clientes: "Reporte de clientes",
  productos: "Reporte de productos",
  servicios: "Reporte de servicios",
  ordenes: "Reporte de órdenes de trabajo",
  ventas: "Reporte de ventas",
  financiero: "Reporte financiero",
};

/** Fecha/hora local formato dd/mm/aaaa hh:mm para el pie del PDF. */
function marcaTiempo(): string {
  const d = new Date();
  const fecha = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const hora = d.toTimeString().slice(0, 5);
  return `${fecha} ${hora}`;
}

function rangos(f: FiltrosReporte) {
  return {
    fechaInicial: f.fechaInicial,
    fechaFinal: f.fechaFinal,
  };
}

function aplicaRangoNumerico(valor: number | null, minimo?: number, maximo?: number): boolean {
  if (minimo !== undefined && (valor ?? 0) < minimo) return false;
  if (maximo !== undefined && (valor ?? 0) > maximo) return false;
  return true;
}

export const reportesService = {
  /** Genera los datos del reporte pedido (rápido o personalizado). */
  async generar(tipo: TipoReporte, filtros: FiltrosReporte = {}): Promise<Reporte> {
    const empresa = await empresaService.obtener();
    const cabecera = {
      nombre: empresa?.nombre,
      direccion: [empresa?.calle, empresa?.numero, empresa?.barrio, empresa?.ciudad, empresa?.provincia]
        .filter(Boolean)
        .join(", "),
      telefono: empresa?.telefono ?? undefined,
      correo: empresa?.correo ?? undefined,
      logo: empresa?.url_logo ?? undefined,
    };
    const rango = rangos(filtros);

    switch (tipo) {
      case "clientes": {
        let q = supabase.from("clientes").select("*").order("nombre_cliente");
        if (rango.fechaInicial) q = q.gte("fecha_registro", rango.fechaInicial);
        if (rango.fechaFinal) q = q.lte("fecha_registro", rango.fechaFinal);
        const { data, error } = await q;
        if (error) throw new Error(mensajeError(error));
        return this._armar("clientes", TITULOS.clientes, cabecera, [
          { clave: "nombre_cliente", titulo: "Nombre" },
          { clave: "documento", titulo: "Documento" },
          { clave: "correo", titulo: "Correo" },
          { clave: "telefono", titulo: "Teléfono" },
          { clave: "ciudad", titulo: "Ciudad" },
          { clave: "fecha_registro", titulo: "Registro", tipo: "fecha" },
        ], (data ?? []) as unknown as Record<string, unknown>[]);
      }
      case "productos": {
        // Para «solo stock bajo» se usa la vista v_stock_alerta (comparación
        // stock < stock_minimo en la base de datos, RF-016).
        if (filtros.soloStockBajo) {
          const { data: alertas, error: errAlerta } = await supabase
            .from("v_stock_alerta")
            .select("id_producto, descripcion, unidad, stock, stock_minimo, faltante");
          if (errAlerta) throw new Error(mensajeError(errAlerta));
          return this._armar("productos", `${TITULOS.productos} (stock bajo)`, cabecera, [
            { clave: "descripcion", titulo: "Descripción" },
            { clave: "unidad", titulo: "Unidad" },
            { clave: "stock", titulo: "Stock", tipo: "numero" },
            { clave: "stock_minimo", titulo: "Stock mínimo", tipo: "numero" },
            { clave: "faltante", titulo: "Faltante", tipo: "numero" },
          ], (alertas ?? []) as unknown as Record<string, unknown>[]);
        }
        const { data, error } = await supabase
          .from("productos")
          .select("*")
          .order("descripcion");
        if (error) throw new Error(mensajeError(error));
        const filas = ((data ?? []) as Producto[])
          .filter((p) =>
            aplicaRangoNumerico(Number(p.precio_venta), filtros.precioInicial, filtros.precioFinal) &&
            aplicaRangoNumerico(Number(p.stock), filtros.stockInicial, filtros.stockFinal)) as unknown as Record<string, unknown>[];
        return this._armar("productos", TITULOS.productos, cabecera, [
          { clave: "descripcion", titulo: "Descripción" },
          { clave: "unidad", titulo: "Unidad" },
          { clave: "precio_compra", titulo: "Precio compra", tipo: "dinero" },
          { clave: "precio_venta", titulo: "Precio venta", tipo: "dinero" },
          { clave: "stock", titulo: "Stock", tipo: "numero" },
          { clave: "stock_minimo", titulo: "Stock mínimo", tipo: "numero" },
        ], filas);
      }
      case "servicios": {
        const q = supabase.from("servicios").select("*").order("nombre");
        const { data, error } = await q;
        if (error) throw new Error(mensajeError(error));
        const filas = ((data ?? []) as Servicio[])
          .filter((s) => aplicaRangoNumerico(Number(s.precio), filtros.precioInicial, filtros.precioFinal)) as unknown as Record<string, unknown>[];
        return this._armar("servicios", TITULOS.servicios, cabecera, [
          { clave: "nombre", titulo: "Nombre" },
          { clave: "descripcion", titulo: "Descripción" },
          { clave: "precio", titulo: "Precio", tipo: "dinero" },
        ], filas);
      }
      case "ordenes": {
        let q = supabase.from("ordenes_trabajo").select("*, clientes(nombre_cliente)").order("fecha_inicial", { ascending: false });
        if (filtros.estado) q = q.eq("estado", filtros.estado);
        if (filtros.clienteId) q = q.eq("cliente_id", filtros.clienteId);
        if (rango.fechaInicial) q = q.gte("fecha_inicial", rango.fechaInicial);
        if (rango.fechaFinal) q = q.lte("fecha_inicial", rango.fechaFinal);
        if (filtros.soloFacturadas) q = q.eq("facturado", true);
        const { data, error } = await q;
        if (error) throw new Error(mensajeError(error));
        const filas = ((data ?? []) as (OrdenTrabajo & { clientes?: { nombre_cliente?: string } | null })[])
          .filter((o) => aplicaRangoNumerico(Number(o.valor_total), filtros.precioInicial, filtros.precioFinal))
          .map((o) => ({
            id_orden: o.id_orden,
            fecha_inicial: o.fecha_inicial,
            cliente: o.clientes?.nombre_cliente ?? "",
            estado: o.estado,
            total: o.valor_total,
            facturado: o.facturado ? "Sí" : "No",
          })) as unknown as Record<string, unknown>[];
        return this._armar("ordenes", TITULOS.ordenes, cabecera, [
          { clave: "fecha_inicial", titulo: "Fecha", tipo: "fecha" },
          { clave: "cliente", titulo: "Cliente" },
          { clave: "estado", titulo: "Estado" },
          { clave: "total", titulo: "Total", tipo: "dinero" },
          { clave: "facturado", titulo: "Facturada" },
        ], filas);
      }
      case "ventas": {
        let q = supabase.from("ventas").select("*, clientes(nombre_cliente)").order("fecha_venta", { ascending: false });
        if (filtros.clienteId) q = q.eq("cliente_id", filtros.clienteId);
        if (rango.fechaInicial) q = q.gte("fecha_venta", rango.fechaInicial);
        if (rango.fechaFinal) q = q.lte("fecha_venta", rango.fechaFinal);
        if (filtros.soloFacturadas) q = q.eq("facturado", true);
        const { data, error } = await q;
        if (error) throw new Error(mensajeError(error));
        const filas = ((data ?? []) as (Venta & { clientes?: { nombre_cliente?: string } | null })[])
          .filter((v) => aplicaRangoNumerico(Number(v.valor_total), filtros.precioInicial, filtros.precioFinal))
          .map((v) => ({
            fecha_venta: v.fecha_venta,
            cliente: v.clientes?.nombre_cliente ?? "",
            descuento: v.descuento,
            total: v.valor_total,
            facturado: v.facturado ? "Sí" : "No",
          })) as unknown as Record<string, unknown>[];
        return this._armar("ventas", TITULOS.ventas, cabecera, [
          { clave: "fecha_venta", titulo: "Fecha", tipo: "fecha" },
          { clave: "cliente", titulo: "Cliente" },
          { clave: "descuento", titulo: "Descuento", tipo: "dinero" },
          { clave: "total", titulo: "Total", tipo: "dinero" },
          { clave: "facturado", titulo: "Facturada" },
        ], filas);
      }
      case "financiero": {
        const periodo: Periodo = "todos";
        const r = rangoPeriodo(periodo);
        let q = supabase
          .from("movimientos_financieros")
          .select("*")
          .order("fecha_vencimiento");
        if (filtros.fechaInicial ?? r.fechaInicial) q = q.gte("fecha_vencimiento", filtros.fechaInicial ?? r.fechaInicial!);
        if (filtros.fechaFinal ?? r.fechaFinal) q = q.lte("fecha_vencimiento", filtros.fechaFinal ?? r.fechaFinal!);
        if (filtros.estado === "ingreso" || filtros.estado === "egreso") q = q.eq("tipo", filtros.estado);
        const { data, error } = await q;
        if (error) throw new Error(mensajeError(error));
        const filas = ((data ?? []) as unknown as (MovimientoFinanciero & { categorias?: Pick<Categoria, "categoria"> | null })[])
          .filter((m) => aplicaRangoNumerico(Number(m.valor), filtros.precioInicial, filtros.precioFinal))
          .map((m) => ({
            fecha_vencimiento: m.fecha_vencimiento,
            descripcion: m.descripcion,
            tipo: m.tipo,
            valor: m.valor,
            categoria: m.categorias?.categoria ?? "",
            pagado: m.pagado ? "Pagado" : "Pendiente",
          })) as unknown as Record<string, unknown>[];
        return this._armar("financiero", TITULOS.financiero, cabecera, [
          { clave: "fecha_vencimiento", titulo: "Vencimiento", tipo: "fecha" },
          { clave: "descripcion", titulo: "Descripción" },
          { clave: "tipo", titulo: "Tipo" },
          { clave: "valor", titulo: "Valor", tipo: "dinero" },
          { clave: "categoria", titulo: "Categoría" },
          { clave: "pagado", titulo: "Situación" },
        ], filas);
      }
      default:
        throw new Error("Tipo de reporte inválido.");
    }
  },

  _armar(
    tipo: TipoReporte,
    titulo: string,
    empresa: Reporte["empresa"],
    columnas: Columna[],
    filas: Record<string, unknown>[],
  ): Reporte {
    return { tipo, titulo, columnas, filas, empresa, generadoEn: marcaTiempo() };
  },

  /** Garantías asociadas para imprimir junto a la orden (garantia_id). */
  async garantiaDeOrden(idGarantia: string): Promise<Garantia | null> {
    const { data, error } = await supabase
      .from("garantias")
      .select("*")
      .eq("id_garantia", idGarantia)
      .maybeSingle();
    if (error) throw new Error(mensajeError(error));
    return (data ?? null) as Garantia | null;
  },
};
