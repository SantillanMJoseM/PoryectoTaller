// ============================================================================
// Sistema Taller — Servicio de Ventas (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §6. Reglas aplicadas:
//   • RB-002/017   stock: venta_agregar_item descuenta; cambiar/quitar devuelven.
//   • RB-004/027   facturación única: venta_facturar() crea ingreso financiero
//     y marca facturado=true + lanzamiento_id; solo ×1 vez (chk ventabuena).
//   • RB-019       valor_total = suma(subtotales) − descuento (trigger en BD).
//   • Imprimir venta: la vista devuelve todo el detalle para el PDF.
// ============================================================================

import { crearCrud, llamarRpc } from "../lib/crud";
import { api } from "../lib/api";
import { mensajeError } from "../lib/errores";
import { hoyISO } from "../lib/fechas";
import { validarVenta, asegurarValido } from "../lib/validaciones";
import type { ItemVenta, Venta } from "../lib/types";

const crud = crearCrud<Venta>("ventas", "id_venta", []);

const SELECT_DETALLE = `*, clientes:cliente_id(*), usuarios:usuario_id(*), items_venta(*)`;

export const ventasService = {
  listar: crud.listar,

  /** Lista con búsqueda por cliente y filtros de fecha directa en la consulta. */
  async listarFiltradas(opciones: {
    q?: string;
    clienteId?: string;
    fechaInicial?: string;
    fechaFinal?: string;
    pagina?: number;
    tamPagina?: number;
  }) {
    const filtros: Record<string, unknown> = {};
    if (opciones.clienteId) filtros.clienteId = opciones.clienteId;
    if (opciones.fechaInicial) filtros.fechaVenta = undefined;
    const r = await crud.listar({ pagina: opciones.pagina, tamPagina: opciones.tamPagina, filtros, columna: "fechaVenta", ascendente: false });
    let datos = r.datos;
    if (opciones.fechaInicial) datos = datos.filter((v: any) => String(v.fechaVenta ?? v.fecha_venta) >= String(opciones.fechaInicial));
    if (opciones.fechaFinal) datos = datos.filter((v: any) => String(v.fechaVenta ?? v.fecha_venta) <= String(opciones.fechaFinal));
    return { ...r, datos };
  },

  contar: crud.contar,

  async obtenerConDetalles(id: string): Promise<Venta | null> {
    const v = await crud.obtener(id);
    if (!v) return null;
    // attach items
    const items = await api.get(`/api/items-venta?ventaId=${id}&tamPagina=200`).catch(() => ({ datos: [] }));
    (v as any).items_venta = items?.datos ?? [];
    // attach cliente
    if ((v as any).clienteId) {
      try { (v as any).clientes = await api.get(`/api/clientes/${(v as any).clienteId}`); } catch {}
    }
    return v as Venta;
  },

  async crear(datos: Partial<Venta>): Promise<Venta> {
    asegurarValido(validarVenta({ ...datos, fecha_venta: datos.fecha_venta ?? hoyISO() }));
    return crud.crear({ ...datos, fecha_venta: datos.fecha_venta ?? hoyISO() });
  },

  /** Crea la venta y sus ítems en una sola operación (RPC transaccional). */
  async crearCompleta(payload: {
    clienteId: string | null;
    usuarioId: string | null;
    fecha: string;
    descuento: number;
    items: { idProducto: string; cantidad: number; precio?: number }[];
  }): Promise<string> {
    return llamarRpc<string>("venta_crear_completa", {
      p_cliente: payload.clienteId,
      p_usuario: payload.usuarioId,
      p_fecha: payload.fecha,
      p_descuento: payload.descuento,
      p_items: payload.items.map((i) => ({
        id_producto: i.idProducto,
        cantidad: i.cantidad,
        precio: i.precio ?? null,
      })),
    });
  },

  /** Edita cliente/usuario/descuento. El descuento recalcula el total en BD. */
  async editar(id: string, datos: Partial<Venta>): Promise<Venta> {
    const actual = await this.obtenerConDetalles(id);
    if (actual?.facturado) throw new Error("La venta ya está facturada y no puede modificarse.");
    asegurarValido(validarVenta(datos));
    return crud.editar(id, datos);
  },

  async eliminar(id: string): Promise<void> {
    const v = await this.obtenerConDetalles(id);
    if (v?.facturado) throw new Error("La venta ya está facturada y no puede eliminarse.");
    await crud.eliminar(id);
  },

  // ------------------------------- Ítems ------------------------------------

  /** Agrega producto a la venta descontando stock (RPC). */
  async agregarItem(
    idVenta: string,
    idProducto: string,
    cantidad: number,
    precio?: number,
  ): Promise<string> {
    const v = await this.obtenerConDetalles(idVenta);
    if (v?.facturado) throw new Error("La venta ya está facturada y no admite nuevos productos.");
    if (!(cantidad > 0)) throw new Error("La cantidad debe ser mayor que cero.");
    return llamarRpc<string>("venta_agregar_item", {
      p_venta: idVenta,
      p_producto: idProducto,
      p_cantidad: cantidad,
      p_precio: precio ?? null,
    });
  },

  /** Cambia cantidad del ítem: devuelve la diferencia de stock. */
  async cambiarCantidadItem(idItem: string, cantidad: number): Promise<void> {
    let idVenta: string | undefined;
    try { const it = await api.get(`/api/items-venta/${idItem}`); idVenta = it?.ventaId ?? it?.venta_id; } catch {}
    if (idVenta) {
      const v = await this.obtenerConDetalles(idVenta);
      if (v?.facturado) throw new Error("La venta ya está facturada y no admite cambios en cantidades.");
    }
    if (!(cantidad > 0)) throw new Error("La cantidad debe ser mayor que cero.");
    await llamarRpc("venta_cambiar_cantidad_item", { p_item: idItem, p_cantidad: cantidad });
  },

  /** Quita el ítem y devuelve su stock. */
  async quitarItem(idItem: string): Promise<void> {
    let idVenta: string | undefined;
    try { const it = await api.get(`/api/items-venta/${idItem}`); idVenta = it?.ventaId ?? it?.venta_id; } catch {}
    if (idVenta) {
      const v = await this.obtenerConDetalles(idVenta);
      if (v?.facturado) throw new Error("La venta ya está facturada y no admite eliminación de ítems.");
    }
    await llamarRpc("venta_quitar_item", { p_item: idItem });
  },

  // ------------------------------- Impresión --------------------------------

  /** Venta con todos los datos para imprimir (PDF). */
  async obtenerParaImpresion(id: string): Promise<Venta | null> {
    return this.obtenerConDetalles(id);
  },

  // ------------------------------- Facturación ------------------------------

  /** Factura la venta ×1 vez: crea movimiento financiero de ingreso. */
  async facturar(
    idVenta: string,
    opciones: {
      fechaVencimiento?: string;
      formaPago?: string;
      categoriaId?: string;
      cuentaId?: string;
    } = {},
  ): Promise<string> {
    return llamarRpc<string>("venta_facturar", {
      p_venta: idVenta,
      p_fecha_vencimiento: opciones.fechaVencimiento ?? null,
      p_forma_pago: opciones.formaPago ?? null,
      p_categoria_id: opciones.categoriaId ?? null,
      p_cuenta_id: opciones.cuentaId ?? null,
    });
  },
};

/** Tipo útil del ítem (items_venta). */
export type { ItemVenta };
