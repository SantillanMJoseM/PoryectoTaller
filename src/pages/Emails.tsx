// ============================================================================
// Sistema Taller — Cola de emails (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §14: crear emails con destinatario, cc, cco, mensaje y
// encabezados; estados pendiente → enviando → enviado | fallido; procesar la
// cola; reintentar envíos fallidos; eliminar emails. El envío real usa la
// función de borde «enviar-email» (emailQueueService); se muestra el resultado
// de la corrida en pantalla.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { PlayIcon, PlusIcon, RotateCwIcon, TrashIcon } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
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
import { emailQueueService } from "../services";
import { formatoFecha } from "../lib/fechas";
import type { ColaEmail, EstadoEmail } from "../lib/types";

const ESTADOS: EstadoEmail[] = ["pendiente", "enviando", "enviado", "fallido"];

const CLASE_ESTADO: Record<EstadoEmail, "default" | "secondary" | "destructive" | "outline"> = {
  pendiente: "outline",
  enviando: "secondary",
  enviado: "default",
  fallido: "destructive",
};

export default function Emails() {
  const { puede } = useAuth();
  const [estadoFiltro, setEstadoFiltro] = useState<"todos" | EstadoEmail>("todos");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<{ lista: ColaEmail[]; total: number; paginas: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      if (estadoFiltro === "todos") {
        const res = await emailQueueService.listar({
          pagina,
          tamPagina: 15,
          columna: "fecha",
          ascendente: false,
        });
        setDatos({ lista: res.datos, total: res.total, paginas: res.paginas });
      } else {
        const res = await emailQueueService.listarPorEstado(estadoFiltro, pagina, 15);
        setDatos({ lista: res.datos, total: res.total, paginas: res.paginas });
      }
      setResultado(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la cola de emails.");
    } finally {
      setCargando(false);
    }
  }, [estadoFiltro, pagina]);

  useEffect(() => {
    setPagina(1);
  }, [estadoFiltro]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /* Nuevo email */
  const [dialogo, setDialogo] = useState(false);
  const [form, setForm] = useState({ para: "", cc: "", cco: "", mensaje: "", encabezados: "" });
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const abrirNuevo = () => {
    setForm({ para: "", cc: "", cco: "", mensaje: "", encabezados: "" });
    setErrorForm(null);
    setDialogo(true);
  };

  const guardar = async () => {
    setGuardando(true);
    setErrorForm(null);
    try {
      await emailQueueService.encolar({
        para: form.para.trim(),
        cc: form.cc || undefined,
        cco: form.cco || undefined,
        mensaje: form.mensaje,
        encabezados: form.encabezados || undefined,
      });
      setDialogo(false);
      await cargar();
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "No se pudo encolar el correo.");
    } finally {
      setGuardando(false);
    }
  };

  /* Procesar cola / reintentar / eliminar */
  const [procesando, setProcesando] = useState(false);
  const procesar = async () => {
    setProcesando(true);
    setError(null);
    try {
      const r = await emailQueueService.procesar(10);
      setResultado(`Cola procesada: ${r.enviados} enviado(s), ${r.fallidos} fallido(s).`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo procesar la cola.");
    } finally {
      setProcesando(false);
    }
  };

  const reintentar = async (c: ColaEmail) => {
    try {
      await emailQueueService.cambiarEstado(c.id, "pendiente");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reintentar el envío.");
    }
  };

  const [eliminarFila, setEliminarFila] = useState<ColaEmail | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const eliminar = async () => {
    if (!eliminarFila) return;
    setEliminando(true);
    try {
      await emailQueueService.eliminar(eliminarFila.id);
      setEliminarFila(null);
      await cargar();
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Cola de emails</h2>
        <p className="text-sm text-muted-foreground">
          Correos encolados con estados pendiente / enviando / enviado / fallido; procesar y reintentar.
        </p>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={estadoFiltro === "todos" ? "default" : "outline"}
            onClick={() => setEstadoFiltro("todos")}
          >
            Todos
          </Button>
          {ESTADOS.map((e) => (
            <Button
              key={e}
              size="sm"
              variant={estadoFiltro === e ? "default" : "outline"}
              onClick={() => setEstadoFiltro(e)}
            >
              {e}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {puede(["eEmail"]) && (
            <Button size="sm" variant="secondary" onClick={() => void procesar()} disabled={procesando}>
              <PlayIcon data-icon="inline-start" /> {procesando ? "Procesando…" : "Procesar cola"}
            </Button>
          )}
          {puede(["aEmail"]) && (
            <Button size="sm" onClick={abrirNuevo}>
              <PlusIcon data-icon="inline-start" /> Nuevo email
            </Button>
          )}
        </div>
      </div>

      {resultado && <p className="text-sm text-emerald-700">{resultado}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Para</TableHead>
              <TableHead>CC/CCO</TableHead>
              <TableHead>Mensaje</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={6} className="p-4 text-center text-muted-foreground">Cargando…</TableCell>
              </TableRow>
            ) : (datos?.lista ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-4 text-center text-muted-foreground">La cola está vacía.</TableCell>
              </TableRow>
            ) : (
              (datos?.lista ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.para}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {[c.cc, c.cco].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="max-w-64 truncate" title={c.mensaje}>{c.mensaje}</TableCell>
                  <TableCell><Badge variant={CLASE_ESTADO[c.estado]}>{c.estado}</Badge></TableCell>
                  <TableCell>{formatoFecha(c.fecha)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {c.estado === "fallido" && puede(["eEmail"]) && (
                        <Button variant="ghost" size="icon-sm" title="Reintentar" onClick={() => void reintentar(c)}>
                          <RotateCwIcon />
                        </Button>
                      )}
                      {puede(["dEmail"]) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Eliminar"
                          className="text-destructive"
                          onClick={() => setEliminarFila(c)}
                        >
                          <TrashIcon />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{datos?.total ?? 0} correo(s) — el autoproceso del navegador envía la cola cada minuto.</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
          <span>Página {pagina} de {datos?.paginas ?? 1}</span>
          <Button variant="outline" size="sm" disabled={pagina >= (datos?.paginas ?? 1)} onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
        </div>
      </div>

      {/* ---------------------------- Nuevo email ----------------------------- */}
      <Dialog
        open={dialogo}
        onOpenChange={(o) => {
          if (!o && !guardando) setDialogo(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo email</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label>Destinatario (para) *</Label>
              <Input type="email" value={form.para} onChange={(e) => setForm({ ...form, para: e.target.value })} placeholder="cliente@correo.com" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>CC</Label>
                <Input value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} placeholder="separados por coma" />
              </div>
              <div className="space-y-1">
                <Label>CCO</Label>
                <Input value={form.cco} onChange={(e) => setForm({ ...form, cco: e.target.value })} placeholder="separados por coma" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Mensaje *</Label>
              <Textarea rows={4} value={form.mensaje} onChange={(e) => setForm({ ...form, mensaje: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Encabezados</Label>
              <Input value={form.encabezados} onChange={(e) => setForm({ ...form, encabezados: e.target.value })} placeholder="orden:<id>, venta:<id>…" />
            </div>
            {errorForm && <p className="text-sm text-destructive">{errorForm}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogo(false)} disabled={guardando}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>{guardando ? "Encolando…" : "Encolar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        abierto={eliminarFila !== null}
        titulo="Eliminar email"
        mensaje="¿Está seguro de que desea eliminar este correo de la cola? Esta acción no se puede deshacer."
        textoConfirmar="Eliminar"
        ocupado={eliminando}
        onCerrar={() => setEliminarFila(null)}
        onConfirmar={() => void eliminar()}
      />
    </div>
  );
}
