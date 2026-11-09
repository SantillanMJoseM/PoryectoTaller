// ============================================================================
// Sistema Taller — Servicio de Auditoría (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §13: registrar acciones del usuario (usuario, tarea, fecha,
// hora, IP); listar logs; limpiar logs. Los triggers de BD (tg_auditar,
// migración 0004) registran automáticamente altos/bajas/cambios de las tablas
// de negocio; este servicio lista, limpia (RPC limpiar_logs con auto-log
// previo) y permite registrar acciones explícitas de la aplicación.
// ============================================================================

import { crearCrud, llamarRpc } from "../lib/crud";
import { mensajeError } from "../lib/errores";
import { api } from "../lib/api";
import type { LogAuditoria } from "../lib/types";

const crud = crearCrud<LogAuditoria>("logs_auditoria", "id_log", ["usuario", "tarea"]);

export const auditoriaService = {
  listar: crud.listar,
  contar: crud.contar,

  /** Logs más recientes primero (fecha desc, hora desc). */
  async listarRecientes(pagina = 1, tamPagina = 50) {
    return crud.listar({ pagina, tamPagina, columna: "fecha", ascendente: false });
  },

  /** Registra una acción explícita (usada por los flujos de la app). */
  async registrar(tarea: string, usuario?: string, ip?: string): Promise<void> {
    const ahora = new Date();
    await api.post("/api/auditoria/log", {
      usuario: usuario ?? "system",
      tarea,
      ip: ip ?? null,
    });
  },

  /** Limpia los logs (RPC con permiso dAuditoria y auto-log previo). */
  async limpiar(): Promise<number> {
    return llamarRpc<number>("limpiar_logs");
  },
};
