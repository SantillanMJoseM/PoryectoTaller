// ============================================================================
// Sistema Taller — Servicio de Clientes (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §2: crear, editar, eliminar y visualizar clientes;
// búsqueda por nombre/documento/correo; paginación; vinculación con órdenes,
// ventas, financiero y equipos (vista v_cliente_vinculos).
// Tabla: clientes (PK id_cliente). RLS: es_administrador() AND permiso vCliente
// para listar; el portal del cliente solo ve su propia fila (0003_rls.sql).
// ============================================================================

import { crearCrud } from "../lib/crud";
import { mensajeError } from "../lib/errores";
import { supabase } from "../lib/supabase";
import { validarCliente } from "../lib/validaciones";
import type { Cliente } from "../lib/types";

const crud = crearCrud<Cliente>("clientes", "id_cliente", [
  "nombre_cliente",
  "documento",
  "correo",
]);

export const clientesService = {
  /** Lista paginada con búsqueda por nombre/documento/correo. */
  listar: crud.listar,
  obtener: crud.obtener,
  contar: crud.contar,

  /** Crea un cliente validando los campos obligatorios (regla del prompt). */
  async crear(datos: Partial<Cliente>): Promise<Cliente> {
    const errores = validarCliente(datos);
    if (Object.keys(errores).length > 0) {
      throw new Error("Datos inválidos: " + Object.values(errores).join(" "));
    }
    return crud.crear(datos);
  },

  /** Edita un cliente. El portal no puede cambiar correo/documento:
   *  el trigger tg_cliente_no_credenciales (0004) lo rechaza en Postgres y
   *  aquí se valida primero para un mensaje amable. */
  async editar(id: string, datos: Partial<Cliente>): Promise<Cliente> {
    const errores = validarCliente(datos);
    if (Object.keys(errores).length > 0) {
      throw new Error("Datos inválidos: " + Object.values(errores).join(" "));
    }
    return crud.editar(id, datos);
  },

  eliminar: crud.eliminar,

  /** Búsqueda rápida por el término libre (autocompletado). */
  async autocompletar(q: string, limite = 10): Promise<Cliente[]> {
    if (!q || q.trim().length < 1) return [];
    const patron = `%${q.trim()}%`;
    const { data, error } = await supabase
      .from("clientes")
      .select("id_cliente, nombre_cliente, documento, correo")
      .or(`nombre_cliente.ilike.${patron},documento.ilike.${patron},correo.ilike.${patron}`)
      .order("nombre_cliente")
      .limit(limite);
    if (error) throw new Error(mensajeError(error));
    return (data ?? []) as Cliente[];
  },

  /** Cantidades de órdenes, ventas, movimientos y equipos del cliente. */
  async vinculos(idCliente: string): Promise<{
    ordenes: number;
    ventas: number;
    movimientos: number;
    equipos: number;
  }> {
    const { data, error } = await supabase
      .from("v_cliente_vinculos")
      .select("ordenes, ventas, movimientos, equipos")
      .eq("id_cliente", idCliente)
      .maybeSingle();
    if (error) throw new Error(mensajeError(error));
    return (
      data ?? { ordenes: 0, ventas: 0, movimientos: 0, equipos: 0 }
    );
  },
};
