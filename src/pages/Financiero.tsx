// ============================================================================
// Sistema Taller — Financiero (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §8: crear, editar, eliminar movimientos (ingreso/egreso);
// valor, vencimiento, fecha de pago, pagado/pendiente; cliente/proveedor,
// categoría, cuenta, forma de pago; anexo; vinculación con venta; filtros por
// período (día/semana/mes/año/todos), por situación (todos/previsto/atrasado/
// realizado/pendiente), totales por período y detección de vencidos.
// RB-014: un movimiento pagado exige fecha de pago (RPC mov_marcar_pagado).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
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
import { clientesService, financieroService } from "../services";
import { formatoDinero } from "../lib/dinero";
import { formatoFecha, hoyISO, type Periodo } from "../lib/fechas";
import { SITUACIONES, type Situacion } from "../lib/financiero-utils";
import type {
  Categoria,
  Cliente,
  Cuenta,
  MovimientoFinanciero,
  TipoMovimiento,
} from "../lib/types";

type MovimientoFila = MovimientoFinanciero & { situacion: string; vencido: boolean; clientes?: Pick<Cliente, "nombre_cliente"> | null; categorias?: Pick<Categoria, "categoria"> | null; cuentas?: Pick<Cuenta, "cuenta"> | null };

const ETIQUETA_SITUACION: Record<string, string> = {
  todos: "Todos",
  previsto: "Previsto",
  atrasado: "Atrasado",
  realizado: "Realizado",
  pendiente: "Pendiente",
};

interface FormMov {
  descripcion: string;
  tipo: TipoMovimiento;
  valor: string;
  fecha_vencimiento: string;
  fecha_pago: string;
  pagado: boolean;
  cliente_proveedor: string;
  forma_pago: string;
  cliente_id: string;
  categoria_id: string;
  cuenta_id: string;
}

const FORM_VACIO: FormMov = {
  descripcion: "",
  tipo: "ingreso",
  valor: "",
  fecha_vencimiento: "",
  fecha_pago: "",
  pagado: false,
  cliente_proveedor: "",
  forma_pago: "",
  cliente_id: "",
  categoria_id: "",
  cuenta_id: "",
};

export default function Financiero() {
  const { puede } = useAuth();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);

  useEffect(() => {
    clientesService
      .listar({ tamPagina: 200, columna: "nombre_cliente", ascendente: true })
      .then((r) => setClientes(r.datos))
      .catch(() => setClientes([]));
    financieroService
      .listarCategorias()
      .then(setCategorias)
      .catch(() => setCategorias([]));
    financieroService
      .listarCuentas()
      .then(setCuentas)
      .catch(() => setCuentas([]));
  }, []);

  // Filtros §8
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [situacion, setSituacion] = useState<Situacion>("todos");
  const [tipo, setTipo] = useState<"todos" | TipoMovimiento>("todos");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);

  const [datos, setDatos] = useState<{
    lista: MovimientoFila[];
    totales: { ingresos: number; egresos: number; saldo: number };
    vencidos: number;
    total: number;
    paginas: number;
  } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await financieroService.listarFiltradas({
        periodo,
        situacionFiltro: situacion,
        tipo: tipo === "todos" ? undefined : tipo,
        q,
        pagina,
        tamPagina: 15,
      });
      setDatos({
        lista: res.datos as unknown as MovimientoFila[],
        totales: res.totales,
        vencidos: res.vencidos,
        total: res.total,
        paginas: res.paginas,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los movimientos.");
    } finally {
      setCargando(false);
    }
  }, [periodo, situacion, tipo, q, pagina]);

  useEffect(() => {
    setPagina(1);
  }, [periodo, situacion, tipo, q]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const nombreCliente = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientes) m.set(c.id_cliente, c.nombre_cliente);
    return m;
  }, [clientes]);

  /* Alta / edición */
  const [dialogo, setDialogo] = useState<"nuevo" | "editar" | null>(null);
  const [form, setForm] = useState<FormMov>(FORM_VACIO);
  const [formId, setFormId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const abrirNuevo = () => {
    setForm(FORM_VACIO);
    setFormId(null);
    setErrorForm(null);
    setDialogo("nuevo");
  };

  const abrirEditar = (m: MovimientoFila) => {
    setForm({
      descripcion: m.descripcion ?? "",
      tipo: m.tipo,
      valor: String(m.valor ?? ""),
      fecha_vencimiento: m.fecha_vencimiento?.slice(0, 10) ?? "",
      fecha_pago: m.fecha_pago?.slice(0, 10) ?? "",
      pagado: m.pagado === true,
      cliente_proveedor: m.cliente_proveedor ?? "",
      forma_pago: m.forma_pago ?? "",
      cliente_id: m.cliente_id ?? "",
      categoria_id: m.categoria_id ?? "",
      cuenta_id: m.cuenta_id ?? "",
    });
    setFormId(m.id_movimiento);
    setErrorForm(null);
    setDialogo("editar");
  };

  const guardar = async () => {
    if (!form.descripcion.trim()) {
      setErrorForm("La descripción del movimiento es obligatoria.");
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      const payload: Partial<MovimientoFinanciero> = {
        descripcion: form.descripcion.trim(),
        tipo: form.tipo,
        valor: Number(form.valor.replace(",", ".") || "0"),
        fecha_vencimiento: form.fecha_vencimiento || null,
        fecha_pago: form.fecha_pago || null,
        pagado: form.pagado,
        cliente_proveedor: form.cliente_proveedor || null,
        forma_pago: form.forma_pago || null,
        cliente_id: form.cliente_id || null,
        categoria_id: form.categoria_id || null,
        cuenta_id: form.cuenta_id || null,
      };
      if (formId) await financieroService.editar(formId, payload);
      else await financieroService.crear(payload);
      setDialogo(null);
      await cargar();
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "No se pudo guardar el movimiento.");
    } finally {
      setGuardando(false);
    }
  };

  /* Marcar pagado + eliminar */
  const [pagarFila, setPagarFila] = useState<MovimientoFila | null>(null);
  const [pagando, setPagando] = useState(false);
  const marcarPagado = async () => {
    if (!pagarFila) return;
    setPagando(true);
    try {
      await financieroService.marcarPagado(pagarFila.id_movimiento, hoyISO());
      setPagarFila(null);
      await cargar();
    } finally {
      setPagando(false);
    }
  };

  const [eliminarFila, setEliminarFila] = useState<MovimientoFila | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const eliminar = async () => {
    if (!eliminarFila) return;
    setEliminando(true);
    try {
      await financieroService.eliminar(eliminarFila.id_movimiento);
      setEliminarFila(null);
      await cargar();
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Financiero</h2>
        <p className="text-sm text-muted-foreground">
          Movimientos de ingreso/egreso con vencimientos, situaciones y totales por período.
        </p>
      </div>

      {/* Totales del período */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Ingresos del período</p>
            <p className="text-2xl font-bold text-emerald-700">{datos ? formatoDinero(datos.totales.ingresos) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Egresos del período</p>
            <p className="text-2xl font-bold text-red-700">{datos ? formatoDinero(datos.totales.egresos) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className="text-2xl font-bold">{datos ? formatoDinero(datos.totales.saldo) : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Vencidos / Movimientos</p>
            <p className="text-2xl font-bold">
              {datos ? `${datos.vencidos} / ${datos.total}` : "—"}
            </p>
            {datos && datos.vencidos > 0 && <Badge variant="destructive">Detectados atrasos</Badge>}
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SimpleSelect
            value={periodo}
            onChange={(v) => setPeriodo(v as Periodo)}
            opciones={[
              { valor: "todos", etiqueta: "Período: todos" },
              { valor: "dia", etiqueta: "Día" },
              { valor: "semana", etiqueta: "Semana" },
              { valor: "mes", etiqueta: "Mes" },
              { valor: "anio", etiqueta: "Año" },
            ]}
            className="w-40"
          />
          <SimpleSelect
            value={situacion}
            onChange={(v) => setSituacion(v as Situacion)}
            opciones={SITUACIONES.map((s) => ({ valor: s, etiqueta: ETIQUETA_SITUACION[s] }))}
            className="w-40"
          />
          <SimpleSelect
            value={tipo}
            onChange={(v) => setTipo(v as "todos" | TipoMovimiento)}
            opciones={[
              { valor: "todos", etiqueta: "Ingresos y egresos" },
              { valor: "ingreso", etiqueta: "Ingresos" },
              { valor: "egreso", etiqueta: "Egresos" },
            ]}
            className="w-48"
          />
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Descripción o cliente/proveedor…" className="w-64 pl-8" />
          </div>
        </div>
        {puede(["aMovimiento"]) && (
          <Button className="shrink-0" onClick={abrirNuevo}>
            <PlusIcon data-icon="inline-start" /> Nuevo movimiento
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vencimiento</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Cliente/Proveedor</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Situación</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cargando ? (
              <TableRow>
                <TableCell colSpan={9} className="p-4 text-center text-muted-foreground">Cargando…</TableCell>
              </TableRow>
            ) : (datos?.lista ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="p-4 text-center text-muted-foreground">
                  Sin movimientos para los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              (datos?.lista ?? []).map((m) => (
                <TableRow key={m.id_movimiento}>
                  <TableCell>
                    {formatoFecha(m.fecha_vencimiento)}
                    {m.vencido && <Badge variant="destructive" className="ml-1">Vencido</Badge>}
                  </TableCell>
                  <TableCell>{m.descripcion}</TableCell>
                  <TableCell>
                    {m.clientes?.nombre_cliente ?? nombreCliente.get(m.cliente_id ?? "") ?? m.cliente_proveedor ?? "—"}
                  </TableCell>
                  <TableCell>{m.categorias?.categoria ?? "—"}</TableCell>
                  <TableCell>{m.cuentas?.cuenta ?? "—"}</TableCell>
                  <TableCell>{m.tipo}</TableCell>
                  <TableCell className="text-right">{formatoDinero(m.valor)}</TableCell>
                  <TableCell>
                    <Badge variant={m.pagado ? "default" : m.vencido ? "destructive" : "outline"}>
                      {ETIQUETA_SITUACION[m.situacion] ?? m.situacion}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {!m.pagado && puede(["eMovimiento"]) && (
                        <Button variant="ghost" size="sm" title="Marcar pagado" onClick={() => setPagarFila(m)}>
                          Pagar
                        </Button>
                      )}
                      {puede(["eMovimiento"]) && (
                        <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => abrirEditar(m)}>
                          <PencilIcon />
                        </Button>
                      )}
                      {puede(["dMovimiento"]) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Eliminar"
                          className="text-destructive"
                          onClick={() => setEliminarFila(m)}
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
        <span>{datos?.total ?? 0} movimiento(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
          <span>Página {pagina} de {datos?.paginas ?? 1}</span>
          <Button variant="outline" size="sm" disabled={pagina >= (datos?.paginas ?? 1)} onClick={() => setPagina(pagina + 1)}>Siguiente</Button>
        </div>
      </div>

      {/* --------------------------- Crear / editar --------------------------- */}
      <Dialog
        open={dialogo !== null}
        onOpenChange={(o) => {
          if (!o && !guardando) setDialogo(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogo === "nuevo" ? "Nuevo movimiento" : "Editar movimiento"}</DialogTitle>
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
                <Label>Descripción *</Label>
                <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <SimpleSelect
                  value={form.tipo}
                  onChange={(v) => setForm({ ...form, tipo: v as TipoMovimiento })}
                  opciones={[
                    { valor: "ingreso", etiqueta: "Ingreso" },
                    { valor: "egreso", etiqueta: "Egreso" },
                  ]}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Valor</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Forma de pago</Label>
                <Input value={form.forma_pago} onChange={(e) => setForm({ ...form, forma_pago: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Fecha de vencimiento</Label>
                <Input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Fecha de pago</Label>
                <Input type="date" value={form.fecha_pago} onChange={(e) => setForm({ ...form, fecha_pago: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Situación: pagado</Label>
              <SimpleSelect
                value={form.pagado ? "si" : "no"}
                onChange={(v) => setForm({ ...form, pagado: v === "si" })}
                opciones={[
                  { valor: "no", etiqueta: "Pendiente" },
                  { valor: "si", etiqueta: "Pagado" },
                ]}
              />
              <p className="text-xs text-muted-foreground">
                Un movimiento pagado exige fecha de pago; si falta se registra la del día al guardar o al marcar «Pagar».
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Cliente (vinculado)</Label>
                <SimpleSelect
                  value={form.cliente_id}
                  onChange={(v) => setForm({ ...form, cliente_id: v })}
                  opciones={clientes.map((c) => ({ valor: c.id_cliente, etiqueta: c.nombre_cliente }))}
                  placeholder="— Sin cliente —"
                />
              </div>
              <div className="space-y-1">
                <Label>Cliente/Proveedor (texto)</Label>
                <Input value={form.cliente_proveedor} onChange={(e) => setForm({ ...form, cliente_proveedor: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Categoría</Label>
                <SimpleSelect
                  value={form.categoria_id}
                  onChange={(v) => setForm({ ...form, categoria_id: v })}
                  opciones={categorias
                    .filter((c) => !form.tipo || c.tipo === form.tipo)
                    .map((c) => ({ valor: c.id_categoria, etiqueta: c.categoria }))}
                  placeholder="— Sin categoría —"
                />
              </div>
              <div className="space-y-1">
                <Label>Cuenta</Label>
                <SimpleSelect
                  value={form.cuenta_id}
                  onChange={(v) => setForm({ ...form, cuenta_id: v })}
                  opciones={cuentas.map((c) => ({ valor: c.id_cuenta, etiqueta: c.cuenta }))}
                  placeholder="— Sin cuenta —"
                />
              </div>
            </div>
            {errorForm && <p className="text-sm text-destructive">{errorForm}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogo(null)} disabled={guardando}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --------------------------- Marcar pagado ---------------------------- */}
      <ConfirmDialog
        abierto={pagarFila !== null}
        titulo="Marcar pagado"
        mensaje={
          pagarFila
            ? `Se registrará el pago de “${pagarFila.descripcion}” (${formatoDinero(Number(pagarFila.valor))}) con fecha del día. La situación pasará a «Realizado».`
            : ""
        }
        textoConfirmar="Confirmar pago"
        ocupado={pagando}
        variante="default"
        onCerrar={() => setPagarFila(null)}
        onConfirmar={() => void marcarPagado()}
      />

      {/* --------------------------- Eliminar --------------------------------- */}
      <ConfirmDialog
        abierto={eliminarFila !== null}
        titulo="Eliminar movimiento"
        mensaje="¿Está seguro de que desea eliminar este movimiento financiero? Esta acción no se puede deshacer."
        textoConfirmar="Eliminar"
        ocupado={eliminando}
        onCerrar={() => setEliminarFila(null)}
        onConfirmar={() => void eliminar()}
      />
    </div>
  );
}
