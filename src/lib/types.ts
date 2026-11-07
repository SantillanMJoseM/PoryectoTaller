// ============================================================================
// Sistema Taller — Tipos de dominio (TASK-0007 / AG-008)
// ============================================================================
// Refleja el esquema canónico de Supabase (supabase/migrations 0001–0005).
// Nombres de tablas, columnas y valores de negocio en español, tal como
// aparecen en docs/requirements/SOURCE_PROMPT.md. Los valores monetarios
// (numeric(12,2)) y las fechas se transportan como string/number según Supabase.
// ============================================================================

export interface Cliente {
  id_cliente: string;
  nombre_cliente: string;
  sexo?: string | null;
  persona_fisica: boolean;
  documento?: string | null;
  telefono?: string | null;
  celular?: string | null;
  correo?: string | null;
  fecha_registro?: string;
  calle?: string | null;
  numero?: string | null;
  barrio?: string | null;
  ciudad?: string | null;
  estado?: string | null;
  codigo_postal?: string | null;
}

export interface Producto {
  id_producto: string;
  descripcion: string;
  unidad?: string | null;
  precio_compra: number;
  precio_venta: number;
  stock: number;
  stock_minimo: number;
  salida: boolean;
  entrada: boolean;
}

export interface Servicio {
  id_servicio: string;
  nombre: string;
  descripcion?: string | null;
  precio: number;
}

/** Estados de orden permitidos (chk_orden_estado). */
export const ESTADOS_ORDEN = [
  "Presupuesto",
  "Abierta",
  "En Proceso",
  "Finalizado",
  "Cancelado",
  "Aguardando Piezas",
] as const;
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number];

export interface OrdenTrabajo {
  id_orden: string;
  fecha_inicial: string;
  fecha_final?: string | null;
  garantia?: string | null;
  descripcion_producto?: string | null;
  defecto?: string | null;
  estado: EstadoOrden;
  observaciones?: string | null;
  laudo_tecnico?: string | null;
  valor_total: number;
  cliente_id?: string | null;
  usuario_id?: string | null;
  lanzamiento_id?: string | null;
  facturado: boolean;
  garantia_id?: string | null;
  // Relaciones disponibles vía select embebido
  clientes?: Cliente | null;
  usuarios?: Usuario | null;
  garantias?: Garantia | null;
}

export interface ProductoOrden {
  id_producto_orden: string;
  orden_id: string;
  producto_id?: string | null;
  cantidad: number;
  descripcion: string;
  precio: number;
  subtotal: number;
}

export interface ServicioOrden {
  id_servicio_orden: string;
  orden_id: string;
  servicio_id?: string | null;
  servicio: string;
  cantidad: number;
  precio: number;
  subtotal: number;
}

export interface Venta {
  id_venta: string;
  fecha_venta: string;
  valor_total: number;
  descuento: number;
  facturado: boolean;
  cliente_id?: string | null;
  usuario_id?: string | null;
  lanzamiento_id?: string | null;
  clientes?: Cliente | null;
  usuarios?: Usuario | null;
  items_venta?: ItemVenta[];
}

export interface ItemVenta {
  id_item_venta: string;
  venta_id: string;
  producto_id?: string | null;
  cantidad: number;
  descripcion: string;
  precio: number;
  subtotal: number;
}

export interface Garantia {
  id_garantia: string;
  fecha_garantia: string;
  referencia?: string | null;
  texto_garantia?: string | null;
  usuario_id?: string | null;
}

export type TipoMovimiento = "ingreso" | "egreso";

export interface MovimientoFinanciero {
  id_movimiento: string;
  descripcion: string;
  valor: number;
  fecha_vencimiento?: string | null;
  fecha_pago?: string | null;
  pagado: boolean;
  cliente_proveedor?: string | null;
  forma_pago?: string | null;
  tipo: TipoMovimiento;
  anexo?: string | null;
  cliente_id?: string | null;
  categoria_id?: string | null;
  cuenta_id?: string | null;
  venta_id?: string | null;
  clientes?: Cliente | null;
  categorias?: Categoria | null;
  cuentas?: Cuenta | null;
  ventas?: Venta | null;
}

export interface Categoria {
  id_categoria: string;
  categoria: string;
  fecha_registro?: string;
  estado: boolean;
  tipo: TipoMovimiento;
}

export interface Cuenta {
  id_cuenta: string;
  cuenta: string;
  banco?: string | null;
  numero?: string | null;
  saldo: number;
  fecha_registro?: string;
  estado: boolean;
  tipo: TipoMovimiento;
}

export interface Anexo {
  id_anexo: string;
  orden_id: string;
  anexo: string;
  miniatura?: string | null;
  url?: string | null;
  ruta: string;
}

export interface Documento {
  id_documento: string;
  documento: string;
  descripcion?: string | null;
  archivo?: string | null;
  ruta?: string | null;
  url?: string | null;
  fecha_registro?: string;
  categoria?: string | null;
  tipo?: string | null;
  tamanio?: number | null;
}

export interface Marca {
  id_marca: string;
  marca: string;
  fecha_registro?: string;
  estado: boolean;
}

export interface Equipo {
  id_equipo: string;
  equipo: string;
  numero_serie?: string | null;
  modelo?: string | null;
  color?: string | null;
  descripcion?: string | null;
  tension?: string | null;
  potencia?: string | null;
  voltaje?: string | null;
  fecha_fabricacion?: string | null;
  marca_id?: string | null;
  cliente_id?: string | null;
  condicion?: string | null;
  numero_chasis?: string | null;
  numero_motor?: string | null;
}

export interface EquipoOrden {
  id_equipo_orden: string;
  orden_id: string;
  equipo_id: string;
  defecto_declarado?: string | null;
  defecto_encontrado?: string | null;
  solucion?: string | null;
  /** Relación cargada por la consulta (equipo + marca). */
  equipos?: (Equipo & { marcas?: { marca?: string | null } | null }) | null;
}

export interface Usuario {
  id_usuario: string;
  nombre: string;
  rg?: string | null;
  cpf?: string | null;
  calle?: string | null;
  numero?: string | null;
  barrio?: string | null;
  ciudad?: string | null;
  estado?: string | null; // región/provincia — ver migración 0002 (D-01)
  correo: string;
  telefono?: string | null;
  celular?: string | null;
  estado_usuario: boolean; // activo/inactivo
  fecha_registro?: string;
  permiso_id?: string | null;
  fecha_expiracion?: string | null;
  permisos?: Permiso | null;
}

export interface Permiso {
  id_permiso: string;
  nombre: string;
  /** Array de códigos de actividad (jsonb): aCliente, eOrden, ... */
  permisos: string[];
  estado: boolean;
  fecha?: string;
}

export interface Empresa {
  id: string;
  nombre: string;
  cnpj?: string | null;
  ie?: string | null;
  calle?: string | null;
  numero?: string | null;
  barrio?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  telefono?: string | null;
  correo?: string | null;
  url_logo?: string | null;
}

export interface LogAuditoria {
  id_log: string;
  usuario?: string | null;
  tarea?: string | null;
  fecha: string;
  hora?: string | null;
  ip?: string | null;
}

export type EstadoEmail = "pendiente" | "enviando" | "enviado" | "fallido";

export interface ColaEmail {
  id: string;
  para: string;
  cc?: string | null;
  cco?: string | null;
  mensaje: string;
  estado: EstadoEmail;
  fecha?: string;
  encabezados?: string | null;
}

export interface Sesion {
  id_sesion: string;
  usuario_id?: string | null;
  cliente_id?: string | null;
  tipo: "administrador" | "cliente";
  inicio_sesion: string;
  expiracion: string;
  ip?: string | null;
  activa: boolean;
}

// ---------------------------------------------------------------------------
// Tipos comunes de la capa de servicios
// ---------------------------------------------------------------------------

export interface Filtros {
  [campo: string]: unknown;
}

export interface OpcionesListado {
  /** Texto libre (nombre/descripción/correo…). */
  q?: string;
  pagina?: number;
  tamPagina?: number;
  columna?: string;
  ascendente?: boolean;
  filtros?: Filtros;
}

export interface Paginado<T> {
  datos: T[];
  total: number;
  pagina: number;
  tamPagina: number;
  paginas: number;
}
