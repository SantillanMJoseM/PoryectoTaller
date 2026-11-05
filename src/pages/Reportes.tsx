// ============================================================================
// Sistema Taller — Informes/Reportes (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §12: reportes de clientes, productos (incluye stock bajo),
// servicios, órdenes (filtros por estado, fecha, cliente), ventas y financieros.
// Versiones rápidas (todos los registros) y personalizadas (con filtros por
// fecha inicial/final, precio inicial/final, stock inicial/final). Generación
// de PDF con encabezado de empresa, datos tabulados y paginación (lib/pdf.ts);
// descarga y visualización en línea.
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { DownloadIcon, EyeIcon } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
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
import { useAuth } from "../contexts/AuthContext";
import { clientesService, reportesService } from "../services";
import { abrirPdf, descargarPdf, generarPdfTabla, type ColumnaPdf } from "../lib/pdf";
import { formatoDinero } from "../lib/dinero";
import { formatoFecha } from "../lib/fechas";
import { ESTADOS_ORDEN } from "../lib/types";
import type { FiltrosReporte, Reporte, TipoReporte } from "../services";

const TIPOS: { tipo: TipoReporte; etiqueta: string }[] = [
  { tipo: "clientes", etiqueta: "Clientes" },
  { tipo: "productos", etiqueta: "Productos (incluye stock bajo)" },
  { tipo: "servicios", etiqueta: "Servicios" },
  { tipo: "ordenes", etiqueta: "Órdenes de trabajo" },
  { tipo: "ventas", etiqueta: "Ventas" },
  { tipo: "financiero", etiqueta: "Financiero" },
];

function valorCelda(fila: Record<string, unknown>, col: ColumnaPdf): string {
  const v = fila[col.clave];
  switch (col.tipo) {
    case "dinero":
      return formatoDinero(Number(v ?? 0));
    case "fecha":
      return typeof v === "string" ? formatoFecha(v) : "";
    case "numero":
      return String(v ?? "");
    default:
      return v === null || v === undefined ? "" : String(v);
  }
}

export default function Reportes() {
  const { puede } = useAuth();
  const puedeVer = useCallback(
    (t: TipoReporte): boolean => {
      const mapa: Record<TipoReporte, string> = {
        clientes: "rCliente",
        productos: "rProducto",
        servicios: "rServicio",
        ordenes: "rOrden",
        ventas: "rVenta",
        financiero: "rMovimiento",
      };
      return puede([mapa[t]]);
    },
    [puede],
  );

  const tiposDisponibles = TIPOS.filter((t) => puedeVer(t.tipo));

  const [tipo, setTipo] = useState<TipoReporte>("clientes");
  const [filtros, setFiltros] = useState<FiltrosReporte>({});
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Autocompletado de clientes para reportes de órdenes/ventas.
  const [clientes, setClientes] = useState<{ id_cliente: string; nombre_cliente: string }[]>([]);
  useEffect(() => {
    clientesService
      .listar({ tamPagina: 200, columna: "nombre_cliente", ascendente: true })
      .then((r) => setClientes(r.datos.map((c) => ({ id_cliente: c.id_cliente, nombre_cliente: c.nombre_cliente }))))
      .catch(() => setClientes([]));
  }, []);

  useEffect(() => {
    setFiltros({});
    setReporte(null);
  }, [tipo]);

  const generar = useCallback(
    async (rapido: boolean) => {
      setCargando(true);
      setError(null);
      try {
        const f = rapido ? {} : filtros;
        const r = await reportesService.generar(tipo, f);
        setReporte(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo generar el reporte.");
      } finally {
        setCargando(false);
      }
    },
    [tipo, filtros],
  );

  const columnasPdf = useMemo<ColumnaPdf[]>(() => {
    if (!reporte) return [];
    return reporte.columnas.map((c) => ({
      clave: c.clave,
      titulo: c.titulo,
      ancho: c.tipo === "texto" ? 55 : 40,
      tipo: c.tipo,
    }));
  }, [reporte]);

  const descargar = () => {
    if (!reporte) return;
    const doc = generarPdfTabla({
      titulo: reporte.titulo,
      empresa: reporte.empresa,
      columnas: columnasPdf,
      filas: reporte.filas,
      subtitulo: `${reporte.filas.length} registro(s)`,
      nota: "Reporte generado por Sistema Taller",
    });
    descargarPdf(doc, `reporte-${reporte.tipo}.pdf`);
  };

  const ver = () => {
    if (!reporte) return;
    const doc = generarPdfTabla({
      titulo: reporte.titulo,
      empresa: reporte.empresa,
      columnas: columnasPdf,
      filas: reporte.filas,
      subtitulo: `${reporte.filas.length} registro(s)`,
    });
    abrirPdf(doc);
  };    


  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Informes/Reportes</h2>
        <p className="text-sm text-muted-foreground">
          Versiones rápidas (todos los registros) y personalizadas (con filtros); PDF con encabezado de empresa.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tiposDisponibles.map((t) => (
          <Button
            key={t.tipo}
            variant={tipo === t.tipo ? "default" : "outline"}
            size="sm"
            onClick={() => setTipo(t.tipo)}
          >
            {t.etiqueta}
          </Button>
        ))}
        {tiposDisponibles.length === 0 && (
          <p className="text-sm text-muted-foreground">Su grupo de permisos no incluye códigos de reporte (r*).</p>
        )}
      </div>

      {tiposDisponibles.length > 0 && (
        <div className="rounded-xl border bg-background p-4">
          <p className="mb-3 text-sm font-semibold">Filtros personalizados</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(tipo === "clientes" || tipo === "ordenes" || tipo === "ventas" || tipo === "financiero") && (
              <div className="space-y-1">
                <Label>Fecha inicial</Label>
                <Input type="date" value={filtros.fechaInicial ?? ""} onChange={(e) => setFiltros({ ...filtros, fechaInicial: e.target.value || undefined })} />
              </div>
            )}
            {(tipo === "clientes" || tipo === "ordenes" || tipo === "ventas" || tipo === "financiero") && (
              <div className="space-y-1">
                <Label>Fecha final</Label>
                <Input type="date" value={filtros.fechaFinal ?? ""} onChange={(e) => setFiltros({ ...filtros, fechaFinal: e.target.value || undefined })} />
              </div>
            )}
            {(tipo === "productos" || tipo === "servicios" || tipo === "ordenes" || tipo === "ventas" || tipo === "financiero") && (
              <div className="space-y-1">
                <Label>Precio inicial</Label>
                <Input type="number" step="0.01" value={filtros.precioInicial ?? ""} onChange={(e) => setFiltros({ ...filtros, precioInicial: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </div>
            )}
            {(tipo === "productos" || tipo === "servicios" || tipo === "ordenes" || tipo === "ventas" || tipo === "financiero") && (
              <div className="space-y-1">
                <Label>Precio final</Label>
                <Input type="number" step="0.01" value={filtros.precioFinal ?? ""} onChange={(e) => setFiltros({ ...filtros, precioFinal: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </div>
            )}
            {tipo === "productos" && (
              <>
                <div className="space-y-1">
                  <Label>Stock inicial</Label>
                  <Input type="number" value={filtros.stockInicial ?? ""} onChange={(e) => setFiltros({ ...filtros, stockInicial: e.target.value === "" ? undefined : Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>Stock final</Label>
                  <Input type="number" value={filtros.stockFinal ?? ""} onChange={(e) => setFiltros({ ...filtros, stockFinal: e.target.value === "" ? undefined : Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label>Solo stock bajo</Label>
                  <SimpleSelect
                    value={filtros.soloStockBajo ? "si" : "no"}
                    onChange={(v) => setFiltros({ ...filtros, soloStockBajo: v === "si" || undefined })}
                    opciones={[
                      { valor: "no", etiqueta: "Todos" },
                      { valor: "si", etiqueta: "Solo stock bajo" },
                    ]}
                  />
                </div>
              </>
            )}
            {(tipo === "ordenes" || tipo === "ventas") && (
              <>
                <div className="space-y-1">
                  <Label>Cliente</Label>
                  <SimpleSelect
                    value={filtros.clienteId ?? ""}
                    onChange={(v) => setFiltros({ ...filtros, clienteId: v || undefined })}
                    opciones={clientes.map((c) => ({ valor: c.id_cliente, etiqueta: c.nombre_cliente }))}
                    placeholder="— Todos —"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Solo facturadas</Label>
                  <SimpleSelect
                    value={filtros.soloFacturadas ? "si" : "no"}
                    onChange={(v) => setFiltros({ ...filtros, soloFacturadas: v === "si" || undefined })}
                    opciones={[
                      { valor: "no", etiqueta: "Todas" },
                      { valor: "si", etiqueta: "Solo facturadas" },
                    ]}
                  />
                </div>
              </>
            )}
            {tipo === "ordenes" && (
              <div className="space-y-1">
                <Label>Estado</Label>
                <SimpleSelect
                  value={filtros.estado ?? ""}
                  onChange={(v) => setFiltros({ ...filtros, estado: v || undefined })}
                  opciones={ESTADOS_ORDEN.map((e) => ({ valor: e, etiqueta: e }))}
                  placeholder="— Todos —"
                />
              </div>
            )}
            {tipo === "financiero" && (
              <div className="space-y-1">
                <Label>Tipo de movimiento</Label>
                <SimpleSelect
                  value={filtros.estado ?? ""}
                  onChange={(v) => setFiltros({ ...filtros, estado: v || undefined })}
                  opciones={[
                    { valor: "ingreso", etiqueta: "Ingresos" },
                    { valor: "egreso", etiqueta: "Egresos" },
                  ]}
                  placeholder="— Ambos —"
                />
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void generar(false)} disabled={cargando}>
              {cargando ? "Generando…" : "Reporte personalizado"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void generar(true)} disabled={cargando}>
              Reporte rápido (todos los registros)
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {reporte && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{reporte.titulo}</Badge>
            <span className="text-xs text-muted-foreground">{reporte.filas.length} registro(s)</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => ver()}>
              <EyeIcon data-icon="inline-start" /> Ver PDF
            </Button>
            <Button size="sm" onClick={() => descargar()}>
              <DownloadIcon data-icon="inline-start" /> Descargar PDF
            </Button>
          </div>
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  {reporte.columnas.map((c) => (
                    <TableHead key={c.clave}>{c.titulo}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reporte.filas.slice(0, 12).map((f, i) => (
                  <TableRow key={i}>
                    {reporte.columnas.map((c) => (
                      <TableCell key={c.clave}>
                        {valorCelda(f, {
                          clave: c.clave,
                          titulo: c.titulo,
                          ancho: 40,
                          tipo: c.tipo === "dinero" ? "dinero" : c.tipo === "fecha" ? "fecha" : c.tipo === "numero" ? "numero" : "texto",
                        })}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {reporte.filas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={reporte.columnas.length} className="p-4 text-center text-muted-foreground">
                      El reporte no tiene registros con esos filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {reporte.filas.length > 12 && (
            <p className="text-xs text-muted-foreground">
              Vista previa de 12 de {reporte.filas.length} fila(s) — el PDF incluye todas con paginación.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
