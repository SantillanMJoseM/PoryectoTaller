// ============================================================================
// Sistema Taller — Órdenes de trabajo (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §5:
//  • Estados: Presupuesto, Abierta, En Proceso, Finalizado, Cancelado,
//    Aguardando Piezas; fechas inicial/final; cliente, usuario/técnico, garantía.
//  • Descripción del producto, defecto, observaciones, laudo técnico.
//  • Agregar/quitar productos y servicios con cantidad, precio y subtotal;
//    valor total calculado (trigger en BD; el stock se mueve por RPC).
//  • Adjuntar archivos (miniatura/URL/ruta), enviar por correo, imprimir
//    (PDF con datos de empresa) y facturar ×1 vez (movimiento financiero).
//  • Autocompletado de clientes, productos, servicios, usuarios y garantías.
//  • Equipos intervenidos (equipos_orden: defecto declarado/encontrado/solución).
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { PlusIcon, PrinterIcon, SearchIcon, TrashIcon, XIcon, PaperclipIcon, MailIcon } from "lucide-react";
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
  ordenesService,
  usuariosService,
  serviciosService,
  garantiasService,
  financieroService,
} from "../services";
import { descargarPdf, pdfDocumento } from "../lib/pdf";
import { formatoDinero } from "../lib/dinero";
import { formatoFecha, hoyISO } from "../lib/fechas";
import { ESTADOS_ORDEN, type ArticleOS } from "./tipos-ordenes";
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

type OrdenConCliente = OrdenTrabajo & { clientes?: Pick<Cliente, "nombre_cliente" | "correo"> | null };

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

const opcCliente = (lista: Cliente[]): OpcionSelect[] =>
  lista.map((c) => ({ valor: c.id_cliente, etiqueta: `${c.nombre_cliente}${c.documento ? ` (${c.documento})` : ""}` }));
const opcUsuario = (lista: Usuario[]): OpcionSelect[] => lista.map((u) => ({ valor: u.id_usuario, etiqueta: u.nombre }));
const opcGarantia = (lista: Garantia[]): OpcionSelect[] => lista.map((g) => ({ valor: g.id_garantia, etiqueta: g.referencia ?? "" }));
const opcEstado = ESTADOS_ORDEN.map((e) => ({ valor: e, etiqueta: e }));

/* -------------------------------------------------------------------------- */
/* Detalle de orden (modal): líneas, anexos, equipos, correo e impresión       */
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
  const [anexos, setAnexos] = useState<string[]>([]);
  const [equipos, setEquipos] = useState<EquipoOrden[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  // autocompletados
  const [busquedaProd, setBusquedaProd] = useState("");
  const [resultadosProd, setResultadosProd] = useState<Producto[]>([]);
  const [cantidadProd, setCantidadProd] = useState("1");
  const [prodSel, setProdSel] = useState<Producto | null>(null);
  const [serviciosCatalogo, setServiciosCatalogo] = useState<Servicio[]>([]);
  const [servSel, setServSel] = useState("");
  const [cantidadServ, setCantidadServ] = useState("1");
  const [equiposDisponibles, setEquiposDisponibles] = useState<Equipo[]>([]);
  const [equipoSel, setEquipoSel] = useState("");
  const [defectoDeclarado, setDefectoDeclarado] = useState("");
  const [correoEnviar, setCorreoEnviar] = useState("");

  const cargar = useCallback(async () => {
    try {
      const o = await ordenesService.obtenerConDetalles(idOrden);
      const lineas = await ordenesService.obtenerLineas(idOrden);
      const listaAnexos = await ordenesService.listarAnexos(idOrden);
      setOrden(o);
      setProductos(lineas.productos);
      setServicios(lineas.servicios);
      setAnexos(listaAnexos.map((a) => a.anexo));
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
      .then((r) => setServiciosCatalogo(r.datos))
      .catch(() => setServiciosCatalogo([]));
  }, []);

  useEffect(() => {
    catalogosService
      .equiposOrden.listarDeOrden(idOrden)
      .then(setEquipos)
      .catch(() => setEquipos([]));
  }, [idOrden]);

  useEffect(() => {
    if (!orden?.cliente_id) return;
    catalogosService
      .equipos.listar(orden.cliente_id)
      .then(setEquiposDisponibles)
      .catch(() => setEquiposDisponibles([]));
  }, [orden?.cliente_id]);

  useState(orden ? String(orden.clientes?.correo ?? "") : "");

  // Autocompletado de productos (búsqueda con estado controlado).
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

  const lineaTotal =
    productos.reduce((a, l) => a + Number(l.subtotal ?? 0), 0) +
    servicios.reduce((a, s) => a + Number(s.subtotal ?? 0), 0);

  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMensaje(ok);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
    }
  };

  const agregarProducto = () => {
    if (!prodSel) return setError("Seleccione un producto del autocompletado.");
    void accion(
      () =>
        ordenesService.agregarProducto(
          idOrden,
          prodSel.id_producto,
          Number(cantidadProd || "1"),
          Number(prodSel.precio_venta ?? 0) || undefined,
        ),
      "Producto agregado; stock descontado.",
    );
    setProdSel(null);
    setBusquedaProd("");
    setCantidadProd("1");
  };

  const agregarServicio = () => {
    const s = serviciosCatalogo.find((x) => x.id_servicio === servSel);
    if (!s) return setError("Seleccione un servicio del catálogo.");
    void accion(
      () => ordenesService.agregarServicio(idOrden, s, Number(cantidadServ || "1")),
      "Servicio agregado.",
    );
    setServSel("");
    setCantidadServ("1");
  };

  const agregarEquipo = () => {
    if (!equipoSel) return setError("Seleccione un equipo del cliente.");
    void accion(
      () =>
        equiposOrdenPut({
          orden_id: idOrden,
          equipo_id: equipoSel,
          defecto_declarado: defectoDeclarado || null,
        }),
      "Equipo registrado en la orden.",
    );
    setEquipoSel("");
    setDefectoDeclarado("");
  };

  const imprimir = () => {
    if (!orden) return;
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
    const lineas = [
      ...productos.map((p) => ({ descripcion: p.descripcion, cantidad: p.cantidad, precio: p.precio, subtotal: p.subtotal })),
      ...servicios.map((s) => ({ descripcion: s.servicio, cantidad: s.cantidad, precio: s.precio, subtotal: s.subtotal })),
    ];
    const extras = [
      `Cliente: ${orden.clientes?.nombre_cliente ?? "—"}`,
      `Técnico: ${orden.usuarios?.nombre ?? "—"}`,
      `Estado: ${orden.estado} · Facturada: ${orden.facturado ? "Sí" : "No"}`,
      `Producto/descripción: ${orden.descripcion_producto ?? "—"}`,
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
      Number(orden.valor_total ?? lineaTotal),
    );
    descargarPdf(doc, `orden-${orden.id_orden.slice(0, 8)}.pdf`);
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Orden de trabajo</DialogTitle>
      </DialogHeader>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {mensaje && <p className="text-sm text-emerald-700">{mensaje}</p>}

      {orden && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setDetalleAbierta("correo")}
            className="hidden"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">{orden.estado}</Badge>
            <Badge variant={orden.facturado ? "default" : "secondary"}>
              {orden.facturado ? "Facturada" : "Sin facturar"}
            </Badge>
            <span className="text-muted-foreground">
              Inicio {formatoFecha(orden.fecha_inicial)}
              {orden.fecha_final ? ` · Fin ${formatoFecha(orden.fecha_final)}` : ""}
            </span>
            <Button variant="outline" size="sm" onClick={imprimir} className="ml-auto">
              <PrinterIcon data-icon="inline-start" />
              Imprimir
            </Button>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="font-medium">Cliente:</span> {orden.clientes?.nombre_cliente ?? "—"}</p>
            <p><span className="font-medium">Técnico:</span> {orden.usuarios?.nombre ?? "—"}</p>
            <p><span className="font-medium">Descripción del producto:</span> {orden.descripcion_producto ?? "—"}</p>
            <p><span className="font-medium">Defecto:</span> {orden.defecto ?? "—"}</p>
            <p className="sm:col-span-2"><span className="font-medium">Observaciones:</span> {orden.observaciones ?? "—"}</p>
            <p className="sm:col-span-2"><span className="font-medium">Laudo técnico:</span> {orden.laudo_tecnico ?? "—"}</p>
            <p className="sm:col-span-2">
              <span className="font-medium">Garantía:</span>{" "}
              {orden.garantias?.referencia ? `${orden.garantias.referencia} — ${orden.garantias.texto_garantia ?? ""}` : "—"}
            </p>
          </div>

          {/* Líneas de producto */}
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
                            void accion(() => ordenesService.cambiarCantidadProducto(p.id_producto_orden, nueva), "Cantidad actualizada.");
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
                        onClick={() => void accion(() => ordenesService.quitarProducto(p.id_producto_orden), "Producto quitado; stock devuelto.")}
                      >
                        <TrashIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {productos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Sin productos.</TableCell>
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
                {resultadosProd.length > 0 && !prodSel && (
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
              <Input type="number" min="1" className="w-20" value={cantidadProd} onChange={(e) => setCantidadProd(e.target.value)} />
              <Button size="sm" onClick={agregarProducto}>
                <PlusIcon data-icon="inline-start" /> Agregar
              </Button>
            </div>
          </div>

          {/* Líneas de servicio */}
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
                            void accion(() => ordenesService.cambiarCantidadServicio(s.id_servicio_orden, nueva), "Cantidad actualizada.");
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
                        title="Quitar"
                        className="text-destructive"
                        onClick={() => void accion(() => ordenesService.quitarServicio(s.id_servicio_orden), "Servicio quitado.")}
                      >
                        <TrashIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {servicios.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">Sin servicios.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <SimpleSelect
                className="min-w-48 flex-1"
                value={servSel}
                onChange={setServSel}
                opciones={serviciosCatalogo.map((s) => ({ valor: s.id_servicio, etiqueta: `${s.nombre} — ${formatoDinero(Number(s.precio ?? 0))}` }))}
                placeholder="Seleccione un servicio…"
              />
              <Input type="number" min="1" className="w-20" value={cantidadServ} onChange={(e) => setCantidadServ(e.target.value)} />
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
                  <TableHead>Equipo</TableHead>
                  <TableHead>Defecto</TableHead>
                  <TableHead className="text-right">Quitar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipos.map((eo) => (
                  <TableRow key={eo.id_equipo_orden}>
                    <TableCell>{String(eo.equipo_id)}</TableCell>
                    <TableCell>{eo.defecto_declarado ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        onClick={() => void accion(() => catalogosService.equiposOrden.quitar(eo.id_equipo_orden), "Equipo quitado.")}
                      >
                        <TrashIcon />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {equipos.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">Sin equipos registrados.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <SimpleSelect
                className="min-w-48 flex-1"
                value={equipoSel}
                onChange={setEquipoSel}
                opciones={equiposDisponibles.map((e2) => ({ valor: e2.id_equipo, etiqueta: `${e2.equipo}${e2.numero_serie ? ` (S/N ${e2.numero_serie})` : ""}` }))}
                placeholder="Equipo del cliente…"
              />
              <Input className="min-w-40 flex-1" placeholder="Defecto declarado" value={defectoDeclarado} onChange={(e) => setDefectoDeclarado(e.target.value)} />
              <Button size="sm" onClick={agregarEquipo}>
                <PlusIcon data-icon="inline-start" /> Agregar
              </Button>
            </div>
          </div>

          {/* Anexos y correo */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-3">
              <h4 className="mb-2 text-sm font-semibold"><PaperclipIcon className="mr-1 inline size-4" /> Adjuntos ({anexos.length})</h4>
              <ul className="mb-2 list-disc pl-5 text-xs text-muted-foreground">
                {anexos.map((a) => <li key={a}>{a}</li>)}
                {anexos.length === 0 && <li>Sin archivos adjuntos.</li>}
              </ul>
              <Input
                type="file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void accion(() => ordenesService.adjuntarAnexo(idOrden, f), "Archivo adjuntado.");
                  e.target.value = "";
                }}
              />
            </div>
            <div className="rounded-xl border p-3">
              <h4 className="mb-2 text-sm font-semibold"><MailIcon className="mr-1 inline size-4" /> Enviar por correo al cliente</h4>
              <div className="flex items-end gap-2">
                <Input
                  type="email"
                  className="flex-1"
                  placeholder="correo@cliente.com"
                  value={correoEnviar}
                  onChange={(e) => setCorreoEnviar(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (!correoEnviar.trim()) return setError("Ingrese el correo del cliente.");
                    void accion(() => ordenesService.enviarPorCorreo(idOrden, correoEnviar.trim()), "Orden encolada en la cola de emails.");
                    setCorreoEnviar("");
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
            <span className="font-bold">{formatoDinero(orden.valor_total ?? lineaTotal)}</span>
          </p>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={onCerrar}>Cerrar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
