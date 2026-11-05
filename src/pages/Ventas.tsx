// ============================================================================
// Sistema Taller — Ventas (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §6: crear, editar, eliminar y visualizar ventas; cliente,
// usuario y fecha; agregar/quitar productos con cantidad, precio y subtotal;
// descuento y valor total; facturar una sola vez (crea movimiento financiero
// y marca facturado=true); imprimir venta; control de stock por RPC.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PlusIcon,
  PrinterIcon,
  SearchIcon,
  TrashIcon,
  ReceiptIcon,
  PencilIcon,
} from "lucide-react";
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
import {
  clientesService,
  empresaService,
  financieroService,
  ventasService,
  usuariosService,
  productosService,
} from "../services";
import { descargarPdf, pdfDocumento } from "../lib/pdf";
import { formatoDinero } from "../lib/dinero";
import { formatoFecha, hoyISO } from "../lib/fechas";
import type {
  Categoria,
  Cliente,
  Cuenta,
  Empresa,
  ItemVenta,
  Producto,
  Usuario,
  Venta,
} from "../lib/types";

type VentaConCliente = Venta & { clientes?: Pick<Cliente, "nombre_cliente"> | null };

/* -------------------------------------------------------------------------- */
/* Detalle de venta                                                           */
/* -------------------------------------------------------------------------- */

function DetalleVenta({
  idVenta,
  empresa,
  puedeEditar,
  onCerrar,
}: {
  idVenta: string;
  empresa: Empresa | null;
  puedeEditar: boolean;
  onCerrar: () => void;
}) {
  const [venta, setVenta] = useState<Venta | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Autocompletado de productos (§6: control de stock al agregar/quitar).
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Producto[]>([]);
  const [prodSel, setProdSel] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState("1");

  const cargar = useCallback(async () => {
    try {
      setVenta(await ventasService.obtenerConDetalles(idVenta));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la venta.");
    }
  }, [idVenta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    let vigente = true;
    if (!busqueda.trim()) {
      setResultados([]);
      return;
    }
    productosService
      .autocompletar(busqueda, 8)
      .then((l) => {
        if (vigente) setResultados(l);
      })
      .catch(() => setResultados([]));
    return () => {
      vigente = false;
    };
  }, [busqueda]);

  const correr = useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn();
        setError(null);
        await cargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      }
    },
    [cargar],
  );

  const agregarItem = () => {
    if (!venta || !prodSel) return;
    void correr(() =>
      ventasService.agregarItem(venta.id_venta, prodSel.id_producto, Number(cantidad || "1")),
    );
    setProdSel(null);
    setBusqueda("");
    setCantidad("1");
  };

  const items: ItemVenta[] = (venta?.items_venta as ItemVenta[] | undefined) ?? [];

  const imprimir = () => {
    if (!venta) return;
    const datos = empresa
      ? {
          nombre: empresa.nombre,
          direccion: [empresa.calle, empresa.numero, empresa.barrio, empresa.ciudad, empresa.provincia]
            .filter(Boolean)
            .join(", "),
          telefono: empresa.telefono ?? undefined,
          correo: empresa.correo ?? undefined,
        }
      : {};
    const lineas = items.map((i) => ({
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precio: i.precio,
      subtotal: i.subtotal,
    }));
    const extras = [
      `Cliente: ${venta.clientes?.nombre_cliente ?? "—"}`,
      `Usuario: ${venta.usuarios?.nombre ?? "—"}`,
      `Fecha: ${formatoFecha(venta.fecha_venta)} · Facturada: ${venta.facturado ? "Sí" : "No"}`,
    ];
    const doc = pdfDocumento(
      "Comprobante de venta",
      `N.º ${venta.id_venta.slice(0, 8).toUpperCase()} · ${formatoFecha(venta.fecha_venta)}`,
      datos,
      extras,
      lineas,
      Number(venta.valor_total ?? 0),
    );
    descargarPdf(doc, `venta-${venta.id_venta.slice(0, 8)}.pdf`);
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Detalle de la venta</DialogTitle>
      </DialogHeader>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!venta ? (
        <p className="text-sm text-muted-foreground">Cargando venta…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={venta.facturado ? "default" : "secondary"}>
              {venta.facturado ? "Facturada" : "Sin facturar"}
            </Badge>
            <span className="text-muted-foreground">
              {formatoFecha(venta.fecha_venta)} · {venta.clientes?.nombre_cliente ?? "—"} · {venta.usuarios?.nombre ?? "—"}
            </span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={imprimir}>
              <PrinterIcon data-icon="inline-start" /> Imprimir
            </Button>
          </div>
          <div className="rounded-xl border p-3">
            <h4 className="mb-2 text-sm font-semibold">Ítems (el stock se descuentó al agregarlos)</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cant.</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  {puedeEditar && <TableHead className="text-right">Quitar</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id_item_venta}>
                    <TableCell>
                      {puedeEditar ? (
                        <Input
                          type="number"
                          min="1"
                          className="h-7 w-16"
                          defaultValue={String(i.cantidad)}
                          onBlur={(e) => {
                            const nueva = Number(e.target.value);
                            if (nueva > 0 && nueva !== i.cantidad)
                              void correr(() => ventasService.cambiarCantidadItem(i.id_item_venta, nueva));
                          }}
                        />
                      ) : (
                        i.cantidad
                      )}
                    </TableCell>
                    <TableCell>{i.descripcion}</TableCell>
                    <TableCell className="text-right">{formatoDinero(i.precio)}</TableCell>
                    <TableCell className="text-right">{formatoDinero(i.subtotal)}</TableCell>
                    {puedeEditar && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Quitar (devuelve stock)"
                          className="text-destructive"
                          onClick={() => void correr(() => ventasService.quitarItem(i.id_item_venta))}
                        >
                          <TrashIcon />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={puedeEditar ? 5 : 4} className="text-center text-muted-foreground">Sin ítems.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {puedeEditar && (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <div className="relative min-w-48 flex-1">
                  <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Buscar producto (autocompletado)…"
                    value={prodSel ? prodSel.descripcion : busqueda}
                    onChange={(e) => {
                      setProdSel(null);
                      setBusqueda(e.target.value);
                    }}
                  />
                  {!prodSel && resultados.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border bg-popover shadow-md">
                      {resultados.map((p) => (
                        <li key={p.id_producto}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-muted"
                            onClick={() => setProdSel(p)}
                          >
                            <span>{p.descripcion}</span>
                            <span className="text-xs text-muted-foreground">
                              stock {String(p.stock)} · {formatoDinero(Number(p.precio_venta ?? 0))}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Input type="number" min="1" className="w-20" value={cantidad} onChange={(e) => setCantidad(e.target.value)} title="Cantidad" />
                <Button size="sm" onClick={agregarItem}>
                  <PlusIcon data-icon="inline-start" /> Agregar
                </Button>
              </div>
            )}
          </div>
          <p className="text-right text-sm">
            {Number(venta.descuento ?? 0) > 0 && (
              <span className="mr-3 text-muted-foreground">Descuento: {formatoDinero(Number(venta.descuento))}</span>
            )}
            <span className="font-medium">Valor total: </span>
            <span className="font-bold">{formatoDinero(venta.valor_total)}</span>
          </p>
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onCerrar}>Cerrar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* -------------------------------------------------------------------------- */
/* Pantalla principal de ventas                                               */
/* -------------------------------------------------------------------------- */

interface FormVenta {
  cliente_id: string;
  usuario_id: string;
  fecha_venta: string;
  descuento: string;
}

export default function Ventas() {
  const { puede } = useAuth();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  useEffect(() => {
    clientesService
      .listar({ tamPagina: 200, columna: "nombre_cliente", ascendente: true })
      .then((r) => setClientes(r.datos))
      .catch(() => setClientes([]));
    usuariosService
      .listar({ tamPagina: 200, columna: "nombre", ascendente: true })
      .then((r) => setUsuarios(r.datos))
      .catch(() => setUsuarios([]));
    financieroService
      .listarCategorias("ingreso")
      .then(setCategorias)
      .catch(() => setCategorias([]));
    financieroService
      .listarCuentas()
      .then(setCuentas)
      .catch(() => setCuentas([]));
    empresaService
      .obtener()
      .then(setEmpresa)
      .catch(() => setEmpresa(null));
  }, []);

  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<{ lista: VentaConCliente[]; total: number; paginas: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await ventasService.listarFiltradas({
        fechaInicial: fechaDesde || undefined,
        fechaFinal: fechaHasta || undefined,
        pagina,
        tamPagina: 10,
      });
      setDatos({ lista: res.datos as unknown as VentaConCliente[], total: res.total, paginas: res.paginas });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las ventas.");
    } finally {
      setCargando(false);
    }
  }, [fechaDesde, fechaHasta, pagina]);

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
  const [form, setForm] = useState<FormVenta>({ cliente_id: "", usuario_id: "", fecha_venta: "", descuento: "0" });
  const [formId, setFormId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [verId, setVerId] = useState<string | null>(null);

  const abrirNuevo = () => {
    setForm({ cliente_id: "", usuario_id: "", fecha_venta: hoyISO(), descuento: "0" });
    setFormId(null);
    setErrorForm(null);
    setDialogo("nuevo");
  };

  const abrirEditar = (v: VentaConCliente) => {
    setForm({
      cliente_id: v.cliente_id ?? "",
      usuario_id: v.usuario_id ?? "",
      fecha_venta: v.fecha_venta?.slice(0, 10) ?? hoyISO(),
      descuento: String(v.descuento ?? "0"),
    });
    setFormId(v.id_venta);
    setErrorForm(null);
    setDialogo("editar");
  };

  const guardar = async () => {
    setGuardando(true);
    setErrorForm(null);
    try {
      const payload: Partial<Venta> = {
        cliente_id: form.cliente_id || null,
        usuario_id: form.usuario_id || null,
        fecha_venta: form.fecha_venta || hoyISO(),
        descuento: Number(form.descuento.replace(",", ".") || "0"),
      };
      if (formId) await ventasService.editar(formId, payload);
      else await ventasService.crear(payload);
      setDialogo(null);
      await cargar();
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "No se pudo guardar la venta.");
    } finally {
      setGuardando(false);
    }
  };

  /* Facturar */
  const [facturarFila, setFacturarFila] = useState<VentaConCliente | null>(null);
  const [factForm, setFactForm] = useState({ forma_pago: "", fecha_vencimiento: "", categoria_id: "", cuenta_id: "" });
  const [facturando, setFacturando] = useState(false);
  const facturar = async () => {
    if (!facturarFila) return;
    setFacturando(true);
    try {
      await ventasService.facturar(facturarFila.id_venta, {
        fechaVencimiento: factForm.fecha_vencimiento || undefined,
        formaPago: factForm.forma_pago || undefined,
        categoriaId: factForm.categoria_id || undefined,
        cuentaId: factForm.cuenta_id || undefined,
      });
      setFacturarFila(null);
      await cargar();
    } finally {
      setFacturando(false);
    }
  };

  /* Eliminar */
  const [eliminarFila, setEliminarFila] = useState<VentaConCliente | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const eliminar = async () => {
    if (!eliminarFila) return;
    setEliminando(true);
    try {
      await ventasService.eliminar(eliminarFila.id_venta);
      setEliminarFila(null);
      await cargar();
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Ventas</h2>
        <p className="text-sm text-muted-foreground">
          Ítems con control de stock, descuento, valor total y facturación única (movimiento financiero).
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className="w-40" />
          <Input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className="w-40" />
        </div>
        {puede(["aVenta"]) && (
          <Button onClick={abrirNuevo}>
            <PlusIcon data-icon="inline-start" /> Nueva venta
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead className="text-right">Descuento</TableHead>
              <TableHead className="text-right">Valor total</TableHead>
              <TableHead>Facturada</TableHead>
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
                <TableCell colSpan={7} className="p-4 text-center text-muted-foreground">No hay ventas registradas.</TableCell>
              </TableRow>
            ) : (
              (datos?.lista ?? []).map((v) => (
                <TableRow key={v.id_venta}>
                  <TableCell>{formatoFecha(v.fecha_venta)}</TableCell>
                  <TableCell>{v.clientes?.nombre_cliente ?? nombreCliente.get(v.cliente_id ?? "") ?? "—"}</TableCell>
                  <TableCell>{v.usuarios?.nombre ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatoDinero(v.descuento)}</TableCell>
                  <TableCell className="text-right">{formatoDinero(v.valor_total)}</TableCell>
                  <TableCell>
                    <Badge variant={v.facturado ? "default" : "outline"}>{v.facturado ? "Sí" : "No"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" title="Ver detalle" onClick={() => setVerId(v.id_venta)}>
                        <SearchIcon />
                      </Button>
                      {!v.facturado && puede(["eMovimiento"]) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Facturar (crea movimiento financiero)"
                          onClick={() => {
                            setFacturarFila(v);
                            setFactForm({ forma_pago: "", fecha_vencimiento: "", categoria_id: "", cuenta_id: "" });
                          }}
                        >
                          <ReceiptIcon />
                        </Button>
                      )}
                      {puede(["eVenta"]) && (
                        <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => abrirEditar(v)}>
                          <PencilIcon />
                        </Button>
                      )}
                      {puede(["dVenta"]) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Eliminar"
                          className="text-destructive"
                          onClick={() => setEliminarFila(v)}
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
        <span>{datos?.total ?? 0} venta(s)</span>
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
            <DialogTitle>{dialogo === "nuevo" ? "Nueva venta" : "Editar venta"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label>Cliente</Label>
              <SimpleSelect
                value={form.cliente_id}
                onChange={(v) => setForm({ ...form, cliente_id: v })}
                opciones={clientes.map((c) => ({ valor: c.id_cliente, etiqueta: c.nombre_cliente }))}
                placeholder="— Seleccione —"
              />
            </div>
            <div className="space-y-1">
              <Label>Usuario</Label>
              <SimpleSelect
                value={form.usuario_id}
                onChange={(v) => setForm({ ...form, usuario_id: v })}
                opciones={usuarios.map((u) => ({ valor: u.id_usuario, etiqueta: u.nombre }))}
                placeholder="— Seleccione —"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Fecha</Label>
                <Input type="date" value={form.fecha_venta} onChange={(e) => setForm({ ...form, fecha_venta: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Descuento</Label>
                <Input type="number" step="0.01" value={form.descuento} onChange={(e) => setForm({ ...form, descuento: e.target.value })} />
              </div>
            </div>
            {dialogo === "nuevo" && (
              <p className="text-xs text-muted-foreground">
                Tras crear la venta podrá agregar ítems (productos con descuento de stock) desde «Ver detalle».
              </p>
            )}
            {errorForm && <p className="text-sm text-destructive">{errorForm}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogo(null)} disabled={guardando}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>{guardando ? "Guardando…" : "Guardar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---------------------------- Ver detalle con ítems -------------------- */}
      {verId && (
        <Dialog open onOpenChange={(o) => !o && setVerId(null)}>
          <DetalleVenta idVenta={verId} empresa={empresa} puedeEditar={puede(["eVenta"])} onCerrar={() => setVerId(null)} />
        </Dialog>
      )}

      {/* ---------------------------- Facturar ------------------------------- */}
      <ConfirmDialog
        abierto={facturarFila !== null}
        titulo="Facturar venta"
        mensaje={
          facturarFila
            ? `Se creará un movimiento financiero de ingreso por ${formatoDinero(
                Number(facturarFila.valor_total ?? 0),
              )} y la venta quedará facturada (solo se puede facturar una vez).`
            : ""
        }
        textoConfirmar="Facturar"
        ocupado={facturando}
        onCerrar={() => setFacturarFila(null)}
        onConfirmar={() => void facturar()}
      >
        <div className="-mt-2 mb-2 grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Forma de pago</Label>
            <Input value={factForm.forma_pago} onChange={(e) => setFactForm({ ...factForm, forma_pago: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Fecha de vencimiento</Label>
            <Input type="date" value={factForm.fecha_vencimiento} onChange={(e) => setFactForm({ ...factForm, fecha_vencimiento: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Categoría (ingreso)</Label>
            <SimpleSelect
              value={factForm.categoria_id}
              onChange={(v) => setFactForm({ ...factForm, categoria_id: v })}
              opciones={categorias.map((c) => ({ valor: c.id_categoria, etiqueta: c.categoria }))}
              placeholder="— Seleccione —"
            />
          </div>
          <div className="space-y-1">
            <Label>Cuenta</Label>
            <SimpleSelect
              value={factForm.cuenta_id}
              onChange={(v) => setFactForm({ ...factForm, cuenta_id: v })}
              opciones={cuentas.map((c) => ({ valor: c.id_cuenta, etiqueta: c.cuenta }))}
              placeholder="— Seleccione —"
            />
          </div>
        </div>
      </ConfirmDialog>

      {/* ---------------------------- Eliminar ------------------------------- */}
      <ConfirmDialog
        abierto={eliminarFila !== null}
        titulo="Eliminar venta"
        mensaje="¿Está seguro de que desea eliminar la venta? Los ítems dejarán la venta y el stock original permanecerá movido según las reglas de la base de datos."
        textoConfirmar="Eliminar"
        ocupado={eliminando}
        onCerrar={() => setEliminarFila(null)}
        onConfirmar={() => void eliminar()}
      />
    </div>
  );
}
