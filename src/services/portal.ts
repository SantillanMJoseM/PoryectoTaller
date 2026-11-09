import { api, setTokens, clearTokens } from "../lib/api";
import { mensajeError } from "../lib/errores";
import type { Cliente, ItemVenta, OrdenTrabajo, ProductoOrden, ServicioOrden, Venta } from "../lib/types";

const CLAVE_SESION = "portal_cliente_sesion";

export interface SesionPortal {
  idCliente: string;
  nombre: string;
  correo: string;
  viaEdge: boolean;
  expiracion: number;
}

export const portalService = {
  async ingresar(correo: string, documento: string): Promise<SesionPortal> {
    const c = correo.trim();
    const d = documento.trim();
    if (!c || !d) throw new Error("Ingrese correo electrónico y documento.");
    const data = await api.post("/api/auth/portal-login", { correo: c, documento: d });
    setTokens(data.access_token, data.refresh_token);
    const encendida: SesionPortal = {
      idCliente: data.cliente.id_cliente,
      nombre: data.cliente.nombre_cliente,
      correo: c,
      viaEdge: true,
      expiracion: Date.now() + 24 * 3600 * 1000,
    };
    this._guardarLocal(encendida);
    return encendida;
  },
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
    } catch { return null; }
  },
  _guardarLocal(ses: SesionPortal): void {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(ses));
  },
  async misDatos(idCliente: string): Promise<Cliente | null> {
    try { return await api.get(`/api/clientes/${idCliente}`); } catch { return null; }
  },
  async actualizarPerfil(idCliente: string, datos: Partial<Omit<Cliente, "correo" | "documento">>): Promise<Cliente> {
    if ("correo" in datos || "documento" in datos) throw new Error("Para cambiar su correo o documento, contacte al taller.");
    const camposPermitidos = ["nombreCliente","sexo","personaFisica","telefono","celular","calle","numero","barrio","ciudad","estado","codigoPostal"];
    const limpio: Record<string, unknown> = {};
    for (const k of camposPermitidos) {
      const snake = k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
      if (k in (datos as any)) limpio[snake] = (datos as any)[k];
      // also accept snake keys already
    }
    // map camel to backend fields (prisma expects camelCase? backend crud passes body to prisma; prisma fields are camelCase)
    const body: any = {};
    for (const k of camposPermitidos) {
      if (k in (datos as any)) body[k] = (datos as any)[k];
    }
    return await api.put(`/api/clientes/${idCliente}`, body);
  },
  async misOrdenes(idCliente: string): Promise<OrdenTrabajo[]> {
    const r = await api.get(`/api/ordenes?clienteId=${idCliente}&tamPagina=200`);
    return (r?.datos ?? []) as OrdenTrabajo[];
  },
  async misVentas(idCliente: string): Promise<Venta[]> {
    const r = await api.get(`/api/ventas?clienteId=${idCliente}&tamPagina=200`);
    return (r?.datos ?? []) as Venta[];
  },
  async detalleOrden(idCliente: string, idOrden: string): Promise<{ orden: OrdenTrabajo; productos: ProductoOrden[]; servicios: ServicioOrden[] } | null> {
    const orden = await api.get(`/api/ordenes/${idOrden}`).catch(() => null);
    if (!orden || orden.clienteId !== idCliente) return null;
    const [po, so] = await Promise.all([
      api.get(`/api/productos-orden?ordenId=${idOrden}&tamPagina=200`).catch(() => ({ datos: [] })),
      api.get(`/api/servicios-orden?ordenId=${idOrden}&tamPagina=200`).catch(() => ({ datos: [] })),
    ]);
    return { orden: orden as OrdenTrabajo, productos: (po?.datos ?? []) as ProductoOrden[], servicios: (so?.datos ?? []) as ServicioOrden[] };
  },
  async detalleCompra(idCliente: string, idVenta: string): Promise<{ venta: Venta; items: ItemVenta[] } | null> {
    const venta = await api.get(`/api/ventas/${idVenta}`).catch(() => null);
    if (!venta || venta.clienteId !== idCliente) return null;
    const items = await api.get(`/api/items-venta?ventaId=${idVenta}&tamPagina=200`).catch(() => ({ datos: [] }));
    return { venta: venta as Venta, items: (items?.datos ?? []) as ItemVenta[] };
  },
  async cerrar(): Promise<void> {
    localStorage.removeItem(CLAVE_SESION);
    clearTokens();
  },
};
