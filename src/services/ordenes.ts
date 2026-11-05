// ============================================================================
// Sistema Taller — Servicio de Órdenes de Trabajo (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §5. Reglas de negocio aplicadas aquí:
//   • RB-002/017/020  stock: la RPC orden_agregar_producto descuenta stock;
//     orden_cambiar_cantidad_producto / orden_quitar_producto lo devuelven.
//   • RB-003/027      facturación única: orden_facturar() crea el movimiento
//     financiero y marca facturado=true + lanzamiento_id.
//   • RF-021          fecha_final automática al Finalizar (trigger en BD).
//   • RB-018          valor_total recalculado por trigger al mover líneas.
//   • Adjuntos en Storage bucket «anexos-orden»; envío por correo entra en la
//     cola de emails (tabla cola_emails).
// ============================================================================

import { crearCrud, llamarRpc } from "../lib/crud";
import { mensajeError } from "../lib/errores";
import { hoyISO } from "../lib/fechas";
import { supabase } from "../lib/supabase";
import { subtotalLinea, redondear } from "../lib/dinero";
import { validarOrden } from "../lib/validaciones";
import type {
  Anexo,
  EstadoOrden,
  OrdenTrabajo,
  ProductoOrden,
  ServicioOrden,
  Servicio,
} from "../lib/types";

const crud = crearCrud<OrdenTrabajo>("ordenes_trabajo", "id_orden", ["descripcion_producto", "defecto", "observaciones"]);

const SELECT_DETALLE = `*, clientes:id_cliente(*), usuarios:id_usuario(*), garantias:id_garantia(*)`;

export const ordenesService = {
  listar: crud.listar,
  contar: crud.contar,

  /** Órden por estado, cliente o rango de fechas (uso en panel/informes). */
  async listarFiltradas(opciones: {
    estado?: EstadoOrden;
    clienteId?: string;
    fechaInicial?: string;
    fechaFinal?: string;
    pagina?: number;
    tamPagina?: number;
  }) {
    const pagina = Math.max(1, opciones.pagina ?? 1);
    const tamPagina = Math.min(Math.max(1, opciones.tamPagina ?? 20), 200);
    let consulta = supabase
      .from("ordenes_trabajo")
      .select("*", { count: "exact" })
      .range((pagina - 1) * tamPagina, pagina * tamPagina - 1)
      .order("fecha_inicial", { ascending: false });
    if (opciones.estado) consulta = consulta.eq("estado", opciones.estado);
    if (opciones.clienteId) consulta = consulta.eq("cliente_id", opciones.clienteId);
    if (opciones.fechaInicial) consulta = consulta.gte("fecha_inicial", opciones.fechaInicial);
    if (opciones.fechaFinal) consulta = consulta.lte("fecha_inicial", opciones.fechaFinal);
    const { data, error, count } = await consulta;
    if (error) throw new Error(mensajeError(error));
    const total = count ?? 0;
    return {
      datos: (data ?? []) as OrdenTrabajo[],
      total,
      pagina,
      tamPagina,
      paginas: Math.max(1, Math.ceil(total / tamPagina)),
    };
  },

  /** Detalle completo con cliente, usuario/técnico y garantía asociada. */
  async obtenerConDetalles(id: string): Promise<OrdenTrabajo | null> {
    const { data, error } = await supabase
      .from("ordenes_trabajo")
      .select(SELECT_DETALLE)
      .eq("id_orden", id)
      .maybeSingle();
    if (error) throw new Error(mensajeError(error));
    return (data ?? null) as OrdenTrabajo | null;
  },

  /** Líneas de producto y servicio de la orden. */
  async obtenerLineas(id: string): Promise<{ productos: ProductoOrden[]; servicios: ServicioOrden[] }> {
    const [prod, serv] = await Promise.all([
      supabase.from("productos_orden").select("*").eq("orden_id", id).order("id_producto_orden"),
      supabase.from("servicios_orden").select("*").eq("orden_id", id).order("id_servicio_orden"),
    ]);
    if (prod.error) throw new Error(mensajeError(prod.error));
    if (serv.error) throw new Error(mensajeError(serv.error));
    return {
      productos: (prod.data ?? []) as ProductoOrden[],
      servicios: (serv.data ?? []) as ServicioOrden[],
    };
  },

  async crear(datos: Partial<OrdenTrabajo>): Promise<OrdenTrabajo> {
    const errores = validarOrden(datos as any);
    if (Object.keys(errores).length > 0)
      throw new Error("Datos inválidos: " + Object.values(errores).join(" "));
    return crud.crear({
      ...datos,
      fecha_inicial: datos.fecha_inicial ?? hoyISO(),
      estado: datos.estado ?? "Presupuesto",
    });
  },

  async editar(id: string, datos: Partial<OrdenTrabajo>): Promise<OrdenTrabajo> {
    if (datos.estado) {
      const errores = validarOrden({ ...datos, fecha_inicial: datos.fecha_inicial ?? "2000-01-01" } as any);
      delete (errores as Record<string, string>).cliente_id;
      delete (errores as Record<string, string>).usuario_id;
      delete (errores as Record<string, string>).fecha_inicial;
      if (Object.keys(errores).length > 0)
        throw new Error("Datos inválidos: " + Object.values(errores).join(" "));
    }
    return crud.editar(id, datos);
  },

  eliminar: crud.eliminar,

  /** Cambio de estado explícito (con la lista permitida en el prompt). */
  async cambiarEstado(id: string, estado: EstadoOrden): Promise<OrdenTrabajo> {
    const permitidos: EstadoOrden[] = [
      "Presupuesto",
      "Abierta",
      "En Proceso",
      "Finalizado",
      "Cancelado",
      "Aguardando Piezas",
    ];
    if (!permitidos.includes(estado)) throw new Error("Estado de orden inválido.");
    return crud.editar(id, { estado });
  },

  // ------------------------- Productos de la orden -------------------------

  /** Agrega producto descontando stock (RPC; valida salida y cantidad>0). */
  async agregarProducto(
    idOrden: string,
    idProducto: string,
    cantidad: number,
    precio?: number,
  ): Promise<string> {
    if (!(cantidad > 0)) throw new Error("La cantidad debe ser mayor que cero.");
    return llamarRpc<string>("orden_agregar_producto", {
      p_orden: idOrden,
      p_producto: idProducto,
      p_cantidad: cantidad,
      p_precio: precio ?? null,
    });
  },

  /** Cambia cantidad de una línea de producto devolviendo la diferencia. */
  async cambiarCantidadProducto(idLinea: string, cantidad: number): Promise<void> {
    if (!(cantidad > 0)) throw new Error("La cantidad debe ser mayor que cero.");
    await llamarRpc("orden_cambiar_cantidad_producto", {
      p_linea: idLinea,
      p_cantidad: cantidad,
    });
  },

  /** Quita el producto de la orden y devuelve su stock. */
  async quitarProducto(idLinea: string): Promise<void> {
    await llamarRpc("orden_quitar_producto", { p_linea: idLinea });
  },

  // ------------------------- Servicios de la orden -------------------------

  /** Agrega un servicio (sin efecto en stock). */
  async agregarServicio(
    idOrden: string,
    servicio: Servicio | { id_servicio: string; nombre: string; precio: number },
    cantidad: number,
    precio?: number,
  ): Promise<ServicioOrden> {
    if (!(cantidad > 0)) throw new Error("La cantidad debe ser mayor que cero.");
    const p = precio ?? Number((servicio as { precio: number }).precio ?? 0);
    const { data, error } = await supabase
      .from("servicios_orden")
      .insert({
        orden_id: idOrden,
        servicio_id: servicio.id_servicio,
        servicio: (servicio as { nombre?: string }).nombre ?? "Servicio",
        cantidad,
        precio: p,
        subtotal: subtotalLinea(cantidad, p),
      })
      .select("*")
      .single();
    if (error) throw new Error(mensajeError(error));
    return data as ServicioOrden;
  },

  async cambiarCantidadServicio(idLinea: string, cantidad: number): Promise<void> {
    const { data, error } = await supabase
      .from("servicios_orden")
      .select("precio")
      .eq("id_servicio_orden", idLinea)
      .single();
    if (error) throw new Error(mensajeError(error));
    await supabase
      .from("servicios_orden")
      .update({ cantidad, subtotal: subtotalLinea(cantidad, Number(data?.precio ?? 0)) })
      .eq("id_servicio_orden", idLinea);
  },

  /** Quita el servicio de la orden (recálculo de total en trigger de BD). */
  async quitarServicio(idLinea: string): Promise<void> {
    const { error } = await supabase
      .from("servicios_orden")
      .delete()
      .eq("id_servicio_orden", idLinea);
    if (error) throw new Error(mensajeError(error));
  },

  /** Total esperado de la orden (coincide con el trigger de BD). */
  async calcularTotal(id: string): Promise<number> {
    const { productos, servicios } = await this.obtenerLineas(id);
    const bruto =
      productos.reduce((a, l) => a + Number(l.subtotal ?? 0), 0) +
      servicios.reduce((a, l) => a + Number(l.subtotal ?? 0), 0);
    return redondear(bruto);
  },

  // ------------------------------- Facturación -----------------------------

  /** Factura la orden: crea ingreso financiero + marca facturado (×1 vez). */
  async facturar(
    idOrden: string,
    opciones: {
      fechaVencimiento?: string;
      formaPago?: string;
      categoriaId?: string;
      cuentaId?: string;
    } = {},
  ): Promise<string> {
    return llamarRpc<string>("orden_facturar", {
      p_orden: idOrden,
      p_fecha_vencimiento: opciones.fechaVencimiento ?? null,
      p_forma_pago: opciones.formaPago ?? null,
      p_categoria_id: opciones.categoriaId ?? null,
      p_cuenta_id: opciones.cuentaId ?? null,
    });
  },

  // ------------------------------- Anexos ----------------------------------

  /** Lista los anexos de la orden. */
  async listarAnexos(idOrden: string): Promise<Anexo[]> {
    const { data, error } = await supabase
      .from("anexos")
      .select("*")
      .eq("orden_id", idOrden)
      .order("id_anexo");
    if (error) throw new Error(mensajeError(error));
    return (data ?? []) as Anexo[];
  },

  /** Sube archivo a Storage (bucket anexos-orden) y registra el anexo. */
  async adjuntarAnexo(idOrden: string, archivo: File): Promise<Anexo> {
    const sanitizado = archivo.name.replace(/[^\w.\-]/g, "_");
    const ruta = `${idOrden}/${crypto.randomUUID()}-${sanitizado}`;
    const { error: errUpload } = await supabase.storage
      .from("anexos-orden")
      .upload(ruta, archivo, { upsert: false });
    if (errUpload) throw new Error(mensajeError(errUpload));
    const { data: pub } = await supabase.storage.from("anexos-orden").createSignedUrl(ruta, 3600);
    const url = (pub as { signedUrl?: string } | null)?.signedUrl ?? null;
    const { data, error } = await supabase
      .from("anexos")
      .insert({ orden_id: idOrden, anexo: archivo.name, ruta, url })
      .select("*")
      .single();
    if (error) throw new Error(mensajeError(error));
    return data as Anexo;
  },

  /** Elimina archivo de Storage y fila de anexo. */
  async quitarAnexo(idAnexo: string, ruta: string): Promise<void> {
    await supabase.storage.from("anexos-orden").remove([ruta]);
    const { error } = await supabase.from("anexos").delete().eq("id_anexo", idAnexo);
    if (error) throw new Error(mensajeError(error));
  },

  // ----------------------------- Envío por correo --------------------------

  /** Encola el envío de la orden al correo del cliente (cola de emails). */
  async enviarPorCorreo(
    idOrden: string,
    para: string,
    entrada?: { resumen?: string } | null,
  ): Promise<void> {
    const orden = await this.obtenerConDetalles(idOrden);
    if (!orden) throw new Error("Orden inexistente.");
    const resumen =
      entrada?.resumen ??
      [
        `Taller — Orden ${idOrden.slice(0, 8).toUpperCase()}`,
        `Estado: ${orden.estado} · Total: ${orden.valor_total.toFixed(2)}`,
      ].join("\n");
    const { error } = await supabase.from("cola_emails").insert({
      para,
      mensaje: resumen,
      estado: "pendiente",
      encabezados: `orden:${idOrden}`,
    });
    if (error) throw new Error(mensajeError(error));
  },
};

