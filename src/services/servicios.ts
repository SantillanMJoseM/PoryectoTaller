// ============================================================================
// Sistema Taller — Servicio de Servicios (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §4: crear, editar, eliminar y visualizar servicios con
// nombre, descripción y precio. Tabla servicios (PK id_servicio).
// ============================================================================

import { crearCrud } from "../lib/crud";
import { validarServicio } from "../lib/validaciones";
import type { Servicio } from "../lib/types";

const crud = crearCrud<Servicio>("servicios", "id_servicio", ["nombre"]);

export const serviciosService = {
  listar: crud.listar,
  obtener: crud.obtener,
  contar: crud.contar,

  async crear(datos: Partial<Servicio>): Promise<Servicio> {
    if (!datos.nombre?.trim()) throw new Error("El nombre del servicio es obligatorio.");
    const errores = validarServicio(datos);
    if (Object.keys(errores).length > 0)
      throw new Error("Datos inválidos: " + Object.values(errores).join(" "));
    return crud.crear(datos);
  },

  async editar(id: string, datos: Partial<Servicio>): Promise<Servicio> {
    const errores = validarServicio(datos);
    if (Object.keys(errores).length > 0)
      throw new Error("Datos inválidos: " + Object.values(errores).join(" "));
    return crud.editar(id, datos);
  },

  eliminar: crud.eliminar,

  /** Autocompletado para la orden de trabajo. */
  async autocompletar(q: string, limite = 10): Promise<Servicio[]> {
    if (!q?.trim()) return [];
    const crudAuto = crearCrud<Servicio>("servicios", "id_servicio", []);
    const res = await crudAuto.listar({ q, tamPagina: limite, columna: "nombre", ascendente: true });
    return res.datos;
  },
};
