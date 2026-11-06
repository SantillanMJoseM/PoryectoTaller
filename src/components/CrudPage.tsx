// ============================================================================
// Sistema Taller — Página CRUD genérica (TASK-0009 / AG-009)
// ============================================================================
// Plantilla de panel administrativo: búsqueda, paginación, tabla y modales de
// alta/edición/eliminación en español. Los módulos simples (Clientes, Productos,
// Servicios, Garantías, Usuarios, Permisos…) la consumen con sus campos; los
// módulos complejos (Órdenes, Ventas, Financiero) tienen pantalla propia.
// Las fechas se muestran dd/mm/aaaa y los valores con 2 decimales (RB-029/031).
// ============================================================================

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "lucide-react";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import SimpleSelect, { type OpcionSelect } from "./SimpleSelect";
import ConfirmDialog from "./ConfirmDialog";
import { formatoDinero } from "../lib/dinero";
import { formatoFecha } from "../lib/fechas";

export type Fila = Record<string, unknown>;

export type CampoTipo =
  | "texto"
  | "parrafo"
  | "numero"
  | "dinero"
  | "fecha"
  | "booleano"
  | "seleccion";

export interface CampoForm {
  clave: string;
  etiqueta: string;
  tipo?: CampoTipo;
  opciones?: OpcionSelect[];
  obligatorio?: boolean;
  placeholder?: string;
  ayuda?: string;
  /** Ajuste fino del valor tomado de la fila para precargar el formulario. */
  desdeFila?: (fila: Fila) => string | boolean;
  /** Acción auxiliar junto al campo (p. ej. agregar marca). */
  accion?: ReactNode;
}

export interface ColumnaFila {
  clave: string;
  etiqueta: string;
  formato?: "texto" | "dinero" | "fecha" | "booleano" | "numero";
  render?: (fila: Fila) => ReactNode;
  /** Clases adicionales de la celda (p. ej. text-right). */
  clase?: string;
}

export interface CrudPageProps {
  titulo: string;
  /** Nombre singular para los títulos de los modales («Nuevo Cliente»). */
  singular?: string;
  descripcion?: string;
  columnas: ColumnaFila[];
  campos: CampoForm[];
  listar: (opciones: { q: string; pagina: number; tamPagina: number }) => Promise<{
    datos: Fila[];
    total: number;
  }>;
  guardar: (datos: Fila, identificador?: string) => Promise<void>;
  eliminar?: (identificador: string) => Promise<void>;
  clave: (fila: Fila) => string;
  /** Contenido del modal «Ver detalle» (si existe, se muestra la lupa). */
  ver?: (fila: Fila) => ReactNode;
  /** Botones extra por fila (imprimir, facturar, ajustar stock…). */
  acciones?: (fila: Fila) => ReactNode;
  puedeAgregar: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
  /** Bloque adicional bajo el encabezado (alertas, tarjetas…). */
  cabecera?: ReactNode;
  tamPagina?: number;
  placeholderBusqueda?: string;
  /** Fuerza una recarga cuando cambia (p. ej. tras ajustar stock). */
  recargarKey?: number;
}

const SI_NO: OpcionSelect[] = [
  { valor: "si", etiqueta: "Sí" },
  { valor: "no", etiqueta: "No" },
];

/** Valor inicial del formulario a partir de la definición de campos. */
function valorInicial(campo: CampoForm): string | boolean {
  return campo.tipo === "booleano" ? false : "";
}

function valorDeFila(campo: CampoForm, fila: Fila): string | boolean {
  if (campo.desdeFila) return campo.desdeFila(fila);
  const v = fila[campo.clave];
  switch (campo.tipo ?? "texto") {
    case "booleano":
      return v === true;
    case "seleccion":
      return v === null || v === undefined ? "" : String(v);
    case "numero":
    case "dinero":
      return v === null || v === undefined ? "" : String(v);
    default:
      return v === null || v === undefined ? "" : String(v);
  }
}

/** Convierte el estado del formulario en el payload para el servicio. */
function construirPayload(campos: CampoForm[], form: Record<string, string | boolean>): Fila {
  const datos: Fila = {};
  for (const c of campos) {
    const v = form[c.clave];
    switch (c.tipo ?? "texto") {
      case "booleano":
        datos[c.clave] = v === true;
        break;
      case "numero":
      case "dinero": {
        const texto = String(v ?? "").trim();
        datos[c.clave] = texto === "" ? 0 : Number(texto.replace(",", "."));
        break;
      }
      case "seleccion":
        datos[c.clave] = String(v ?? "").trim() === "" ? null : String(v);
        break;
      default: {
        const texto = String(v ?? "").trim();
        datos[c.clave] = texto === "" ? null : texto;
        break;
      }
    }
  }
  return datos;
}

function Celda({ fila, col }: { fila: Fila; col: ColumnaFila }) {
  if (col.render) return <>{col.render(fila)}</>;
  const v = fila[col.clave];
  let texto: string;
  switch (col.formato ?? "texto") {
    case "dinero":
      texto = formatoDinero(Number(v ?? 0));
      break;
    case "fecha":
      texto = typeof v === "string" ? formatoFecha(v) : "";
      break;
    case "booleano":
      texto = v === true ? "Sí" : "No";
      break;
    case "numero":
      texto = String(v ?? "");
      break;
    default:
      texto = v === null || v === undefined ? "" : String(v);
  }
  return <span className="text-foreground">{texto}</span>;
}

export default function CrudPage({
  titulo,
  singular,
  descripcion,
  columnas,
  campos,
  listar,
  guardar,
  eliminar,
  clave,
  ver,
  acciones,
  puedeAgregar,
  puedeEditar,
  puedeEliminar,
  cabecera,
  tamPagina = 10,
  placeholderBusqueda = "Buscar…",
  recargarKey,
}: CrudPageProps) {
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogo, setDialogo] = useState<"nuevo" | "editar" | null>(null);
  const [verFila, setVerFila] = useState<Fila | null>(null);
  const [filaEliminar, setFilaEliminar] = useState<Fila | null>(null);
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [formId, setFormId] = useState<string | undefined>(undefined);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const paginas = Math.max(1, Math.ceil(total / tamPagina));

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await listar({ q, pagina, tamPagina });
      setFilas(res.datos);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los datos.");
    } finally {
      setCargando(false);
    }
  }, [listar, q, pagina, tamPagina]);

  // Resetear a la primera página al cambiar el buscador.
  useEffect(() => {
    setPagina(1);
  }, [q]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (recargarKey === undefined) return;
    void cargar();
  }, [recargarKey]);

  const abrirNuevo = () => {
    const inicial: Record<string, string | boolean> = {};
    for (const c of campos) inicial[c.clave] = valorInicial(c);
    setForm(inicial);
    setFormId(undefined);
    setErrorForm(null);
    setDialogo("nuevo");
  };

  const abrirEditar = (fila: Fila) => {
    const inicial: Record<string, string | boolean> = {};
    for (const c of campos) inicial[c.clave] = valorDeFila(c, fila);
    setForm(inicial);
    setFormId(clave(fila));
    setErrorForm(null);
    setDialogo("editar");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validación en el frontend (SOURCE_PROMPT: validar formularios aquí y en BD).
    const faltantes = campos.filter(
      (c) => c.obligatorio && !String(form[c.clave] ?? "").trim() && c.tipo !== "booleano",
    );
    if (faltantes.length > 0) {
      setErrorForm(`Complete: ${faltantes.map((c) => c.etiqueta).join(", ")}.`);
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      await guardar(construirPayload(campos, form), formId);
      setDialogo(null);
      await cargar();
    } catch (e2) {
      setErrorForm(e2 instanceof Error ? e2.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!filaEliminar) return;
    setEliminando(true);
    try {
      await eliminar?.(clave(filaEliminar));
      setFilaEliminar(null);
      await cargar();
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">{titulo}</h2>
        {descripcion && <p className="text-sm text-muted-foreground">{descripcion}</p>}
      </div>

      {cabecera}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholderBusqueda}
            className="pl-8"
          />
        </div>
        {puedeAgregar && (
          <Button onClick={abrirNuevo} className="shrink-0">
            <PlusIcon data-icon="inline-start" />
            Nuevo
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {columnas.map((c) => (
                <TableHead key={c.clave} className={c.clase}>
                  {c.etiqueta}
                </TableHead>
              ))}
              {(ver || puedeEditar || puedeEliminar || acciones) && (
                <TableHead className="text-right">Acciones</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={columnas.length + 1} className="p-4 text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            ) : filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnas.length + 1} className="p-4 text-center text-muted-foreground">
                  No hay registros {q ? "para la búsqueda " + q : "aún"}.
                </TableCell>
              </TableRow>
            ) : (
              filas.map((f, i) => (
                <TableRow key={String(clave(f)) + "-" + i}>
                  {columnas.map((c) => (
                    <TableCell key={c.clave} className={c.clase}>
                      <Celda fila={f} col={c} />
                    </TableCell>
                  ))}
                  {(ver || puedeEditar || puedeEliminar || acciones) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {ver && (
                          <Button variant="ghost" size="icon-sm" title="Ver" onClick={() => setVerFila(f)}>
                            <SearchIcon />
                          </Button>
                        )}
                        {acciones?.(f)}
                        {puedeEditar && (
                          <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => abrirEditar(f)}>
                            <PencilIcon />
                          </Button>
                        )}
                        {puedeEliminar && eliminar && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Eliminar"
                            className="text-destructive"
                            onClick={() => setFilaEliminar(f)}
                          >
                            <TrashIcon />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} registro(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
            Anterior
          </Button>
          <span>
            Página {pagina} de {paginas}
          </span>
          <Button variant="outline" size="sm" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>
            Siguiente
          </Button>
        </div>
      </div>

      {/* ------------------------------ Alta / edición --------------------- */}
      <Dialog
        open={dialogo !== null}
        onOpenChange={(o) => {
          if (!o && !guardando) setDialogo(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogo === "nuevo" ? "Nuevo " : "Editar "}
              {(singular ?? titulo).replace(/s$/, "")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            {campos.map((c) => (
              <div key={c.clave} className="space-y-1">
                <Label>{c.etiqueta}{c.obligatorio ? " *" : ""}</Label>
                <div className="flex items-end gap-2">
              <div className="flex-1">
                {c.tipo === "parrafo" ? (
                  <Textarea
                    rows={3}
                    value={String(form[c.clave] ?? "")}
                    placeholder={c.placeholder}
                    onChange={(e) => setForm({ ...form, [c.clave]: e.target.value })}
                  />
                ) : c.tipo === "booleano" ? (
                  <SimpleSelect
                    value={form[c.clave] === true ? "si" : "no"}
                    onChange={(v) => setForm({ ...form, [c.clave]: v === "si" })}
                    opciones={SI_NO}
                  />
                ) : c.tipo === "seleccion" ? (
                  <SimpleSelect
                    value={String(form[c.clave] ?? "")}
                    onChange={(v) => setForm({ ...form, [c.clave]: v })}
                    opciones={c.opciones ?? []}
                    placeholder="— Seleccione —"
                  />
                ) : (
                  <Input
                    type={c.tipo === "fecha" ? "date" : c.tipo === "numero" || c.tipo === "dinero" ? "number" : "text"}
                    step={c.tipo === "dinero" ? "0.01" : c.tipo === "numero" ? "1" : undefined}
                    value={String(form[c.clave] ?? "")}
                    placeholder={c.placeholder}
                    onChange={(e) => setForm({ ...form, [c.clave]: e.target.value })}
                  />
                )}
              </div>
              {c.accion && <div className="shrink-0">{c.accion}</div>}
            </div>
            {c.ayuda && <p className="text-xs text-muted-foreground">{c.ayuda}</p>}
              </div>
            ))}
            {errorForm && <p className="text-sm text-destructive">{errorForm}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogo(null)} disabled={guardando}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------ Ver detalle ------------------------ */}
      <Dialog
        open={verFila !== null}
        onOpenChange={(o) => {
          if (!o) setVerFila(null);
        }}
      >
        <DialogContent className="sm:max-w-lg overflow-y-auto max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Detalle</DialogTitle>
          </DialogHeader>
          {verFila && ver?.(verFila)}
        </DialogContent>
      </Dialog>

      {/* ------------------------------ Confirmar baja --------------------- */}
      <ConfirmDialog
        abierto={filaEliminar !== null}
        titulo="Eliminar registro"
        mensaje="¿Está seguro de que desea eliminar el registro? Esta acción no se puede deshacer."
        textoConfirmar="Eliminar"
        ocupado={eliminando}
        onCerrar={() => setFilaEliminar(null)}
        onConfirmar={() => void confirmarEliminar()}
      />
    </div>
  );
}
