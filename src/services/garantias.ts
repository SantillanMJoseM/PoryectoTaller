// ============================================================================
// Sistema Taller — Servicio de Garantías (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §7: crear, editar, eliminar y visualizar términos de
// garantía (referencia, texto y fecha); asociación a órdenes vía garantia_id;
// impresión (la vista entrega el texto; el PDF lo compone el frontend).
// ============================================================================

import { crearCrud } from "../lib/crud";
import { validarGarantia, asegurarValido } from "../lib/validaciones";
import type { Garantia, OrdenTrabajo } from "../lib/types";

const crud = crearCrud<Garantia>("garantias", "id_garantia", ["referencia"]);

export const garantiasService = {
  listar: crud.listar,
  obtener: crud.obtener,
  contar: crud.contar,

  async crear(datos: Partial<Garantia>): Promise<Garantia> {
    if (!datos.referencia?.trim()) throw new Error("La referencia es obligatoria.");
    asegurarValido(validarGarantia(datos));
    return crud.crear({ ...datos, fecha_garantia: datos.fecha_garantia });
  },

  async editar(id: string, datos: Partial<Garantia>): Promise<Garantia> {
    asegurarValido(validarGarantia(datos));
    return crud.editar(id, datos);
  },

  eliminar: crud.eliminar,

  /** Asocia un término de garantía a una orden (garantia_id + texto aplicado). */
  async asociarAOrden(idOrden: string, idGarantia: string): Promise<OrdenTrabajo> {
    const crudOrden = crearCrud<OrdenTrabajo>("ordenes_trabajo", "id_orden", []);
    return crudOrden.editar(idOrden, { garantia_id: idGarantia } as Partial<OrdenTrabajo>);
  },
};
