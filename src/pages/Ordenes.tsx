// ============================================================================
// Sistema Taller — Órdenes de trabajo (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §5:
//  • Estados: Presupuesto, Abierta, En Proceso, Finalizado, Cancelado,
//    Aguardando Piezas; fechas inicial/final; cliente, usuario/técnico, garantía.
//  • Descripción del producto, defecto, observaciones, laudo técnico.
//  • Agregar/quitar productos y servicios con cantidad, precio y subtotal;
//    valor total calculado en BD; el stock se mueve por RPC al mover líneas.
//  • Adjuntar archivos (nombre/miniatura/URL/ruta), enviar orden por correo al
//    cliente (cola de emails), imprimir (PDF con datos de empresa) y facturar
//    una sola vez (crea movimiento financiero y marca facturado=true).
//  • Autocompletado de clientes, productos, servicios, usuarios y garantías.
//  • Equipos intervenidos (equipos_orden: defecto declarado/encontrado/solución).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PlusIcon,
  PrinterIcon,
  SearchIcon,
  TrashIcon,
  MailIcon,
  SendIcon,
  PaperclipIcon,
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
import { Textarea } from "../components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import SimpleSelect, { type OpcionSelect } from "../components/SimpleSelect";
import ConfirmDialog from "../components/ConfirmDialog";
import { useAuth } from "../contexts/AuthContext";
import {
  catalogosService,
  clientesService,
  empresaService,
  logoComoDataUrl,
  garantiasService,
  financieroService,
  ordenesService,
  productosService,
  serviciosService,
  usuariosService,
} from "../services";
import { descargarPdf, pdfDocumento } from "../lib/pdf";
import { formatoDinero } from "../lib/dinero";
import { formatoFecha, hoyISO } from "../lib/fechas";
import { ESTADOS_ORDEN } from "../lib/types";
import type {
  Categoria,
  Cliente,
  Cuenta,
  Empresa,
  Equipo,
  EquipoOrden,
  EstadoOrden,
  Garantia,
  OrdenTrabajo,
  Producto,
  ProductoOrden,
  Servicio,
  ServicioOrden,
  Usuario,
} from "../lib/types";

type EstadoFiltro = "" | (typeof ESTADOS_ORDEN)[number];

/* -------------------------------------------------------------------------- */
/* Helpers de catálogo                                                        */
/* -------------------------------------------------------------------------- */

const opcEstado: OpcionSelect[] = ESTADOS_ORDEN.map((e) => ({ valor: e, etiqueta: e }));

/* -------------------------------------------------------------------------- */
/* Modal de detalle de la orden                                                */
/* -------------------------------------------------------------------------- */

function DetalleOrden({
  idOrden,
  empresa,
  onCerrar,
}: {
  idOrden: string;
  empresa: Empresa | null;
  onCerrar: () => void;
}) {
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null);
  const [productos, setProductos] = useState<ProductoOrden[]>([]);
  const [servicios, setServicios] = useState<ServicioOrden[]>([]);
  const [anexos, setAnexos] = useState<{ id_anexo: string; anexo: string }[]>([]);
  const [equiposOrden, setEquiposOrden] = useState<EquipoOrden[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // Autocompletado de productos (con nombre del servicio §5).
  const [busquedaProd, setBusquedaProd] = useState("");
  const [resultadosProd, setResultadosProd] = useState<Producto[]>([]);
  const [prodSel, setProdSel] = useState<Producto | null>(null);
  const [cantidadProd, setCantidadProd] = useState("1");
  const [servCatalogo, setServCatalogo] = useState<Servicio[]>([]);
  const [servSel, setServSel] = useState("");
  const [cantidadServ, setCantidadServ] = useState("1");
  const [equiposCliente, setEquiposCliente] = useState<Equipo[]>([]);
  const [equipoSel, setEquipoSel] = useState("");
  const [defectoDeclarado, setDefectoDeclarado] = useState("");
  const [correo, setCorreo] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [o, lineas, listaAnexos, listaEquipos] = await Promise.all([
        ordenesService.obtenerConDetalles(idOrden),
        ordenesService.obtenerLineas(idOrden),
        ordenesService.listarAnexos(idOrden),
        catalogosService.equiposOrden.listarDeOrden(idOrden),
      ]);
      setOrden(o);
      setProductos(lineas.productos);
      setServicios(lineas.servicios);
      setAnexos(listaAnexos.map((a) => ({ id_anexo: a.id_anexo, anexo: a.anexo })));
      setEquiposOrden(Array.isArray(listaEquipos) ? listaEquipos : (listaEquipos as any)?.datos ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la orden.");
    }
  }, [idOrden]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    serviciosService
      .listar({ tamPagina: 100, columna: "nombre", ascendente: true })
      .then((r) => setServCatalogo(r.datos))
      .catch(() => setServCatalogo([]));
  }, []);

  useEffect(() => {
    if (!orden?.cliente_id) return;
    catalogosService
      .equipos.listar(orden.cliente_id)
      .then((r) => setEquiposCliente((r as { datos?: Equipo[] })?.datos ?? []))
      .catch(() => setEquiposCliente([]));
  }, [orden?.cliente_id]);

  // Autocompletado de productos.
  useEffect(() => {
    let vigente = true;
    if (!busquedaProd.trim()) {
      setResultadosProd([]);
      return;
    }
    productosService
      .autocompletar(busquedaProd, 8)
      .then((lista) => {
        if (vigente) setResultadosProd(lista);
      })
      .catch(() => setResultadosProd([]));
    return () => {
      vigente = false;
    };
  }, [busquedaProd]);

  const correr = useCallback(
    async (fn: () => Promise<unknown>, mensajeOk: string) => {
      try {
        await fn();
        setMensaje(mensajeOk);
        await cargar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      }
    },
    [cargar],
  );

  const agregarProducto = () => {
    if (!prodSel) {
      setError("Seleccione un producto del autocompletado.");
      return;
    }
    void correr(
      () =>
        ordenesService.agregarProducto(
          idOrden,
          prodSel.id_producto,
          Number(cantidadProd || "1"),
          Number(prodSel.precio_venta ?? 0) > 0 ? Number(prodSel.precio_venta) : undefined,
        ),
      "Producto agregado: stock descontado (regla de negocio §3).",
    );
    setProdSel(null);
    setBusquedaProd("");
    setCantidadProd("1");
  };

  const agregarServicio = () => {
    const s = servCatalogo.find((x) => x.id_servicio === servSel);
    if (!s) {
      setError("Seleccione un servicio del catálogo.");
      return;
    }
    void correr(
      () => ordenesService.agregarServicio(idOrden, s, Number(cantidadServ || "1")),
      "Servicio agregado a la orden.",
    );
    setServSel("");
    setCantidadServ("1");
  };

  const agregarEquipo = () => {
    if (!equipoSel) {
      setError("Seleccione un equipo del cliente.");
      return;
    }
    void correr(
      () =>
        catalogosService.equiposOrden.agregar({
          orden_id: idOrden,
          equipo_id: equipoSel,
          defecto_declarado: defectoDeclarado || null,
        } as Omit<EquipoOrden, "id_equipo_orden"> as unknown as Omit<EquipoOrden, "id_equipo_orden">),
      "Equipo registrado en la orden.",
    );
    setEquipoSel("");
    setDefectoDeclarado("");
  };

  const imprimir = async () => {
    if (!orden) return;
    const datos = empresa
      ? {
          nombre: empresa.nombre,
          direccion: [empresa.calle, empresa.numero, empresa.barrio, empresa.ciudad, empresa.provincia]
            .filter(Boolean)
            .join(", "),
          telefono: empresa.telefono ?? undefined,
          correo: empresa.correo ?? undefined,
          logo: await logoComoDataUrl(empresa.url_logo),
        }
      : {};
    const lineas = [
      ...productos.map((p) => ({
        descripcion: p.descripcion,
        cantidad: p.cantidad,
        precio: p.precio,
        subtotal: p.subtotal,
      })),
      ...servicios.map((s) => ({
        descripcion: s.servicio,
        cantidad: s.cantidad,
        precio: s.precio,
        subtotal: s.subtotal,
      })),
    ];
    const extras = [
      `Cliente: ${orden.clientes?.nombre_cliente ?? "—"}`,
      `Técnico/usuario: ${orden.usuarios?.nombre ?? "—"}`,
      `Estado: ${orden.estado} · Facturada: ${orden.facturado ? "Sí" : "No"}`,
      `Descripción del producto: ${orden.descripcion_producto ?? "—"}`,
      `Defecto: ${orden.defecto ?? "—"}`,
      `Observaciones: ${orden.observaciones ?? "—"}`,
      `Laudo técnico: ${orden.laudo_tecnico ?? "—"}`,
      `Garantía: ${orden.garantias?.referencia ?? orden.garantia ?? "—"}`,
    ];
    const doc = pdfDocumento(
      "Orden de trabajo",
      `N.º ${orden.id_orden.slice(0, 8).toUpperCase()} · Inicio ${formatoFecha(orden.fecha_inicial)}${
        orden.fecha_final ? ` · Fin ${formatoFecha(orden.fecha_final)}` : ""
      }`,
      datos,
      extras,
      lineas,
      Number(orden.valor_total ?? 0),
    );
    descargarPdf(doc, `orden-${orden.id_orden.slice(0, 8)}.pdf`);
  };

  const totalLineas =
    productos.reduce((a, l) => a + Number(l.subtotal ?? 0), 0) +
    servicios.reduce((a, s) => a + Number(s.subtotal ?? 0), 0);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Detalle de la orden</DialogTitle>
      </DialogHeader>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {mensaje && <p className="text-sm text-emerald-700">{mensaje}</p>}

      {!orden ? (
        <p className="text-sm text-muted-foreground">Cargando orden…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">{orden.estado}</Badge>
            <Badge variant={orden.facturado ? "default" : "secondary"}>
              {orden.facturado ? "Facturada" : "Sin facturar"}
            </Badge>
            <span className="text-muted-foreground">
              Inicio {formatoFecha(orden.fecha_inicial)}
              {orden.fecha_final ? ` · Fin ${formatoFecha(orden.fecha_final)}` : ""}
            </span>
            <Button variant="outline" size="sm" className="ml-auto" onClick={imprimir}>
              <PrinterIcon data-icon="inline-start" />
              Imprimir
            </Button>
          </div>

          <div className="grid gap-1 text-sm sm:grid-cols-2">
            <p><span className="font-medium">Cliente:</span> {orden.clientes?.nombre_cliente ?? "—"}</p>
            <p><span className="font-medium">Técnico/usuario:</span> {orden.usuarios?.nombre ?? "—"}</p>
            <p><span className="font-medium">Descripción del producto:</span> {orden.descripcion_producto ?? "—"}</p>
            <p><span className="font-medium">Defecto:</span> {orden.defecto ?? "—"}</p>
            <p className="sm:col-span-2"><span className="font-medium">Observaciones:</span> {orden.observaciones ?? "—"}</p>
            <p className="sm:col-span-2"><span className="font-medium">Laudo técnico:</span> {orden.laudo_tecnico ?? "—"}</p>
            <p className="sm:col-span-2">
              <span className="font-medium">Garantía:</span>{" "}
              {orden.garantias?.referencia
                ? `${orden.garantias.referencia} — ${orden.garantias.texto_garantia ?? ""}`
                : orden.garantia || "—"}
            </p>
          </div>

          {/* Productos de la orden (stock se descuenta al agregar) */}
          <div className="rounded-xl border p-3">
            <h4 className="mb-2 text-sm font-semibold">Productos</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cant.</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Quitar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productos.map((p) => (
                  <TableRow key={p.id_producto_orden}>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        className="h-7 w-16"
                        defaultValue={String(p.cantidad)}
                        onBlur={(e) => {
                          const nueva = Number(e.target.value);
                          if (nueva > 0 && nueva !== p.cantidad)
                            void correr(
                              () => ordenesService.cambiarCantidadProducto(p.id_producto_orden, nueva),
                              "Cantidad actualizada (stock ajustado).",
                            );
                        }}
                      />
                    </TableCell>
                    <TableCell>{p.descripcion}</TableCell>
                    <TableCell className="text-right">{formatoDinero(p.precio)}</TableCell>
                    <TableCell className="text-right">{formatoDinero(p.subtotal)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Quitar (devuelve stock)"
                        className="text-destructive"
                        onClick={() =>
                          void correr(
                            () => ordenesService.quitarProducto(p.id_producto_orden),
                            "Producto quitado: stock devuelto.",
                          )
                        }
                      >
                        <TrashIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {productos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Sin productos en la orden.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div className="relative min-w-48 flex-1">
                <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Buscar producto (autocompletado)…"
                  value={prodSel ? prodSel.descripcion : busquedaProd}
                  onChange={(e) => {
                    setProdSel(null);
                    setBusquedaProd(e.target.value);
                  }}
                />
                {!prodSel && resultadosProd.length > 0 && (
                  <ul className="absolute z-10 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border bg-popover shadow-md">
                    {resultadosProd.map((p) => (
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
              <Input
                type="number"
                min="1"
                className="w-20"
                value={cantidadProd}
                onChange={(e) => setCantidadProd(e.target.value)}
                title="Cantidad"
              />
              <Button size="sm" onClick={agregarProducto}>
                <PlusIcon data-icon="inline-start" /> Agregar
              </Button>
            </div>
          </div>

          {/* Servicios de la orden */}
          <div className="rounded-xl border p-3">
            <h4 className="mb-2 text-sm font-semibold">Servicios</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cant.</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">Quitar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicios.map((s) => (
                  <TableRow key={s.id_servicio_orden}>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        className="h-7 w-16"
                        defaultValue={String(s.cantidad)}
                        onBlur={(e) => {
                          const nueva = Number(e.target.value);
                          if (nueva > 0 && nueva !== s.cantidad)
                            void correr(
                              () => ordenesService.cambiarCantidadServicio(s.id_servicio_orden, nueva),
                              "Cantidad actualizada.",
                            );
                        }}
                      />
                    </TableCell>
                    <TableCell>{s.servicio}</TableCell>
                    <TableCell className="text-right">{formatoDinero(s.precio)}</TableCell>
                    <TableCell className="text-right">{formatoDinero(s.subtotal)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        title="Quitar"
                        onClick={() =>
                          void correr(
                            () => ordenesService.quitarServicio(s.id_servicio_orden),
                            "Servicio quitado de la orden.",
                          )
                        }
                      >
                        <TrashIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {servicios.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Sin servicios en la orden.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <SimpleSelect
                className="min-w-48 flex-1"
                value={servSel}
                onChange={setServSel}
                opciones={servCatalogo.map((s) => ({
                  valor: s.id_servicio,
                  etiqueta: `${s.nombre} — ${formatoDinero(Number(s.precio ?? 0))}`,
                }))}
                placeholder="Seleccione un servicio…"
              />
              <Input
                type="number"
                min="1"
                className="w-20"
                value={cantidadServ}
                onChange={(e) => setCantidadServ(e.target.value)}
                title="Cantidad"
              />
              <Button size="sm" onClick={agregarServicio}>
                <PlusIcon data-icon="inline-start" /> Agregar
              </Button>
            </div>
          </div>

          {/* Equipos intervenidos */}
          <div className="rounded-xl border p-3">
            <h4 className="mb-2 text-sm font-semibold">Equipos de la orden</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Defecto declarado</TableHead>
                  <TableHead className="text-right">Quitar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equiposOrden.map((eo) => (
                  <TableRow key={eo.id_equipo_orden}>
                    <TableCell className="font-mono text-xs">{String(eo.equipo_id).slice(0, 8)}</TableCell>
                    <TableCell>{eo.defecto_declarado ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        title="Quitar"
                        onClick={() =>
                          void correr(
                            () => catalogosService.equiposOrden.quitar(eo.id_equipo_orden),
                            "Equipo quitado de la orden.",
                          )
                        }
                      >
                        <TrashIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {equiposOrden.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Sin equipos registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <SimpleSelect
                className="min-w-48 flex-1"
                value={equipoSel}
                onChange={setEquipoSel}
                opciones={equiposCliente.map((e2) => ({
                  valor: e2.id_equipo,
                  etiqueta: `${e2.equipo}${e2.numero_serie ? ` (S/N ${String(e2.numero_serie)})` : ""}`,
                }))}
                placeholder="Equipo del cliente…"
              />
              <Input
                className="min-w-40 flex-1"
                placeholder="Defecto declarado"
                value={defectoDeclarado}
                onChange={(e) => setDefectoDeclarado(e.target.value)}
              />
              <Button size="sm" onClick={agregarEquipo}>
                <PlusIcon data-icon="inline-start" /> Agregar
              </Button>
            </div>
          </div>

          {/* Adjuntos + envío por correo */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-3">
              <h4 className="mb-2 text-sm font-semibold">
                <PaperclipIcon className="mr-1 inline size-4" /> Anexos ({anexos.length})
              </h4>
              <ul className="mb-2 list-disc pl-5 text-xs text-muted-foreground">
                {anexos.map((a) => (
                  <li key={a.id_anexo}>{a.anexo}</li>
                ))}
                {anexos.length === 0 && <li>Sin archivos adjuntos.</li>}
              </ul>
              <Input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void correr(() => ordenesService.adjuntarAnexo(idOrden, f), "Archivo adjuntado a la orden.");
                  e.target.value = "";
                }}
              />
            </div>
            <div className="rounded-xl border p-3">
              <h4 className="mb-2 text-sm font-semibold">
                <MailIcon className="mr-1 inline size-4" /> Enviar orden por correo al cliente
              </h4>
              <div className="flex items-end gap-2">
                <Input
                  type="email"
                  className="flex-1"
                  placeholder="correo@cliente.com"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (!correo.trim()) {
                      setError("Ingrese el correo del cliente.");
                      return;
                    }
                    void correr(
                      () => ordenesService.enviarPorCorreo(idOrden, correo.trim()),
                      "Envío encolado en la Cola de emails.",
                    );
                    setCorreo("");
                  }}
                >
                  <SendIcon className="size-3.5" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                El envío queda registrado en la Cola de emails (pendiente → enviado).
              </p>
            </div>
          </div>

          <p className="text-right text-sm">
            <span className="font-medium">Valor total: </span>
            <span className="font-bold">{formatoDinero(Number(orden.valor_total ?? 0) || totalLineas)}</span>
          </p>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCerrar}>
          Cerrar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* -------------------------------------------------------------------------- */
/* Pantalla principal de órdenes                                              */
/* -------------------------------------------------------------------------- */

interface FormOrden {
  cliente_id: string;
  usuario_id: string;
  garantia_id: string;
  estado: EstadoOrden;
  fecha_inicial: string;
  fecha_final: string;
  descripcion_producto: string;
  defecto: string;
  observaciones: string;
  laudo_tecnico: string;
  garantia: string;
}

const FORM_VACIO: FormOrden = {
  cliente_id: "",
  usuario_id: "",
  garantia_id: "",
  estado: "Presupuesto",
  fecha_inicial: "",
  fecha_final: "",
  descripcion_producto: "",
  defecto: "",
  observaciones: "",
  laudo_tecnico: "",
  garantia: "",
};

type OrdenConCliente = OrdenTrabajo & { clientes?: { nombre_cliente: string } | null };

export default function Ordenes() {
  const { puede } = useAuth();

  // Catálogos para autocompletados (clientes, usuarios, garantías, dinero/fx).
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [garantias, setGarantias] = useState<Garantia[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  useEffect(() => {
    const una = <T,>(p: Promise<{ datos: T[] }>, set: (v: T[]) => void) =>
      p.then((r) => set(r.datos)).catch(() => set([]));
    una<Cliente>(clientesService.listar({ tamPagina: 200, columna: "nombre_cliente", ascendente: true }), setClientes);
    una<Usuario>(usuariosService.listar({ tamPagina: 200, columna: "nombre", ascendente: true }), setUsuarios);
    una<Garantia>(garantiasService.listar({ tamPagina: 200, columna: "referencia", ascendente: true }), setGarantias);
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

  // Listado con filtro de estado.
  const [estado, setEstado] = useState< EstadoFiltro >("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<{ lista: OrdenConCliente[]; total: number; paginas: number } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await ordenesService.listarFiltradas({
        estado: estado || undefined,
        pagina,
        tamPagina: 10,
      });
      setDatos({ lista: res.datos as unknown as OrdenConCliente[], total: res.total, paginas: res.paginas });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las órdenes.");
    } finally {
      setCargando(false);
    }
  }, [estado, pagina]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    catalogosService.marcas
      .listar({ tamPagina: 200, columna: "marca", ascendente: true })
      .then((r) => setMarcas((r as any)?.datos ?? []))
      .catch(() => setMarcas([]));
  }, []);

  useEffect(() => {
    if (!form.cliente_id) {
      setEquiposClienteForm([]);
      setEquipoSelForm("");
      return;
    }
    catalogosService.equipos
      .listar(form.cliente_id)
      .then((r) => setEquiposClienteForm((r as { datos?: Equipo[] })?.datos ?? []))
      .catch(() => setEquiposClienteForm([]));
    setEquipoSelForm("");
  }, [form.cliente_id]);

  const nombreCliente = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clientes) m.set(c.id_cliente, c.nombre_cliente);
    return m;
  }, [clientes]);

  /* Diálogo de creación/edición */
  const [dialogo, setDialogo] = useState<"nuevo" | "editar" | null>(null);
  const [form, setForm] = useState<FormOrden>(FORM_VACIO);
  const [formId, setFormId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const abrirNuevo = () => {
    setForm({ ...FORM_VACIO, fecha_inicial: hoyISO() });
    setFormId(null);
    setErrorForm(null);
    setDialogo("nuevo");
  };

  const abrirEditar = (o: OrdenConCliente) => {
    setForm({
      cliente_id: o.cliente_id ?? "",
      usuario_id: o.usuario_id ?? "",
      garantia_id: o.garantia_id ?? "",
      estado: o.estado,
      fecha_inicial: o.fecha_inicial?.slice(0, 10) ?? "",
      fecha_final: o.fecha_final?.slice(0, 10) ?? "",
      descripcion_producto: o.descripcion_producto ?? "",
      defecto: o.defecto ?? "",
      observaciones: o.observaciones ?? "",
      laudo_tecnico: o.laudo_tecnico ?? "",
      garantia: o.garantia ?? "",
    });
    setFormId(o.id_orden);
    setErrorForm(null);
    setDialogo("editar");
  };

  const guardarOrden = async () => {
    if (!form.cliente_id) {
      setErrorForm("Seleccione el cliente de la orden.");
      return;
    }
    setGuardando(true);
    setErrorForm(null);
    try {
      const payload: Partial<OrdenTrabajo> = {
        cliente_id: form.cliente_id,
        usuario_id: form.usuario_id || null,
        garantia_id: form.garantia_id || null,
        garantia: form.garantia || null,
        estado: form.estado,
        fecha_inicial: form.fecha_inicial || hoyISO(),
        fecha_final: form.fecha_final || null,
        descripcion_producto: form.descripcion_producto || null,
        defecto: form.defecto || null,
        observaciones: form.observaciones || null,
        laudo_tecnico: form.laudo_tecnico || null,
      };
      if (formId) {
        await ordenesService.editar(formId, payload);
      } else {
        const nueva = await ordenesService.crear(payload);
        if (equipoSelForm) {
          await catalogosService.equiposOrden.agregar({
            orden_id: (nueva as any).id_orden,
            equipo_id: equipoSelForm,
            defecto_declarado: form.defecto || null,
          });
        }
      }
      setDialogo(null);
      setEquipoSelForm("");
      await cargar();
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "No se pudo guardar la orden.");
    } finally {
      setGuardando(false);
    }
  };

  /* Acciones */
  const [verId, setVerId] = useState<string | null>(null);
  const [eliminarFila, setEliminarFila] = useState<OrdenConCliente | null>(null);
  const [equiposClienteForm, setEquiposClienteForm] = useState<Equipo[]>([]);
  const [equipoSelForm, setEquipoSelForm] = useState("");
  const [marcas, setMarcas] = useState<any[]>([]);
  const [nuevoEquipoOpen, setNuevoEquipoOpen] = useState(false);
  const [nuevoEquipo, setNuevoEquipo] = useState({ equipo: "", marca_id: "", modelo: "", color: "", condicion: "", numero_serie: "", numero_chasis: "", numero_motor: "" });
  const [guardandoEquipo, setGuardandoEquipo] = useState(false);
  const [marcaModalOpenOrden, setMarcaModalOpenOrden] = useState(false);
  const [nuevaMarcaOrden, setNuevaMarcaOrden] = useState("");
  const [guardandoMarcaOrden, setGuardandoMarcaOrden] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [facturarFila, setFacturarFila] = useState<OrdenConCliente | null>(null);
  const [factForm, setFactForm] = useState({ forma_pago: "", fecha_vencimiento: "", categoria_id: "", cuenta_id: "" });
  const [facturando, setFacturando] = useState(false);

  const facturar = async () => {
    if (!facturarFila) return;
    setFacturando(true);
    try {
      await ordenesService.facturar(facturarFila.id_orden, {
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

  const eliminar = async () => {
    if (!eliminarFila) return;
    setEliminando(true);
    try {
      await ordenesService.eliminar(eliminarFila.id_orden);
      setEliminarFila(null);
      await cargar();
    } finally {
      setEliminando(false);
    }
  };

  const cabeFacturar = (o: OrdenConCliente): boolean => !o.facturado && puede(["eMovimiento"]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Órdenes de trabajo</h2>
        <p className="text-sm text-muted-foreground">
          Estados del prompt con productos/servicios, stock automático, adjuntos, correo, impresión y facturación única.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <SimpleSelect
            value={estado}
            onChange={(v) => {
              setEstado(v as EstadoFiltro);
              setPagina(1);
            }}
            opciones={[{ valor: "", etiqueta: "Todos los estados" }, ...opcEstado]}
            className="w-56"
          />
        </div>
        {puede(["aOrden"]) && (
          <Button onClick={abrirNuevo}>
            <PlusIcon data-icon="inline-start" /> Nueva orden
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>N.º</TableHead>
              <TableHead>Fecha inicial</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Valor total</TableHead>
              <TableHead>Facturado</TableHead>
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
                <TableCell colSpan={7} className="p-4 text-center text-muted-foreground">No hay órdenes registradas.</TableCell>
              </TableRow>
            ) : (
              (datos?.lista ?? []).map((o) => (
                <TableRow key={o.id_orden}>
                  <TableCell className="font-mono text-xs">{o.id_orden.slice(0, 8).toUpperCase()}</TableCell>
                  <TableCell>{formatoFecha(o.fecha_inicial)}</TableCell>
                  <TableCell>{nombreCliente.get(o.cliente_id ?? "") ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{o.estado}</Badge></TableCell>
                  <TableCell className="text-right">{formatoDinero(o.valor_total)}</TableCell>
                  <TableCell>{o.facturado ? "Sí" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" title="Ver detalle" onClick={() => setVerId(o.id_orden)}>
                        <SearchIcon />
                      </Button>
                      {cabeFacturar(o) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Facturar (crea movimiento financiero)"
                          onClick={() => {
                            setFacturarFila(o);
                            setFactForm({ forma_pago: "", fecha_vencimiento: "", categoria_id: "", cuenta_id: "" });
                          }}
                        >
                          <ReceiptIcon />
                        </Button>
                      )}
                      {puede(["eOrden"]) && (
                        <Button variant="ghost" size="icon-sm" title="Editar" onClick={() => abrirEditar(o)}>
                          <PencilIcon />
                        </Button>
                      )}
                      {puede(["dOrden"]) && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Eliminar"
                          className="text-destructive"
                          onClick={() => setEliminarFila(o)}
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
        <span>{datos?.total ?? 0} orden(es)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
            Anterior
          </Button>
          <span>Página {pagina} de {datos?.paginas ?? 1}</span>
          <Button variant="outline" size="sm" disabled={pagina >= (datos?.paginas ?? 1)} onClick={() => setPagina(pagina + 1)}>
            Siguiente
          </Button>
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
            <DialogTitle>{dialogo === "nuevo" ? "Nueva orden de trabajo" : "Editar orden de trabajo"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void guardarOrden();
            }}
            className="space-y-3"
          >
            <div className="space-y-1">
              <Label>Cliente *</Label>
              <SimpleSelect
                value={form.cliente_id}
                onChange={(v) => setForm({ ...form, cliente_id: v })}
                opciones={clientes.map((c) => ({
                  valor: c.id_cliente,
                  etiqueta: `${c.nombre_cliente} (${c.documento ?? "—"})`,
                }))}
                placeholder="Autocompletado de clientes…"
              />
            </div>
            <div className="space-y-1">
              <Label>Equipo a revisar</Label>
              <div className="flex gap-2">
                <SimpleSelect
                  value={equipoSelForm}
                  onChange={setEquipoSelForm}
                  opciones={equiposClienteForm.map((e) => ({
                    valor: e.id_equipo,
                    etiqueta: `${e.equipo ?? "Equipo"} · ${e.modelo ?? "—"} · ${e.color ?? "—"} · Serie: ${e.numero_serie ?? "—"} · Chasis: ${e.numero_chasis ?? "—"}`,
                  }))}
                  placeholder={form.cliente_id ? "Seleccione un equipo…" : "Seleccione primero un cliente"}
                  disabled={!form.cliente_id}
                />
                <Button type="button" variant="outline" onClick={() => setNuevoEquipoOpen(true)} disabled={!form.cliente_id}>
                  + Cargar nuevo equipo
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Usuario/Técnico</Label>
                <SimpleSelect
                  value={form.usuario_id}
                  onChange={(v) => setForm({ ...form, usuario_id: v })}
                  opciones={usuarios.map((u) => ({ valor: u.id_usuario, etiqueta: u.nombre }))}
                  placeholder="— Seleccione —"
                />
              </div>
              <div className="space-y-1">
                <Label>Estado</Label>
                <SimpleSelect
                  value={form.estado}
                  onChange={(v) => setForm({ ...form, estado: v as EstadoOrden })}
                  opciones={opcEstado}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Al pasar a «Finalizado» la fecha final se registra automáticamente (regla en base de datos).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Fecha inicial</Label>
                <Input type="date" value={form.fecha_inicial} onChange={(e) => setForm({ ...form, fecha_inicial: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Fecha final</Label>
                <Input type="date" value={form.fecha_final} onChange={(e) => setForm({ ...form, fecha_final: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Descripción del producto</Label>
              <Input value={form.descripcion_producto} onChange={(e) => setForm({ ...form, descripcion_producto: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Defecto</Label>
              <Textarea rows={2} value={form.defecto} onChange={(e) => setForm({ ...form, defecto: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Observaciones</Label>
              <Textarea rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Laudo técnico</Label>
              <Textarea rows={2} value={form.laudo_tecnico} onChange={(e) => setForm({ ...form, laudo_tecnico: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Término de garantía</Label>
                <SimpleSelect
                  value={form.garantia_id}
                  onChange={(v) => setForm({ ...form, garantia_id: v })}
                  opciones={garantias.map((g) => ({ valor: g.id_garantia, etiqueta: g.referencia ?? "" }))}
                  placeholder="— Garantía —"
                />
              </div>
              <div className="space-y-1">
                <Label>Término manual (texto)</Label>
                <Input value={form.garantia} onChange={(e) => setForm({ ...form, garantia: e.target.value })} />
              </div>
            </div>
            {errorForm && <p className="text-sm text-destructive">{errorForm}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogo(null)} disabled={guardando}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? "Guardando…" : "Confirmar cambios"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --------------------------- Facturar ---------------------------- */}
      <ConfirmDialog
        abierto={facturarFila !== null}
        titulo="Facturar orden"
        mensaje={
          facturarFila
            ? `Se creará un movimiento financiero de ingreso por ${formatoDinero(
                Number(facturarFila.valor_total ?? 0),
              )} y la orden quedará marcada como facturada (solo se puede facturar una vez).`
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
            <Input
              type="date"
              value={factForm.fecha_vencimiento}
              onChange={(e) => setFactForm({ ...factForm, fecha_vencimiento: e.target.value })}
            />
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

      {/* --------------------------- Eliminar ---------------------------- */}
      <ConfirmDialog
        abierto={eliminarFila !== null}
        titulo="Eliminar orden"
        mensaje="¿Está seguro de que desea eliminar la orden de trabajo? Esta acción no se puede deshacer."
        textoConfirmar="Eliminar"
        ocupado={eliminando}
        onCerrar={() => setEliminarFila(null)}
        onConfirmar={() => void eliminar()}
      />

      {/* --------------------------- Ver detalle ------------------------- */}
      {verId && <Dialog open onOpenChange={(o) => !o && setVerId(null)}><DetalleOrden idOrden={verId} empresa={empresa} onCerrar={() => setVerId(null)} /></Dialog>}

      <Dialog open={nuevoEquipoOpen} onOpenChange={setNuevoEquipoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo equipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Equipo</Label>
              <Input value={nuevoEquipo.equipo} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, equipo: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Marca</Label>
              <div className="flex gap-2">
                <SimpleSelect
                  value={nuevoEquipo.marca_id}
                  onChange={(v) => setNuevoEquipo({ ...nuevoEquipo, marca_id: v })}
                  opciones={marcas.map((m) => ({ valor: m.id_marca, etiqueta: m.marca }))}
                  placeholder="— Seleccione —"
                />
                <Button type="button" variant="outline" size="sm" onClick={() => setMarcaModalOpenOrden(true)}>+ Agregar marca</Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Modelo</Label>
                <Input value={nuevoEquipo.modelo} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, modelo: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Color</Label>
                <Input value={nuevoEquipo.color} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, color: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Condición</Label>
              <SimpleSelect
                value={nuevoEquipo.condicion}
                onChange={(v) => setNuevoEquipo({ ...nuevoEquipo, condicion: v })}
                opciones={[
                  { valor: "Nuevo", etiqueta: "Nuevo" },
                  { valor: "Usado", etiqueta: "Usado" },
                  { valor: "Buen estado", etiqueta: "Buen estado" },
                  { valor: "Regular", etiqueta: "Regular" },
                  { valor: "Dañado", etiqueta: "Dañado" },
                  { valor: "Fuera de servicio", etiqueta: "Fuera de servicio" },
                ]}
                placeholder="— Seleccione —"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Número de serie</Label>
                <Input value={nuevoEquipo.numero_serie} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, numero_serie: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Número de chasis</Label>
                <Input value={nuevoEquipo.numero_chasis} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, numero_chasis: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Número de motor</Label>
              <Input value={nuevoEquipo.numero_motor} onChange={(e) => setNuevoEquipo({ ...nuevoEquipo, numero_motor: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNuevoEquipoOpen(false)} disabled={guardandoEquipo}>Cancelar</Button>
              <Button
                type="button"
                disabled={guardandoEquipo || !nuevoEquipo.equipo.trim()}
                onClick={async () => {
                  setGuardandoEquipo(true);
                  try {
                    const creado = await catalogosService.equipos.crear({
                      cliente_id: form.cliente_id,
                      equipo: nuevoEquipo.equipo,
                      marca_id: nuevoEquipo.marca_id || null,
                      modelo: nuevoEquipo.modelo || null,
                      color: nuevoEquipo.color || null,
                      condicion: nuevoEquipo.condicion || null,
                      numero_serie: nuevoEquipo.numero_serie || null,
                      numero_chasis: nuevoEquipo.numero_chasis || null,
                      numero_motor: nuevoEquipo.numero_motor || null,
                    });
                    setEquiposClienteForm((prev) => [creado as Equipo, ...prev]);
                    setEquipoSelForm((creado as Equipo).id_equipo);
                    setNuevoEquipoOpen(false);
                    setNuevoEquipo({ equipo: "", marca_id: "", modelo: "", color: "", condicion: "", numero_serie: "", numero_chasis: "", numero_motor: "" });
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "No se pudo guardar el equipo.");
                  } finally {
                    setGuardandoEquipo(false);
                  }
                }}
              >
                {guardandoEquipo ? "Guardando…" : "Guardar equipo"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={marcaModalOpenOrden} onOpenChange={setMarcaModalOpenOrden}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva marca</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={nuevaMarcaOrden} onChange={(e) => setNuevaMarcaOrden(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMarcaModalOpenOrden(false)} disabled={guardandoMarcaOrden}>Cancelar</Button>
              <Button
                type="button"
                disabled={guardandoMarcaOrden || !nuevaMarcaOrden.trim()}
                onClick={async () => {
                  setGuardandoMarcaOrden(true);
                  try {
                    const creada = await catalogosService.marcas.crear({ marca: nuevaMarcaOrden });
                    setMarcas((prev) => [...prev, creada as any]);
                    setNuevoEquipo((prev) => ({ ...prev, marca_id: (creada as any).id_marca }));
                    setMarcaModalOpenOrden(false);
                    setNuevaMarcaOrden("");
                  } catch (e) {
                    alert(e instanceof Error ? e.message : "No se pudo guardar la marca.");
                  } finally {
                    setGuardandoMarcaOrden(false);
                  }
                }}
              >
                {guardandoMarcaOrden ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
