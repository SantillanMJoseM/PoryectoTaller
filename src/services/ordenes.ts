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
import { api } from "../lib/api";
import { mensajeError } from "../lib/errores";
import { hoyISO } from "../lib/fechas";
import { generarUuid } from "../lib/uuid";
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

const SELECT_DETALLE = `*, clientes:cliente_id(*), usuarios:usuario_id(*), garantias:garantia_id(*)`;

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
    const filtros: Record<string, unknown> = {};
    if (opciones.estado) filtros.estado = opciones.estado;
    if (opciones.clienteId) filtros.clienteId = opciones.clienteId;
    const r = await crud.listar({ pagina: opciones.pagina, tamPagina: opciones.tamPagina, filtros, columna: "fechaInicial", ascendente: false });
    let datos = r.datos;
    if (opciones.fechaInicial) datos = datos.filter((o: any) => String(o.fechaInicial ?? o.fecha_inicial) >= String(opciones.fechaInicial));
    if (opciones.fechaFinal) datos = datos.filter((o: any) => String(o.fechaInicial ?? o.fecha_inicial) <= String(opciones.fechaFinal));
    return { ...r, datos };
  },

  /** Detalle completo con cliente, usuario/técnico y garantía asociada. */
  async obtenerConDetalles(id: string): Promise<OrdenTrabajo | null> {
    const o = await crud.obtener(id);
    if (!o) return null;
    if ((o as any).clienteId) {
      try { (o as any).clientes = await api.get(`/api/clientes/${(o as any).clienteId}`); } catch {}
    }
    if ((o as any).usuarioId) {
      try { (o as any).usuarios = await api.get(`/api/usuarios/${(o as any).usuarioId}`); } catch {}
    }
    if ((o as any).garantiaId) {
      try { (o as any).garantias = await api.get(`/api/garantias/${(o as any).garantiaId}`); } catch {}
    }
    return o as OrdenTrabajo;
  },

  /** Líneas de producto y servicio de la orden. */
  async obtenerLineas(id: string): Promise<{ productos: ProductoOrden[]; servicios: ServicioOrden[] }> {
    const [prod, serv] = await Promise.all([
      api.get(`/api/productos-orden?ordenId=${id}&tamPagina=200`).catch(() => ({ datos: [] })),
      api.get(`/api/servicios-orden?ordenId=${id}&tamPagina=200`).catch(() => ({ datos: [] })),
    ]);
    return {
      productos: (prod?.datos ?? []) as ProductoOrden[],
      servicios: (serv?.datos ?? []) as ServicioOrden[],
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
    const id = await llamarRpc<string>("orden_agregar_servicio", {
      p_orden: idOrden,
      p_servicio: (servicio as { id_servicio: string }).id_servicio,
      p_cantidad: cantidad,
      p_precio: p,
    });
    return { id_servicio_orden: id } as ServicioOrden;
  },

  async cambiarCantidadServicio(idLinea: string, cantidad: number): Promise<void> {
    await llamarRpc("orden_cambiar_cantidad_servicio", { p_linea: idLinea, p_cantidad: cantidad });
  },

  /** Quita el servicio de la orden (recálculo de total en trigger de BD). */
  async quitarServicio(idLinea: string): Promise<void> {
    await llamarRpc("orden_quitar_servicio", { p_linea: idLinea });
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
    const r = await api.get(`/api/anexos?ordenId=${idOrden}&tamPagina=200`);
    return (r?.datos ?? []) as Anexo[];
  },

  /** Sube archivo a Storage (bucket anexos-orden) y registra el anexo. */
  async adjuntarAnexo(idOrden: string, archivo: File): Promise<Anexo> {
    const { subirAlBucket } = await import("../lib/supabase");
    const sanitizado = archivo.name.replace(/[^\w.\-]/g, "_");
    const ruta = `${idOrden}/${generarUuid()}-${sanitizado}`;
    await subirAlBucket("anexos-orden" as any, archivo, ruta);
    const url = `${ (await import("../lib/api")).API_URL }/api/storage/download?bucket=anexos-orden&ruta=${encodeURIComponent(ruta)}`;
    return await api.post("/api/anexos", { anexo: archivo.name, ruta, url, ordenId: idOrden }) as Anexo;
  },

  /** Elimina archivo de Storage y fila de anexo. */
  async quitarAnexo(idAnexo: string, ruta: string): Promise<void> {
    const { eliminarDelBucket } = await import("../lib/supabase");
    await eliminarDelBucket(ruta, "anexos-orden" as any);
    await api.del(`/api/anexos/${idAnexo}`);
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
    await api.post("/api/emails", {
      para,
      mensaje: resumen,
      estado: "pendiente",
      encabezados: `orden:${idOrden}`,
    });
  },
};

