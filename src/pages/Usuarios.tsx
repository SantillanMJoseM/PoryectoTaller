// ============================================================================
// Sistema Taller — Usuarios (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §10: crear, editar, eliminar y visualizar usuarios (nombre,
// RG, CPF, dirección, teléfonos, correo); contraseña con hash en Supabase
// Auth (se crea por la función de borde «crear-usuario-admin», nunca se guarda
// en claro aquí); estado activo/inactivo, fecha de registro y de expiración;
// asignación de grupo de permisos (permiso_id).
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
import { formatoFecha } from "../lib/fechas";
import type { Permiso, Usuario } from "../lib/types";

interface FormUsuario {
  nombre: string;
  rg: string;
  cpf: string;
  correo: string;
  contrasena: string;
  telefono: string;
  celular: string;
  calle: string;
  numero: string;
  barrio: string;
  ciudad: string;
  estado: string;
  permiso_id: string;
  fecha_expiracion: string;
  estado_usuario: boolean;
}

const FORM_VACIO: FormUsuario = {
  nombre: "",
  rg: "",
  cpf: "",
  correo: "",
  contrasena: "",
  telefono: "",
  celular: "",
  calle: "",
  numero: "",
  barrio: "",
  ciudad: "",
  estado: "",
  permiso_id: "",
  fecha_expiracion: "",
  estado_usuario: true,
};

export default function Usuarios() {  const { puede } = useAuth();
  const [grupos, setGrupos] = useState<Permiso[]>([]);

  useEffect(() => {
    permisosService
      .listar({ tamPagina: 100, columna: "nombre", ascendente: true })
      .then((r) => setGrupos(r.datos))
      .catch(() => setGrupos([]));
  }, []);

  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<{ lista: Usuario[]; total: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await usuariosService.listar({
        q,
        pagina,
        tamPagina: 10,
        columna: "fecha_registro",
        ascendente: false,
      });
      setDatos({ lista: res.datos, total: res.total });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los usuarios.");
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

  const nombreGrupo = useCallback(
    (id?: string | null) => grupos.find((g) => g.id_permiso === id)?.nombre ?? "—",
    [grupos],
  );

  /* Alta / edición */
  const [dialogo, setDialogo] = useState<"nuevo" | "editar" | null>(null);
  const [form, setForm] = useState<FormUsuario>(FORM_VACIO);
  const [formId, setFormId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const abrirNuevo = () => {
    setForm(FORM_VACIO);
    setFormId(null);
    setErrorForm(null);
    setDialogo("nuevo");
  };

  const abrirEditar = (u: Usuario) => {
    setForm({
      nombre: u.nombre ?? "",
      rg: u.rg ?? "",
      cpf: u.cpf ?? "",
      correo: u.correo ?? "",
      contrasena: "",
      telefono: u.telefono ?? "",
      celular: u.celular ?? "",
      calle: u.calle ?? "",
      numero: u.numero ?? "",
      barrio: u.barrio ?? "",
      ciudad: u.ciudad ?? "",
      estado: u.estado ?? "",
      permiso_id: u.permiso_id ?? "",
      fecha_expiracion: u.fecha_expiracion?.slice(0, 10) ?? "",
      estado_usuario: u.estado_usuario !== false,
    });
    setFormId(u.id_usuario);
    setErrorForm(null);
    setDialogo("editar");
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setErrorForm("El nombre es obligatorio.");
      return;
    }
    if (!form.correo.trim()) {
      setErrorForm("El correo es obligatorio (es la credencial de acceso).");
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        rg: form.rg || null,
        cpf: form.cpf || null,
        correo: form.correo.trim(),
        telefono: form.telefono || null,
        celular: form.celular || null,
        calle: form.calle || null,
        numero: form.numero || null,
        barrio: form.barrio || null,
        ciudad: form.ciudad || null,
        estado: form.estado || null,
        permiso_id: form.permiso_id || null,
        fecha_expiracion: form.fecha_expiracion || null,
        estado_usuario: form.estado_usuario,
      };
      if (formId) {
        await usuariosService.editar(formId, payload);
        // Contraseña con hash (bcrypt en Supabase Auth; función de borde).
        if (form.contrasena) {
          const { autenticacionService } = await import("../services/autenticacion");
          await autenticacionService.crearCredencial(form.correo.trim(), form.contrasena);
        }
      } else {
        const creado = await usuariosService.crear({
          ...payload,
          fecha_registro: undefined,
        });
        if (form.contrasena) {
          const { autenticacionService } = await import("../services/autenticacion");
          await autenticacionService.crearCredencial(creado.correo, form.contrasena);
        }
      }
      setDialogo(null);
      await cargar();
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "No se pudo guardar el usuario.");
    } finally {
      setGuardando(false);
    }
  };

  /* Eliminar */
  const [eliminarFila, setEliminarFila] = useState<Usuario | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const eliminar = async () => {
    if (!eliminarFila) return;
    setEliminando(true);
    try {
      await usuariosService.eliminar(eliminarFila.id_usuario);
      setEliminarFila(null);
      await cargar();
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Usuarios</h2>
        <p className="text-sm text-muted-foreground">
          Datos personales, estado activo, fechas de registro/expiración y grupo de permisos.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, correo o CPF…" className="sm:max-w-xs" />
        {puede(["aUsuario"]) && (
          <Button className="shrink-0" onClick={abrirNuevo}>
            <PlusIcon data-icon="inline-start" /> Nuevo usuario
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Grupo de permisos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Expira</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={7} className="p-4 text-center text-muted-foreground">Cargando…</TableCell>
              </TableRow>
            ) : (datos?.lista ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-4 text-center text-muted-foreground">No hay usuarios.</TableCell>
              </TableRow>
            ) : (
              (datos?.lista ?? []).map((u) => (
                <TableRow key={u.id_usuario}>
                  <TableCell>
                    <p className="font-medium">{u.nombre}</p>
                    {u.cpf && <p className="text-xs text-muted-foreground">CPF {u.cpf}</p>}
                  </TableCell>
                  <TableCell>{u.correo}</TableCell>
                  <TableCell>{u.telefono ?? "—"}</TableCell>
                  <TableCell>{nombreGrupo(u.permiso_id)}</TableCell>
                  <TableCell>
                    <Badge variant={u.estado_usuario ? "default" : "secondary"}>
                      {u.estado_usuario ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatoFecha(u.fecha_expiracion) || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {puede(["eUsuario"]) && (
                        <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => abrirEditar(u)}>
                          <PencilIcon />
                        </Button>
                      )}
                      {puede(["dUsuario"]) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Eliminar"
                          className="text-destructive"
                          onClick={() => setEliminarFila(u)}
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
        <span>{datos?.total ?? 0} usuario(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
          <span>Página {pagina}</span>
          <Button variant="outline" size="sm" onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
        </div>
      </div>

      {/* ---------------------------- Crear / editar -------------------------- */}
      <Dialog
        open={dialogo !== null}
        onOpenChange={(o) => {
          if (!o && !guardando) setDialogo(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogo === "nuevo" ? "Nuevo usuario" : "Editar usuario"}</DialogTitle>
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
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Correo (credencial) *</Label>
                <Input type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>RG</Label>
                <Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Celular</Label>
                <Input value={form.celular} onChange={(e) => setForm({ ...form, celular: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="col-span-2 space-y-1">
                <Label>Calle</Label>
                <Input value={form.calle} onChange={(e) => setForm({ ...form, calle: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Número</Label>
                <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Barrio</Label>
                <Input value={form.barrio} onChange={(e) => setForm({ ...form, barrio: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Ciudad</Label>
                <Input value={form.ciudad} onChange={(e) => setForm({ ...form, ciudad: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Estado/Provincia</Label>
                <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Estado del usuario</Label>
                <SimpleSelect
                  value={form.estado_usuario ? "si" : "no"}
                  onChange={(v) => setForm({ ...form, estado_usuario: v === "si" })}
                  opciones={[
                    { valor: "si", etiqueta: "Activo" },
                    { valor: "no", etiqueta: "Inactivo" },
                  ]}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Grupo de permisos</Label>
                <SimpleSelect
                  value={form.permiso_id}
                  onChange={(v) => setForm({ ...form, permiso_id: v })}
                  opciones={grupos.filter((g) => g.estado).map((g) => ({ valor: g.id_permiso, etiqueta: g.nombre }))}
                  placeholder="— Sin grupo —"
                />
              </div>
              <div className="space-y-1">
                <Label>Fecha de expiración</Label>
                <Input type="date" value={form.fecha_expiracion} onChange={(e) => setForm({ ...form, fecha_expiracion: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Contraseña de acceso</Label>
              <Input
                type="password"
                value={form.contrasena}
                onChange={(e) => setForm({ ...form, contrasena: e.target.value })}
                placeholder={formId ? "dejar vacío = sin cambios" : "mínimo 6 caracteres"}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Se almacena con hash en Supabase Auth (bcrypt). ROPA: la credencial se crea mediante la
                función de borde «crear-usuario-admin»; si no está desplegada, el mensaje lo indica.
              </p>
            </div>
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
        titulo="Eliminar usuario"
        mensaje="¿Está seguro de que desea eliminar el usuario? Considere desactivarlo para conservar su historial."
        textoConfirmar="Eliminar"
        ocupado={eliminando}
        onCerrar={() => setEliminarFila(null)}
        onConfirmar={() => void eliminar()}
      />
    </div>
  );
}
