// ============================================================================
// Sistema Taller — Archivos/Documentos (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §9: crear, editar, eliminar documentos; carga de archivos;
// metadatos (nombre, descripción, categoría, tipo, tamaño, fecha); descarga;
// organización por categoría. Bucket privado «documentos» (≤ 20 MB), enlace
// firmado temporal para descargar (archivosService).
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { DownloadIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
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
import SimpleSelect from "../components/SimpleSelect";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAuth } from "../contexts/AuthContext";
import { archivosService } from "../services";
import { formatoFecha } from "../lib/fechas";
import type { Documento } from "../lib/types";

interface FormDoc {
  documento: string;
  descripcion: string;
  categoria: string;
}

const CATEGORIAS_BASE = [
  "Contratos",
  "Facturas",
  "Garantías",
  "Laudos",
  "Notas de entrega",
  "Otros",
];

export default function Documentos() {
  const { puede } = useAuth();
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<{ lista: Documento[]; total: number; paginas: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const listar = useCallback(
    async ({ q: filtro, pagina: pag, tamPagina }: { q: string; pagina: number; tamPagina: number }) => {
      const res = await archivosService.listar({
        q: filtro,
        pagina: pag,
        tamPagina,
        columna: "fecha_registro",
        ascendente: false,
      });
      return { datos: res.datos, total: res.total };
    },
    [],
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await listar({ q, pagina, tamPagina: 10 });
      setDatos({ lista: res.datos, total: res.total, paginas: Math.max(1, Math.ceil(res.total / 10)) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los documentos.");
    } finally {
      setCargando(false);
    }
  }, [listar, q, pagina]);

  useEffect(() => {
    setPagina(1);
  }, [q]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /* Carga de archivo + metadatos */
  const [dialogo, setDialogo] = useState<"nuevo" | "editar" | null>(null);
  const [form, setForm] = useState<FormDoc>({ documento: "", descripcion: "", categoria: "" });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const abrirNuevo = () => {
    setForm({ documento: "", descripcion: "", categoria: "" });
    setArchivo(null);
    setFormId(null);
    setErrorForm(null);
    setDialogo("nuevo");
  };

  const abrirEditar = (d: Documento) => {
    setForm({ documento: d.documento, descripcion: d.descripcion ?? "", categoria: d.categoria ?? "" });
    setArchivo(null);
    setFormId(d.id_documento);
    setErrorForm(null);
    setDialogo("editar");
  };

  const guardar = async () => {
    if (!form.documento.trim()) {
      setErrorForm("El nombre del documento es obligatorio.");
      return;
    }
    if (!formId && !archivo) {
      setErrorForm("Seleccione el archivo a cargar.");
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      if (formId) {
        await archivosService.editar(formId, {
          documento: form.documento.trim(),
          descripcion: form.descripcion || null,
          categoria: form.categoria || null,
        });
      } else if (archivo) {
        await archivosService.subir(archivo, {
          documento: form.documento.trim() || archivo.name,
          descripcion: form.descripcion || null,
          categoria: form.categoria || null,
        });
      }
      setDialogo(null);
      await cargar();
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "No se pudo guardar el documento.");
    } finally {
      setGuardando(false);
    }
  };

  /* Descarga */
  const descargar = async (d: Documento) => {
    try {
      const url = await archivosService.descargar(d.id_documento);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar el documento.");
    }
  };

  /* Eliminar */
  const [eliminarFila, setEliminarFila] = useState<Documento | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const eliminar = async () => {
    if (!eliminarFila) return;
    setEliminando(true);
    try {
      await archivosService.eliminarConArchivo(eliminarFila.id_documento);
      setEliminarFila(null);
      await cargar();
    } finally {
      setEliminando(false);
    }
  };

  const tamañoLegible = (bytes?: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Archivos/Documentos</h2>
        <p className="text-sm text-muted-foreground">
          Documentos con metadatos y organización por categoría; descarga con enlace firmado.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o descripción…" />
        </div>
        {puede(["aArchivo"]) && (
          <Button className="shrink-0" onClick={abrirNuevo}>
            <PlusIcon data-icon="inline-start" /> Cargar documento
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Documento</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Tamaño</TableHead>
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
                <TableCell colSpan={6} className="p-4 text-center text-muted-foreground">No hay documentos.</TableCell>
              </TableRow>
            ) : (
              (datos?.lista ?? []).map((d) => (
                <TableRow key={d.id_documento}>
                  <TableCell>
                    <p className="font-medium">{d.documento}</p>
                    {d.descripcion && <p className="text-xs text-muted-foreground">{d.descripcion}</p>}
                  </TableCell>
                  <TableCell>{d.categoria ? <Badge variant="outline">{d.categoria}</Badge> : "—"}</TableCell>
                  <TableCell>{d.tipo ?? "—"}</TableCell>
                  <TableCell>{tamañoLegible(d.tamanio)}</TableCell>
                  <TableCell>{formatoFecha(d.fecha_registro)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" title="Descargar" onClick={() => void descargar(d)}>
                        <DownloadIcon />
                      </Button>
                      {puede(["eArchivo"]) && (
                        <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => abrirEditar(d)}>
                          <PencilIcon />
                        </Button>
                      )}
                      {puede(["dArchivo"]) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Eliminar"
                          className="text-destructive"
                          onClick={() => setEliminarFila(d)}
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
        <span>{datos?.total ?? 0} documento(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
          <span>Página {pagina} de {datos?.paginas ?? 1}</span>
          <Button variant="outline" size="sm" disabled={pagina >= (datos?.paginas ?? 1)} onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
        </div>
      </div>

      {/* ---------------------------- Crear / editar -------------------------- */}
      <Dialog
        open={dialogo !== null}
        onOpenChange={(o) => {
          if (!o && !guardando) setDialogo(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogo === "nuevo" ? "Cargar documento" : "Editar documento"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label>Nombre del documento *</Label>
              <Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} placeholder="Factura 2026-09" />
            </div>
            <div className="space-y-1">
              <Label>Categoría</Label>
              <SimpleSelect
                value={form.categoria}
                onChange={(v) => setForm({ ...form, categoria: v })}
                opciones={CATEGORIAS_BASE.map((c) => ({ valor: c, etiqueta: c }))}
                placeholder="— Sin categoría —"
              />
            </div>
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Textarea rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            {dialogo === "nuevo" && (
              <div className="space-y-1">
                <Label>Archivo (máximo 20 MB) *</Label>
                <Input
                  type="file"
                  onChange={(e) => {
                    setArchivo(e.target.files?.[0] ?? null);
                    if (e.target.files?.[0] && !form.documento) {
                      setForm((f) => ({ ...f, documento: e.target.files![0].name }));
                    }
                  }}
                />
                {archivo && <p className="text-xs text-muted-foreground">{archivo.name} · {tamañoLegible(archivo.size)}</p>}
              </div>
            )}
            {errorForm && <p className="text-sm text-destructive">{errorForm}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogo(null)} disabled={guardando}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        abierto={eliminarFila !== null}
        titulo="Eliminar documento"
        mensaje="¿Está seguro de que desea eliminar el documento y su archivo físico? Esta acción no se puede deshacer."
        textoConfirmar="Eliminar"
        ocupado={eliminando}
        onCerrar={() => setEliminarFila(null)}
        onConfirmar={() => void eliminar()}
      />
    </div>
  );
}
