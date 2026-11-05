// ============================================================================
// Sistema Taller — Errores de la capa de datos (TASK-0007 / AG-008)
// ============================================================================
// Traduce los errores de Supabase/Postgres (incluidas las «hints» de las RPC
// de negocio de la migración 0004) a mensajes en español para el usuario.
// ============================================================================

export class ServicioError extends Error {
  hint?: string;
  code?: string;
  constructor(mensaje: string, hint?: string, code?: string) {
    super(mensaje);
    this.name = "ServicioError";
    this.hint = hint;
    this.code = code;
  }
}

const MENSAJES: Record<string, string> = {
  permiso_denegado: "No tiene permiso para esta operación.",
  stock_insuficiente: "Stock insuficiente para el producto seleccionado.",
  stock_guard: "El stock solo se actualiza con órdenes/ventas o ajuste de inventario.",
  producto_inexistente: "Producto inexistente.",
  empresa_unica: "La empresa ya está registrada: edite los datos existentes.",
  credenciales_inmutables: "Para cambiar su correo o documento, contacte al taller.",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mensajeError(error: any): string {
  if (!error) return "Error desconocido.";
  if (error instanceof ServicioError) return error.message;

  const hint: string | undefined = error?.hint;
  if (hint && hint in MENSAJES) return MENSAJES[hint];

  const code: string | undefined = error?.code;
  if (code && code in MENSAJES) return MENSAJES[code];

  const mensajeCrudo: string = error?.message ?? String(error);

  if (/duplicate key|unique/i.test(mensajeCrudo))
    return "El registro duplica un valor único existente.";
  if (/violates foreign key/i.test(mensajeCrudo))
    return "El registro está referenciado por otros datos y no puede modificarse.";
  if (/violates check constraint/i.test(mensajeCrudo))
    return "Datos fuera de los límites permitidos por negocio.";
  if (/f_stock_no_directo|stock solo se actualiza/i.test(mensajeCrudo))
    return MENSAJES.stock_guard;
  if (/permission denied|row-level security|permiso para esta operación/i.test(mensajeCrudo))
    return MENSAJES.permiso_denegado;
  if (/Stock insuficiente/i.test(mensajeCrudo)) return MENSAJES.stock_insuficiente;
  if (/No tiene permiso/i.test(mensajeCrudo)) return MENSAJES.permiso_denegado;
  return mensajeCrudo;
}
