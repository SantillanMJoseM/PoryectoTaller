// ============================================================================
// Sistema Taller — Panel principal (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §1: resumen operativo (órdenes abiertas, productos con
// stock bajo, últimas ventas, movimientos pendientes), accesos rápidos a
// módulos y usuario conectado con menú según permisos (el filtrado del menú
// vive en Layout; aquí se filtran también los atajos).
// ============================================================================

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangleIcon, BriefcaseIcon, PackageIcon, WalletIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { useAuth } from "../contexts/AuthContext";
import { panelService } from "../services";
import type { ResumenPanel } from "../services";
import { formatoDinero } from "../lib/dinero";
import { formatoFecha } from "../lib/fechas";

const CODIGOS_RUTA: Record<string, string[]> = {
  "/ordenes": ["vOrden"],
  "/clientes": ["vCliente"],
  "/productos": ["vProducto"],
  "/ventas": ["vVenta"],
  "/financiero": ["vMovimiento"],
  "/reportes": ["rCliente", "rProducto", "rServicio", "rOrden", "rVenta", "rMovimiento"],
};

export default function Dashboard() {
  const { sesion, puede } = useAuth();
  const [datos, setDatos] = useState<ResumenPanel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let montado = true;
    panelService
      .resumen()
      .then((r) => {
        if (montado) setDatos(r);
      })
      .catch((e) => {
        if (montado) setError(e instanceof Error ? e.message : "No se pudo cargar el resumen.");
      });
    return () => {
      montado = false;
    };
  }, []);

  const atajos = [
    { etiqueta: "Órdenes de trabajo", ruta: "/ordenes" },
    { etiqueta: "Clientes", ruta: "/clientes" },
    { etiqueta: "Productos", ruta: "/productos" },
    { etiqueta: "Ventas", ruta: "/ventas" },
    { etiqueta: "Financiero", ruta: "/financiero" },
    { etiqueta: "Informes", ruta: "/reportes" },
  ].filter((a) => puede(CODIGOS_RUTA[a.ruta] ?? []));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Panel principal</h2>
        <p className="text-sm text-muted-foreground">
          Usuario conectado: {sesion?.usuario?.nombre || sesion?.correo || "administrador"}
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error} — Verifique su conexión con Supabase o los permisos de su sesión.
        </p>
      )}

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BriefcaseIcon className="size-4" /> Órdenes abiertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{datos?.ordenesAbiertas ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Abierta + En Proceso + Aguardando Piezas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <PackageIcon className="size-4" /> Stock bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{datos?.productosStockBajo.length ?? "—"}</p>
            <p className="text-xs text-muted-foreground">Productos por debajo del mínimo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <WalletIcon className="size-4" /> Movimientos pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{datos?.movimientosPendientes.total ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              {datos?.movimientosPendientes.vencidos ?? 0} vencido(s) — detección de atrasos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {atajos.map((a) => (
              <Link key={a.ruta} to={a.ruta}>
                <Button variant="secondary" size="sm">
                  {a.etiqueta}
                </Button>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Alerta de stock bajo */}
      {datos && datos.productosStockBajo.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangleIcon className="size-4" /> Productos con stock bajo
          </p>
          <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
            {datos.productosStockBajo.slice(0, 8).map((p) => (
              <li key={p.producto}>
                {p.producto}: quedan {p.stock} (mínimo {p.minimo})
              </li>
            ))}
            {datos.productosStockBajo.length > 8 && (
              <li>… y {datos.productosStockBajo.length - 8} más</li>
            )}
          </ul>
        </div>
      )}

      {/* Listados */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Últimas ventas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Facturada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(datos?.ultimasVentas ?? []).map((v) => (
                  <TableRow key={v.id_venta}>
                    <TableCell>{formatoFecha(v.fecha_venta)}</TableCell>
                    <TableCell>
                      {(v.clientes as { nombre_cliente?: string } | null | undefined)?.nombre_cliente ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{formatoDinero(v.valor_total)}</TableCell>
                    <TableCell>
                      <Badge variant={v.facturado ? "default" : "outline"}>
                        {v.facturado ? "Sí" : "No"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(datos?.ultimasVentas ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Sin ventas registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Órdenes recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Facturada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(datos?.ordenesRecientes ?? []).map((o) => (
                  <TableRow key={o.id_orden}>
                    <TableCell>{formatoFecha(o.fecha_inicial)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{o.estado}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatoDinero(o.valor_total)}</TableCell>
                    <TableCell>{o.facturado ? "Sí" : "No"}</TableCell>
                  </TableRow>
                ))}
                {(datos?.ordenesRecientes ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Sin órdenes registradas.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Movimientos pendientes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Movimientos financieros pendientes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimiento</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Negocio</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Situación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(datos?.movimientosPendientes.datos ?? []).map((m) => (
                <TableRow key={m.id_movimiento}>
                  <TableCell>{formatoFecha(m.fecha_vencimiento)}</TableCell>
                  <TableCell>{m.descripcion}</TableCell>
                  <TableCell>{m.cliente_proveedor ?? "—"}</TableCell>
                  <TableCell>{m.tipo}</TableCell>
                  <TableCell className="text-right">{formatoDinero(m.valor)}</TableCell>
                  <TableCell>
                    <Badge variant={m.vencido ? "destructive" : "outline"}>
                      {m.vencido ? "Vencido" : "Pendiente"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(datos?.movimientosPendientes.datos ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nada pendiente: todo al día.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
