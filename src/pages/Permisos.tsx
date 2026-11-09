// ============================================================================
// Sistema Taller — Permisos (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §11: crear, editar y desactivar grupos de permisos con
// códigos de actividad almacenados como array de códigos (a agregar, e editar,
// d eliminar, v visualizar, r reporte, c configuración) sobre los módulos
// Cliente, Producto, Servicio, Orden, Venta, Garantía, Movimiento, Archivo,
// Usuario, Permiso, Respaldo, Auditoría, Email y Empresa (p. ej. aCliente).
// Cuando un grupo tiene usuarios asignados se desactiva en lugar de borrarlo.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
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
import { permisosService, usuariosService } from "../services";
import { api } from "../lib/api";
import { formatoFecha } from "../lib/fechas";
import { ACCIONES, DESCRIPCION_ACCIONES, MODULOS, DESCRIPCION_MODULOS, codigo } from "../lib/permisos";
import type { Permiso } from "../lib/types";

export default function Permisos() {
  const { permisos: permisosSesion, puede } = useAuth();
  const esAdminCompleto = permisosSesion.includes("aPermiso") || permisosSesion.includes("ePermiso");

  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<{ lista: Permiso[]; total: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await permisosService.listar({
        q,
        pagina,
        tamPagina: 10,
        columna: "nombre",
        ascendente: true,
      });
      setDatos({ lista: res.datos, total: res.total });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los grupos.");
    } finally {
      setCargando(false);
    }
  }, [q, pagina]);

  useEffect(() => {
    setPagina(1);
  }, [q]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /* Alta / edición con la matriz de códigos */
  const [dialogo, setDialogo] = useState<"nuevo" | "editar" | null>(null);
  const [nombre, setNombre] = useState("");
  const [estado, setEstado] = useState(true);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [formId, setFormId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const abrirNuevo = () => {
    setNombre("");
    setEstado(true);
    // Un grupo nuevo arranca con «visualizar» de todos los módulos.
    setSeleccion(new Set(MODULOS.map((m) => codigo("v", m))));
    setFormId(null);
    setErrorForm(null);
    setDialogo("nuevo");
  };

  const abrirEditar = (g: Permiso) => {
    setNombre(g.nombre);
    setEstado(g.estado !== false);
    setSeleccion(new Set(g.permisos ?? []));
    setFormId(g.id_permiso);
    setErrorForm(null);
    setDialogo("editar");
  };

  const alternar = (c: string) => {
    const nueva = new Set(seleccion);
    if (nueva.has(c)) nueva.delete(c);
    else nueva.add(c);
    setSeleccion(nueva);
  };

  const alternarTodo = (c: any) => {
    const nueva = new Set(seleccion);
    const presentes = MODULOS.map((m) => codigo(c, m));
    if (presentes.every((p) => nueva.has(p))) {
      for (const p of presentes) nueva.delete(p);
    } else {
      for (const p of presentes) nueva.add(p);
    }
    setSeleccion(nueva);
  };

  const alternarModulo = (m: (typeof MODULOS)[number]) => {
    const nueva = new Set(seleccion);
    const presentes = ACCIONES.map((a) => codigo(a, m));
    if (presentes.every((p) => nueva.has(p))) {
      for (const p of presentes) nueva.delete(p);
    } else {
      for (const p of presentes) nueva.add(p);
    }
    setSeleccion(nueva);
  };

  const guardar = async () => {
    if (!nombre.trim()) {
      setErrorForm("El nombre del grupo es obligatorio.");
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      if (formId) await permisosService.editar(formId, { nombre: nombre.trim(), estado, permisos: [...seleccion] });
      else await permisosService.crear({ nombre: nombre.trim(), estado, permisos: [...seleccion] });
      setDialogo(null);
      await cargar();
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "No se pudo guardar el grupo.");
    } finally {
      setGuardando(false);
    }
  };

  /* Desactivar / eliminar */
  const [eliminarFila, setEliminarFila] = useState<Permiso | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const eliminar = async () => {
    if (!eliminarFila) return;
    setEliminando(true);
    try {
      // ¿Tiene usuarios asignados? → desactivar en vez de borrar (§11).
      const asignados = await usuariosService.contar({ permiso_id: eliminarFila.id_permiso });
      if (asignados > 0) {
        await permisosService.desactivar(eliminarFila.id_permiso);
        setError(
          `El grupo “${eliminarFila.nombre}” tiene ${asignados} usuario(s) asignado(s): fue desactivado en lugar de eliminado.`,
        );
      } else {
        await api.del(`/api/permisos/${eliminarFila.id_permiso}`);
      }
      setEliminarFila(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el grupo.");
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Permisos</h2>
        <p className="text-sm text-muted-foreground">
          Grupos con códigos de actividad: a=agregar, e=editar, d=eliminar, v=visualizar, r=reporte, c=configuración.
          {esAdminCompleto ? "" : " Modo de consulta."}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar grupo…" className="sm:max-w-xs" />
        {puede(["aPermiso"]) && (
          <Button className="shrink-0" onClick={abrirNuevo}>
            <PlusIcon data-icon="inline-start" /> Nuevo grupo de permisos
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-muted-foreground">{error}</p>}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Códigos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={5} className="p-4 text-center text-muted-foreground">Cargando…</TableCell>
              </TableRow>
            ) : (datos?.lista ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-4 text-center text-muted-foreground">No hay grupos de permisos.</TableCell>
              </TableRow>
            ) : (
              (datos?.lista ?? []).map((g) => (
                <TableRow key={g.id_permiso}>
                  <TableCell className="font-medium">{g.nombre}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {(g.permisos ?? []).length > 0 ? `${(g.permisos ?? []).length} código(s)` : "—"}
                    </span>
                    <p className="text-[11px] text-muted-foreground">{(g.permisos ?? []).slice(0, 12).join(", ")}{((g.permisos ?? []).length || 0) > 12 ? "…" : ""}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={g.estado ? "default" : "secondary"}>{g.estado ? "Activo" : "Inactivo"}</Badge>
                  </TableCell>
                  <TableCell>{formatoFecha(g.fecha)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {puede(["ePermiso"]) && (
                        <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => abrirEditar(g)}>
                          <PencilIcon />
                        </Button>
                      )}
                      {puede(["aPermiso"]) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Eliminar (o desactivar si tiene usuarios)"
                          className="text-destructive"
                          onClick={() => setEliminarFila(g)}
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

      <p className="text-xs text-muted-foreground">{datos?.total ?? 0} grupo(s) — más módulos y acciones en la matriz de edición.</p>

      {/* ---------------------------- Crear / editar -------------------------- */}
      <Dialog
        open={dialogo !== null}
        onOpenChange={(o) => {
          if (!o && !guardando) setDialogo(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{dialogo === "nuevo" ? "Nuevo grupo de permisos" : "Editar grupo de permisos"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
            className="space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Nombre *</Label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Administrador general" />
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <SimpleSelect
                  value={estado ? "si" : "no"}
                  onChange={(v) => setEstado(v === "si")}
                  opciones={[
                    { valor: "si", etiqueta: "Activo" },
                    { valor: "no", etiqueta: "Inactivo" },
                  ]}
                />
              </div>
            </div>

            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    {ACCIONES.map((a) => (
                      <TableHead key={a} className="text-center">
                        <button
                          type="button"
                          className="underline decoration-dotted"
                          title={`Alternar todo «${DESCRIPCION_ACCIONES[a]}»`}
                          onClick={() => alternarTodo(a)}
                        >
                          {DESCRIPCION_ACCIONES[a]}
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Todo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MODULOS.map((m) => (
                    <TableRow key={m}>
                      <TableCell className="font-medium">{DESCRIPCION_MODULOS[m]}</TableCell>
                      {ACCIONES.map((a) => {
                        const c = codigo(a, m);
                        return (
                          <TableCell key={c} className="text-center">
                            <input
                              type="checkbox"
                              checked={seleccion.has(c)}
                              onChange={() => alternar(c)}
                              title={c}
                              className="size-4 accent-[var(--primary)]"
                            />
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        <button
                          type="button"
                          className="text-xs underline decoration-dotted"
                          onClick={() => alternarModulo(m)}
                        >
                          alternar
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">
              {seleccion.size} código(s) seleccionado(s) — ejemplos: aCliente, eOrden, dUsuario.
            </p>
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
        titulo="Eliminar grupo de permisos"
        mensaje={
          eliminarFila
            ? `Si “${eliminarFila.nombre}” tiene usuarios asignados será desactivado (no eliminado) para conservarlos. ¿Continuar?`
            : ""
        }
        textoConfirmar="Continuar"
        ocupado={eliminando}
        onCerrar={() => setEliminarFila(null)}
        onConfirmar={() => void eliminar()}
      />
    </div>
  );
}
