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
import { api } from "../lib/api";
import { rangoPeriodo, type Periodo } from "../lib/fechas";
import { empresaService, logoComoDataUrl } from "./empresa";
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
      logo: await logoComoDataUrl(empresa?.url_logo),
    };
    const rango = rangos(filtros);

    switch (tipo) {
      case "clientes": {
        const r = await api.get("/api/clientes?tamPagina=500").catch(()=>({datos:[]}));
        let data = r?.datos ?? [];
        if (rango.fechaInicial) data = data.filter((c:any)=> String(c.fecha_registro) >= String(rango.fechaInicial));
        if (rango.fechaFinal) data = data.filter((c:any)=> String(c.fecha_registro) <= String(rango.fechaFinal));
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
          const r = await api.get("/api/productos?tamPagina=500").catch(()=>({datos:[]}));
          const alertas = (r?.datos ?? []).filter((p:any)=> Number(p.stock) < Number(p.stock_minimo)).map((p:any)=>({...p, faltante: Number(p.stock_minimo)-Number(p.stock)}));
          return this._armar("productos", `${TITULOS.productos} (stock bajo)`, cabecera, [
            { clave: "descripcion", titulo: "Descripción" },
            { clave: "unidad", titulo: "Unidad" },
            { clave: "stock", titulo: "Stock", tipo: "numero" },
            { clave: "stock_minimo", titulo: "Stock mínimo", tipo: "numero" },
            { clave: "faltante", titulo: "Faltante", tipo: "numero" },
          ], (alertas ?? []) as unknown as Record<string, unknown>[]);
        }
        const rr = await api.get("/api/productos?tamPagina=500").catch(()=>({datos:[]}));
        const data = rr?.datos ?? [];
        const filas = (data as Producto[])
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
        const rr = await api.get("/api/servicios?tamPagina=500").catch(()=>({datos:[]}));
        const data = rr?.datos ?? [];
        const filas = (data as Servicio[])
          .filter((s) => aplicaRangoNumerico(Number(s.precio), filtros.precioInicial, filtros.precioFinal)) as unknown as Record<string, unknown>[];
        return this._armar("servicios", TITULOS.servicios, cabecera, [
          { clave: "nombre", titulo: "Nombre" },
          { clave: "descripcion", titulo: "Descripción" },
          { clave: "precio", titulo: "Precio", tipo: "dinero" },
        ], filas);
      }
      case "ordenes": {
        const rr = await api.get("/api/ordenes?tamPagina=500").catch(()=>({datos:[]}));
        let data = rr?.datos ?? [];
        if (filtros.estado) data = data.filter((o:any)=>o.estado===filtros.estado);
        if (filtros.clienteId) data = data.filter((o:any)=>o.cliente_id===filtros.clienteId || o.clienteId===filtros.clienteId);
        if (rango.fechaInicial) data = data.filter((o:any)=>String(o.fecha_inicial ?? o.fechaInicial)>=String(rango.fechaInicial));
        if (rango.fechaFinal) data = data.filter((o:any)=>String(o.fecha_inicial ?? o.fechaInicial)<=String(rango.fechaFinal));
        if (filtros.soloFacturadas) data = data.filter((o:any)=>o.facturado);
        // attach cliente names
        for (const o of data) { if (o.cliente_id || o.clienteId) { try { const c = await api.get(`/api/clientes/${o.cliente_id ?? o.clienteId}`); o.clientes = { nombre_cliente: c?.nombre_cliente ?? c?.nombreCliente }; } catch {} } }
        const filas = (data as any[])
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
        const rr = await api.get("/api/ventas?tamPagina=500").catch(()=>({datos:[]}));
        let data = rr?.datos ?? [];
        if (filtros.clienteId) data = data.filter((v:any)=> (v.cliente_id ?? v.clienteId)===filtros.clienteId);
        if (rango.fechaInicial) data = data.filter((v:any)=> String(v.fecha_venta ?? v.fechaVenta) >= String(rango.fechaInicial));
        if (rango.fechaFinal) data = data.filter((v:any)=> String(v.fecha_venta ?? v.fechaVenta) <= String(rango.fechaFinal));
        if (filtros.soloFacturadas) data = data.filter((v:any)=>v.facturado);
        for (const v of data) { if (v.cliente_id ?? v.clienteId) { try { const c = await api.get(`/api/clientes/${v.cliente_id ?? v.clienteId}`); v.clientes = { nombre_cliente: c?.nombre_cliente ?? c?.nombreCliente }; } catch {} } }
        const filas = (data as any[])
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
        const rr = await api.get("/api/movimientos?tamPagina=500").catch(()=>({datos:[]}));
        let data = rr?.datos ?? [];
        const fi = filtros.fechaInicial ?? r.fechaInicial;
        const ff = filtros.fechaFinal ?? r.fechaFinal;
        if (fi) data = data.filter((m:any)=> String(m.fecha_vencimiento ?? m.fechaVencimiento) >= String(fi));
        if (ff) data = data.filter((m:any)=> String(m.fecha_vencimiento ?? m.fechaVencimiento) <= String(ff));
        if (filtros.estado === "ingreso" || filtros.estado === "egreso") data = data.filter((m:any)=>m.tipo===filtros.estado);
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
    try { return await api.get(`/api/garantias/${idGarantia}`); } catch { return null; }
  },
};
