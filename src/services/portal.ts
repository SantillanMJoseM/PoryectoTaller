// ============================================================================
// Sistema Taller — Servicio del Portal del Cliente (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §15: ingreso por correo + documento; panel con últimas
// compras y órdenes; detalle de orden y compra; imprimir; ver y editar datos
// de cuenta (sin poder cambiar correo/documento: E-05/RF-079, y el trigger
// f_cliente_no_credenciales lo refuerza en BD); cerrar sesión.
//
// Cómo funciona:
//   1. Busca un cliente cuyo correo y documento coincidan (comparación en
//      minúsculas, índice uq_clientes_portal_par).
//   2. Intenta crear una sesión real con la función de borde «portal-login»
//      (devuelve sesión Supabase con app_metadata rol=cliente/cliente_id,
//      necesaria para que RLS aplique la rama del portal de 0003_rls.sql).
//   3. Si la función de borde no está configurada, mantiene la sesión local
//      (almacenada) solo para el panel del cliente; los datos protegidos por
//      RLS para clientes no estarán disponibles (limitación documentada).
// ============================================================================

import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/errores";
import type { Cliente, ItemVenta, OrdenTrabajo, ProductoOrden, ServicioOrden, Venta } from "../lib/types";

const CLAVE_SESION = "portal_cliente_sesion";

export interface SesionPortal {
  idCliente: string;
  nombre: string;
  correo: string;
  viaEdge: boolean;
  expiracion: number; // timestamp ms
}

export const portalService = {
  /** Ingreso del cliente (correo + documento). Error en español si no coincide. */
  async ingresar(correo: string, documento: string): Promise<SesionPortal> {
    const c = correo.trim();
    const d = documento.trim();
    if (!c || !d) throw new Error("Ingrese correo electrónico y documento.");

    // 1) oficina de sesión real (si la Edge Function «portal-login» existe)
    try {
      const { data: edge, error } = await supabase.functions.invoke("portal-login", {
        body: { correo: c, documento: d },
      });
      if (!error && edge?.session) {
        const ses = edge as { session: { access_token: string; refresh_token: string }; cliente: { id_cliente: string; nombre_cliente: string } };
        await supabase.auth.setSession({
          access_token: ses.session.access_token,
          refresh_token: ses.session.refresh_token,
        });
        const encendida: SesionPortal = {
          idCliente: ses.cliente.id_cliente,
          nombre: ses.cliente.nombre_cliente,
          correo: c,
          viaEdge: true,
          expiracion: Date.now() + 24 * 3600 * 1000, // 24 h (RB-032)
        };
        this._guardarLocal(encendida);
        return encendida;
      }
    } catch {
      // la función de borde no está desplegada → fallback local
    }

    // 2) coincidencia directa contra clientes (correo en minúsculas + documento)
    const { data, error } = await supabase
      .from("clientes")
      .select("id_cliente, nombre_cliente, correo")
      .ilike("correo", c)
      .eq("documento", d)
      .maybeSingle();
    if (error) throw new Error(mensajeError(error));
    if (!data) throw new Error("Los datos no coinciden con un cliente registrado.");

    const encendida: SesionPortal = {
      idCliente: (data as { id_cliente: string }).id_cliente,
      nombre: (data as { nombre_cliente: string }).nombre_cliente,
      correo: c,
      viaEdge: false,
      expiracion: Date.now() + 24 * 3600 * 1000, // 24 h
    };
    this._guardarLocal(encendida);
    return encendida;
  },

  /** Sesión guardada (persistente mientras no expire). */
  obtenerSesion(): SesionPortal | null {
    try {
      const crudo = localStorage.getItem(CLAVE_SESION);
      if (!crudo) return null;
      const ses = JSON.parse(crudo) as SesionPortal;
      if (ses.expiracion < Date.now()) {
        localStorage.removeItem(CLAVE_SESION);
        return null;
      }
      return ses;
    } catch {
      return null;
    }
  },

  _guardarLocal(ses: SesionPortal): void {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(ses));
  },

  /** Datos de la cuenta (el portal solo ve su propia fila si RLS branch activa). */
  async misDatos(idCliente: string): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("id_cliente", idCliente)
      .maybeSingle();
    if (error) throw new Error(mensajeError(error));
    return (data ?? null) as Cliente | null;
  },

  /** Edita datos de la cuenta. Correo y documento son inmutables para el
   *  cliente (E-05/RF-079); el trigger tg_cliente_no_credenciales también lo
   *  impide en la base de datos. */
  async actualizarPerfil(
    idCliente: string,
    datos: Partial<Omit<Cliente, "correo" | "documento">>,
  ): Promise<Cliente> {
    if ("correo" in datos || "documento" in datos) {
      throw new Error("Para cambiar su correo o documento, contacte al taller.");
    }
    const camposPermitidos = [
      "nombre_cliente", "sexo", "persona_fisica", "telefono", "celular",
      "calle", "numero", "barrio", "ciudad", "estado", "codigo_postal",
    ];
    const limpio: Record<string, unknown> = {};
    for (const k of camposPermitidos) {
      if (k in datos) limpio[k] = (datos as Record<string, unknown>)[k];
    }
    const { data, error } = await supabase
      .from("clientes")
      .update(limpio)
      .eq("id_cliente", idCliente)
      .select("*")
      .single();
    if (error) throw new Error(mensajeError(error));
    return data as Cliente;
  },

  /** Órdenes del cliente (más recientes primero). */
  async misOrdenes(idCliente: string): Promise<OrdenTrabajo[]> {
    const { data, error } = await supabase
      .from("ordenes_trabajo")
      .select("*")
      .eq("cliente_id", idCliente)
      .order("fecha_inicial", { ascending: false });
    if (error) throw new Error(mensajeError(error));
    return (data ?? []) as OrdenTrabajo[];
  },

  /** Compras del cliente (más recientes primero). */
  async misVentas(idCliente: string): Promise<Venta[]> {
    const { data, error } = await supabase
      .from("ventas")
      .select("*")
      .eq("cliente_id", idCliente)
      .order("fecha_venta", { ascending: false });
    if (error) throw new Error(mensajeError(error));
    return (data ?? []) as Venta[];
  },

  /** Detalle completo de una orden para imprimir (solo si es del cliente). */
  async detalleOrden(idCliente: string, idOrden: string): Promise<{
    orden: OrdenTrabajo;
    productos: ProductoOrden[];
    servicios: ServicioOrden[];
  } | null> {
    const { data: orden, error } = await supabase
      .from("ordenes_trabajo")
      .select("*")
      .eq("id_orden", idOrden)
      .eq("cliente_id", idCliente)
      .maybeSingle();
    if (error) throw new Error(mensajeError(error));
    if (!orden) return null;
    const [prod, serv] = await Promise.all([
      supabase.from("productos_orden").select("*").eq("orden_id", idOrden),
      supabase.from("servicios_orden").select("*").eq("orden_id", idOrden),
    ]);
    if (prod.error) throw new Error(mensajeError(prod.error));
    if (serv.error) throw new Error(mensajeError(serv.error));
    return {
      orden: orden as OrdenTrabajo,
      productos: (prod.data ?? []) as ProductoOrden[],
      servicios: (serv.data ?? []) as ServicioOrden[],
    };
  },

  /** Detalle completo de una compra para imprimir (solo si es del cliente). */
  async detalleCompra(
    idCliente: string,
    idVenta: string,
  ): Promise<{ venta: Venta; items: ItemVenta[] } | null> {
    const { data: venta, error } = await supabase
      .from("ventas")
      .select("*")
      .eq("id_venta", idVenta)
      .eq("cliente_id", idCliente)
      .maybeSingle();
    if (error) throw new Error(mensajeError(error));
    if (!venta) return null;
    const { data: items, error: errItems } = await supabase
      .from("items_venta")
      .select("*")
      .eq("venta_id", idVenta);
    if (errItems) throw new Error(mensajeError(errItems));
    return { venta: venta as Venta, items: (items ?? []) as ItemVenta[] };
  },

  /** Cierra la sesión del cliente (borra sesión local y de Supabase). */
  async cerrar(): Promise<void> {
    localStorage.removeItem(CLAVE_SESION);
    try {
      await supabase.auth.signOut();
    } catch {
      // sin sesión Supabase no pasa nada
    }
  },
};
