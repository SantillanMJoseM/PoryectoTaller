// ============================================================================
// Sistema Taller — Portal del cliente (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §15: ingreso por correo electrónico + documento del cliente
// (si coinciden con un cliente registrado se crea sesión de cliente, 24 h con
// expiración); panel con últimas compras y órdenes; ver detalle de orden y
// compra; imprimir orden/compra (PDF con datos de la empresa); ver y editar
// datos de cuenta (sin posibilidad de cambiar correo/documento); cerrar sesión.
// El portal es una zona pública separada del panel administrativo.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { PrinterIcon, BriefcaseIcon, ReceiptIcon, UserIcon } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
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
import { empresaService, portalService } from "../services";
import { descargarPdf, pdfDocumento, type DatosEmpresaPdf } from "../lib/pdf";
import { formatoDinero } from "../lib/dinero";
import { formatoFecha } from "../lib/fechas";
import type {
  Cliente,
  DatosEmpresa,
  Empresa,
  ItemVenta,
  OrdenTrabajo,
  ProductoOrden,
  ServicioOrden,
  Venta,
} from "../lib/types";

type DetalleOrden = { orden: OrdenTrabajo; productos: ProductoOrden[]; servicios: ServicioOrden[] };
type DetalleCompra = { venta: Venta; items: ItemVenta[] };

type Pestana = "ordenes" | "compras" | "cuenta";

/* -------------------------------------------------------------------------- */
/* Acceso del cliente: correo + documento                                     */
/* -------------------------------------------------------------------------- */

function AccesoPortal() {
  const [correo, setCorreo] = useState("");
  const [documento, setDocumento] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const ingresar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!correo.trim() || !documento.trim()) {
      setError("Ingrese su correo electrónico y su documento.");
      return;
    }
    setOcupado(true);
    try {
      await portalService.ingresar(correo.trim(), documento.trim());
      // Con la sesión persistente, la pantalla recarga sus datos al montar.
      window.location.reload();
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Los datos no coinciden con un cliente registrado.");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Portal del cliente</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ingrese con su correo electrónico y su documento.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={ingresar} className="space-y-3">
            <div className="space-y-1">
              <Label>Correo electrónico</Label>
              <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
            <div className="space-y-1">
              <Label>Documento</Label>
              <Input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Número de documento" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={ocupado}>
              {ocupado ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Panel del cliente                                                          */
/* -------------------------------------------------------------------------- */

function PanelPortal({ onSalir }: { onSalir: () => void }) {
  const sesion = portalService.obtenerSesion();
  const idCliente = sesion?.idCliente ?? "";

  const [pestana, setPestana] = useState<Pestana>("ordenes");
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [datos, setDatos] = useState<Cliente | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  // Detalles (modales)
  const [verOrden, setVerOrden] = useState<DetalleOrden | null>(null);
  const [verCompra, setVerCompra] = useState<DetalleCompra | null>(null);

  // Formulario de cuenta
  const [miCuenta, setMiCuenta] = useState({
    nombre_cliente: "",
    sexo: "",
    persona_fisica: "no",
    telefono: "",
    celular: "",
    calle: "",
    numero: "",
    barrio: "",
    ciudad: "",
    estado: "",
    codigo_postal: "",
  });
  const [guardando, setGuardando] = useState(false);

  const cargarTodo = useCallback(async () => {
    if (!idCliente) return;
    setCargando(true);
    setError(null);
    try {
      const [o, v, c, e] = await Promise.all([
        portalService.misOrdenes(idCliente),
        portalService.misVentas(idCliente),
        portalService.misDatos(idCliente),
        empresaService.obtener().catch(() => null),
      ]);
      setOrdenes(o);
      setVentas(v);
      setDatos(c);
      setEmpresa(e);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar sus datos.");
    } finally {
      setCargando(false);
    }
  }, [idCliente]);

  useEffect(() => {
    void cargarTodo();
  }, [cargarTodo]);

  useEffect(() => {
    if (!datos) return;
    setMiCuenta({
      nombre_cliente: datos.nombre_cliente ?? "",
      sexo: datos.sexo ?? "",
      persona_fisica: datos.persona_fisica ? "si" : "no",
      telefono: datos.telefono ?? "",
      celular: datos.celular ?? "",
      calle: datos.calle ?? "",
      numero: datos.numero ?? "",
      barrio: datos.barrio ?? "",
      ciudad: datos.ciudad ?? "",
      estado: datos.estado ?? "",
      codigo_postal: datos.codigo_postal ?? "",
    });
  }, [datos]);

  const guardarCuenta = async () => {
    if (!idCliente) return;
    setGuardando(true);
    setError(null);
    try {
      const actualizado = await portalService.actualizarPerfil(idCliente, {
        nombre_cliente: miCuenta.nombre cliente_split,
      } as Partial<Cliente>);
      setDatos(actualizado);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar su cuenta.");
    } finally {
      setGuardando(false);
    }
  };

  const cabecera: DatosEmpresaPdf = empresa
    ? {
        nombre: empresa.nombre,
        direccion: [empresa.calle, empresa.numero, empresa.barrio, empresa.ciudad, empresa.provincia]
          .filter(Boolean)
          .join(", "),
        telefono: empresa.telefono ?? undefined,
        correo: empresa.correo ?? undefined,
      }
    : {};

  const imprimirOrden = async (idOrden: string) => {
    try {
      const d = await portalService.detalleOrden(idCliente, idOrden);
      if (!d) throw new Error("No se pudo cargar el detalle de la orden.");
      const lineas = [
        ...d.productos.map((p) => ({ descripcion: p.descripcion, cantidad: p.cantidad, precio: p.precio, subtotal: p.subtotal })),
        ...d.servicios.map((s) => ({ descripcion: s.servicio, cantidad: s.cantidad, precio: s.precio, subtotal: s.subtotal })),
      ];
      const doc = pdfDocumento(
        "Orden de trabajo",
        `N.º ${String(d.orden.id_orden).slice(0, 8).toUpperCase()} · ${formatoFecha(d.orden.fecha_inicial)}`,
        cabecera,
        [`Cliente: ${datos?.nombre_cliente ?? ""}`, `Estado: ${d.orden.estado}`],
        lineas,
        Number(d.orden.valor_total ?? 0),
      );
      descargarPdf(doc, `orden-${String(d.orden.id_orden).slice(0, 8)}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo imprimir la orden.");
    }
  };

  const imprimirCompra = async (idVenta: string) => {
    try {
      const d = await portalService.detalleCompra(idCliente, idVenta);
      if (!d) throw new Error("No se pudo cargar el detalle de la compra.");
      const doc = pdfDocumento(
        "Comprobante de compra",
        `N.º ${String(d.venta.id_venta).slice(0, 8).toUpperCase()} · ${formatoFecha(d.venta.fecha_venta)}`,
        cabecera,
        [`Cliente: ${datos?.nombre_cliente ?? ""}`],
        d.items.map((i) => ({ descripcion: i.descripcion, cantidad: i.cantidad, precio: i.precio, subtotal: i.subtotal })),
        Number(d.venta.valor_total ?? 0),
      );
      descargarPdf(doc, `compra-${String(d.venta.id_venta).slice(0, 8)}.pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo imprimir la compra.");
    }
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold">Sistema Taller</p>
            <p className="text-xs text-muted-foreground">
              Portal del cliente — {sesion?.nombre} ({sesion?.correo})
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onSalir}>
            Cerrar sesión
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 p-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {([
            { id: "ordenes", etiqueta: "Mis órdenes", icono: <BriefcaseIcon className="size-3.5" /> },
            { id: "compras", etiqueta: "Mis compras", icono: <ReceiptIcon className="size-3.5" /> },
            { id: "cuenta", etiqueta: "Mi cuenta", icono: <UserIcon className="size-3.5" /> },
          ] as { id: Pestana; etiqueta: string; icono: React.ReactNode }[]).map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant={pestana === t.id ? "default" : "outline"}
              onClick={() => setPestana(t.id)}
            >
              {t.icono} {t.etiqueta}
            </Button>
          ))}
        </div>

        {cargando && <p className="text-sm text-muted-foreground">Cargando datos…</p>}

        {pestana === "ordenes" && !cargando && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Mis órdenes de trabajo</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N.º</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenes.map((o) => (
                    <TableRow key={o.id_orden}>
                      <TableCell className="font-mono text-xs">{String(o.id_orden).slice(0, 8).toUpperCase()}</TableCell>
                      <TableCell>{formatoFecha(o.fecha_inicial)}</TableCell>
                      <TableCell><Badge variant="outline">{o.estado}</Badge></TableCell>
                      <TableCell className="text-right">{formatoDinero(o.valor_total)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void portalService
                                .detalleOrden(idCliente, String(o.id_orden))
                                .then((d) => d && setVerOrden(d))
                            }
                          >
                            Ver
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Imprimir"
                            onClick={() => void imprimirOrden(String(o.id_orden))}
                          >
                            <PrinterIcon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {ordenes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-4 text-center text-muted-foreground">Sin órdenes registradas.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {pestana === "compras" && !cargando && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Mis últimas compras</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N.º</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Descuento</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ventas.map((v) => (
                    <TableRow key={v.id_venta}>
                      <TableCell className="font-mono text-xs">{String(v.id_venta).slice(0, 8).toUpperCase()}</TableCell>
                      <TableCell>{formatoFecha(v.fecha_venta)}</TableCell>
                      <TableCell className="text-right">{formatoDinero(v.descuento)}</TableCell>
                      <TableCell className="text-right">{formatoDinero(v.valor_total)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              void portalService
                                .detalleCompra(idCliente, String(v.id_venta))
                                .then((d) => d && setVerCompra(d))
                            }
                          >
                            Ver
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Imprimir"
                            onClick={() => void imprimirCompra(String(v.id_venta))}
                          >
                            <PrinterIcon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {ventas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-4 text-center text-muted-foreground">Sin compras registradas.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {pestana === "cuenta" && !cargando && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Mis datos de cuenta</CardTitle>
              <p className="text-xs text-muted-foreground">
                El correo ({sesion?.correo}) y el documento no se pueden cambiar desde el portal; para hacerlo
                contacte al taller.
              </p>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void guardarCuenta();
                }}
                className="grid gap-3 sm:grid-cols-2"
              >
                <div className="space-y-1">
                  <Label>Nombre</Label>
                  <Input value={miCuenta.nombre_cliente} onChange={(e) => setMiCuenta({ ...miCuenta, nombre_cliente: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Sexo</Label>
                  <Input value={miCuenta.sexo} onChange={(e) => setMiCuenta({ ...miCuenta, sexo: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Persona física</Label>
                  <Input value={miCuenta.persona_fisica === "si" ? "Sí" : "No"} disabled />
                  <p className="text-xs text-muted-foreground">Si este dato es incorrecto, contáctese con el taller.</p>
                </div>
                <div className="space-y-1">
                  <Label>Teléfono</Label>
                  <Input value={miCuenta.telefono} onChange={(e) => setMiCuenta({ ...miCuenta, telefono: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Celular</Label>
                  <Input value={miCuenta.celular} onChange={(e) => setMiCuenta({ ...miCuenta, celular: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Calle</Label>
                  <Input value={miCuenta.calle} onChange={(e) => setMiCuenta({ ...miCuenta, calle: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Número</Label>
                  <Input value={miCuenta.numero} onChange={(e) => setMiCuenta({ ...miCuenta, numero: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Barrio</Label>
                  <Input value={miCuenta.barrio} onChange={(e) => setMiCuenta({ ...miCuenta, barrio: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Ciudad</Label>
                  <Input value={miCuenta.ciudad} onChange={(e) => setMiCuenta({ ...miCuenta, ciudad: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Estado/Provincia</Label>
                  <Input value={miCuenta.estado} onChange={(e) => setMiCuenta({ ...miCuenta, estado: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>Código postal</Label>
                  <Input value={miCuenta.codigo_postal} onChange={(e) => setMiCuenta({ ...miCuenta, codigo_postal: e.target.value })} />
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button type="submit" disabled={guardando}>
                    {guardando ? "Guardando…" : "Guardar cambios"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </main>

      {/* --------------------------- Detalle de orden -------------------------- */}
      <Dialog
        open={verOrden !== null}
        onOpenChange={(o) => {
          if (!o) setVerOrden(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalle de la orden</DialogTitle>
          </DialogHeader>
          {verOrden && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{verOrden.orden.estado}</Badge>
                <span className="text-muted-foreground">{formatoFecha(verOrden.orden.fecha_inicial)}</span>
              </div>
              <p><span className="font-medium">Producto/desc.: </span>{verOrden.orden.descripcion_producto ?? "—"}</p>
              <p><span className="font-medium">Defecto: </span>{verOrden.orden.defecto ?? "—"}</p>
              <p><span className="font-medium">Observaciones: </span>{verOrden.orden.observaciones ?? "—"}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Desc.</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ...verOrden.productos.map((p) => ({ clave: `p${p.id_producto_orden}`, desc: p.descripcion, cant: p.cantidad, sub: p.subtotal })),
                    ...verOrden.servicios.map((s) => ({ clave: `s${s.id_servicio_orden}`, desc: s.servicio, cant: s.cantidad, sub: s.subtotal })),
                  ].map((l) => (
                    <TableRow key={l.clave}>
                      <TableCell>{l.desc}</TableCell>
                      <TableCell>{l.cant}</TableCell>
                      <TableCell className="text-right">{formatoDinero(l.sub)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-right font-bold">{formatoDinero(verOrden.orden.valor_total)}</p>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => void imprimirOrden(String(verOrden.orden.id_orden))}>
                  <PrinterIcon data-icon="inline-start" /> Imprimir
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerOrden(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --------------------------- Detalle de compra ------------------------- */}
      <Dialog
        open={verCompra !== null}
        onOpenChange={(o) => {
          if (!o) setVerCompra(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalle de la compra</DialogTitle>
          </DialogHeader>
          {verCompra && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <span className="text-muted-foreground">{formatoFecha(verCompra.venta.fecha_venta)}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Desc.</TableHead>
                    <TableHead>Cant.</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {verCompra.items.map((i) => (
                    <TableRow key={i.id_item_venta}>
                      <TableCell>{i.descripcion}</TableCell>
                      <TableCell>{i.cantidad}</TableCell>
                      <TableCell className="text-right">{formatoDinero(i.subtotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {Number(verCompra.venta.descuento ?? 0) > 0 && (
                <p className="text-right text-muted-foreground">Descuento: {formatoDinero(Number(verCompra.venta.descuento))}</p>
              )}
              <p className="text-right font-bold">{formatoDinero(verCompra.venta.valor_total)}</p>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => void imprimirCompra(String(verCompra.venta.id_venta))}>
                  <PrinterIcon data-icon="inline-start" /> Imprimir
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerCompra(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pantalla raíz del portal                                                   */
/* -------------------------------------------------------------------------- */

export default function Portal() {
  const [sesionValida, setSesionValida] = useState(() => portalService.obtenerSesion() !== null);
  const [, setVersion] = useState(0);

  const salir = async () => {
    await portalService.cerrar();
    setSesionValida(false);
    setVersion((v) => v + 1);
    window.location.reload();
  };

  if (!sesionValida && !portalService.obtenerSesion()) return <AccesoPortal />;
  return <PanelPortal onSalir={salir} />;
}
