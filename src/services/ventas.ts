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
import { mensajeError } from "../lib/errores";
import { hoyISO } from "../lib/fechas";
import { supabase } from "../lib/supabase";
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
    const pagina = Math.max(1, opciones.pagina ?? 1);
    const tamPagina = Math.min(Math.max(1, opciones.tamPagina ?? 20), 200);
    let consulta = supabase
      .from("ventas")
      .select(`*, clientes:cliente_id(nombre_cliente, documento)`, { count: "exact" })
      .range((pagina - 1) * tamPagina, pagina * tamPagina - 1)
      .order("fecha_venta", { ascending: false });
    if (opciones.q?.trim())
      consulta = consulta.ilike("clientes.nombre_cliente", `%${opciones.q.trim()}%`);
    if (opciones.clienteId) consulta = consulta.eq("cliente_id", opciones.clienteId);
    if (opciones.fechaInicial) consulta = consulta.gte("fecha_venta", opciones.fechaInicial);
    if (opciones.fechaFinal) consulta = consulta.lte("fecha_venta", opciones.fechaFinal);
    const { data, error, count } = await consulta;
    if (error) throw new Error(mensajeError(error));
    const total = count ?? 0;
    return {
      datos: (data ?? []) as Venta[],
      total,
      pagina,
      tamPagina,
      paginas: Math.max(1, Math.ceil(total / tamPagina)),
    };
  },

  contar: crud.contar,

  async obtenerConDetalles(id: string): Promise<Venta | null> {
    const { data, error } = await supabase
      .from("ventas")
      .select(SELECT_DETALLE)
      .eq("id_venta", id)
      .maybeSingle();
    if (error) throw new Error(mensajeError(error));
    return (data ?? null) as Venta | null;
  },

  async crear(datos: Partial<Venta>): Promise<Venta> {
    asegurarValido(validarVenta({ ...datos, fecha_venta: datos.fecha_venta ?? hoyISO() }));
    return crud.crear({ ...datos, fecha_venta: datos.fecha_venta ?? hoyISO() });
  },

  /** Edita cliente/usuario/descuento. El descuento recalcula el total en BD. */
  async editar(id: string, datos: Partial<Venta>): Promise<Venta> {
    asegurarValido(validarVenta(datos));
    return crud.editar(id, datos);
  },

  eliminar: crud.eliminar,

  // ------------------------------- Ítems ------------------------------------

  /** Agrega producto a la venta descontando stock (RPC). */
  async agregarItem(
    idVenta: string,
    idProducto: string,
    cantidad: number,
    precio?: number,
  ): Promise<string> {
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
    if (!(cantidad > 0)) throw new Error("La cantidad debe ser mayor que cero.");
    await llamarRpc("venta_cambiar_cantidad_item", { p_item: idItem, p_cantidad: cantidad });
  },

  /** Quita el ítem y devuelve su stock. */
  async quitarItem(idItem: string): Promise<void> {
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
