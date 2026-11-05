// ============================================================================
// Sistema Taller — Auditoría (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §13: registrar acciones del usuario (usuario, tarea, fecha,
// hora, IP); listar logs; limpiar logs. Los triggers de la base de datos
// (tg_auditar) registran las operaciones de las tablas de negocio; esta
// pantalla los lista con paginación y permite «Limpiar logs» (RPC
// limpiar_logs, con usuario con dAuditoria).
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { TrashIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAuth } from "../contexts/AuthContext";
import { auditoriaService } from "../services";
import { formatoFecha } from "../lib/fechas";
import type { LogAuditoria } from "../lib/types";

function comoLog(l: LogAuditoria & Record<string, unknown>): LogAuditoria {
  return l;
}

export default function Auditoria() {
  const { puede, sesion } = useAuth();
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<{ lista: LogAuditoria[]; total: number; paginas: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await auditoriaService.listarRecientes(pagina, 15);
      const filtro = q.trim().toLowerCase();
      const lista = filtro
        ? res.datos.filter(
            (l) =>
              (l.usuario ?? "").toLowerCase().includes(filtro) ||
              (l.tarea ?? "").toLowerCase().includes(filtro),
          )
        : res.datos;
      setDatos({ lista, total: res.total, paginas: res.paginas });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los logs.");
    } finally {
      setCargando(false);
    }
  }, [q, pagina]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /* Limpiar logs (dAuditoria) */
  const [confirmar, setConfirmar] = useState(false);
  const [limpiando, setLimpiando] = useState(false);
  const limpiar = async () => {
    setLimpiando(true);
    try {
      await auditoriaService.limpiar();
      setConfirmar(false);
      setPagina(1);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron limpiar los logs.");
    } finally {
      setLimpiando(false);
    }
  };

  void sesion;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Auditoría</h2>
        <p className="text-sm text-muted-foreground">
          Registro de acciones del usuario: usuario, tarea, fecha, hora e IP (los triggers de la base de datos auditan las operaciones).
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por usuario o tarea…" className="sm:max-w-xs" />
        {puede(["dAuditoria"]) && (
          <Button variant="destructive" className="shrink-0" onClick={() => setConfirmar(true)}>
            <TrashIcon data-icon="inline-start" /> Limpiar logs
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Hora</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Tarea</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={5} className="p-4 text-center text-muted-foreground">Cargando…</TableCell>
              </TableRow>
            ) : (datos?.lista ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-4 text-center text-muted-foreground">No hay logs registrados.</TableCell>
              </TableRow>
            ) : (
              (datos?.lista ?? []).map((l) => (
                <TableRow key={l.id_log}>
                  <TableCell>{formatoFecha(l.fecha)}</TableCell>
                  <TableCell className="font-mono text-xs">{l.hora ?? "—"}</TableCell>
                  <TableCell>{l.usuario ?? "system"}</TableCell>
                  <TableCell>{l.tarea ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{l.ip ?? "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{datos?.total ?? 0} log(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
          <span>Página {pagina} de {datos?.paginas ?? 1}</span>
          <Button variant="outline" size="sm" disabled={pagina >= (datos?.paginas ?? 1)} onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
        </div>
      </div>

      <ConfirmDialog
        abierto={confirmar}
        titulo="Limpiar logs de auditoría"
        mensaje="Se eliminarán todos los registros de auditoría. La propia limpieza queda registrada en un nuevo log. ¿Continuar?"
        textoConfirmar="Limpiar"
        textoCancelar="Cancelar"
        ocupado={limpiando}
        onCerrar={() => setConfirmar(false)}
        onConfirmar={() => void limpiar()}
      />
    </div>
  );
}
