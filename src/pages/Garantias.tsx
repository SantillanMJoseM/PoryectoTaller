// ============================================================================
// Sistema Taller — Garantías (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §7: crear, editar, eliminar y visualizar términos de
// garantía (referencia, texto y fecha); asociación a órdenes vía garantia_id
// (se administra desde la pantalla de Órdenes de trabajo); impresión con
// encabezado de empresa (pdfGarantia — jsPDF).
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { PrinterIcon } from "lucide-react";
import CrudPage, { type Fila } from "../components/CrudPage";
import { Button } from "../components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { empresaService, garantiasService } from "../services";
import { descargarPdf, pdfGarantia } from "../lib/pdf";
import { formatoFecha } from "../lib/fechas";
import type { Empresa, Garantia } from "../lib/types";

function comoGarantia(fila: Fila): Garantia {
  return fila as unknown as Garantia;
}

function detalle(fila: Fila) {
  const g = comoGarantia(fila);
  const linea = (etiqueta: string, valor?: string | null) => (
    <div key={etiqueta} className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 font-medium">{etiqueta}:</span>
      <span className="text-muted-foreground whitespace-pre-wrap">{valor || "—"}</span>
    </div>
  );
  return (
    <div className="space-y-1">
      {linea("Referencia", g.referencia)}
      {linea("Fecha", formatoFecha(g.fecha_garantia))}
      {linea("Usuario", g.usuario_id ? String(g.usuario_id) : "")}
      {linea("Texto de garantía", g.texto_garantia)}
    </div>
  );
}

export default function Garantias() {
  const { puede } = useAuth();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  useEffect(() => {
    empresaService
      .obtener()
      .then(setEmpresa)
      .catch(() => setEmpresa(null));
  }, []);

  const imprimir = useCallback(
    (g: Garantia) => {
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
      const doc = pdfGarantia(
        datos,
        "Término de garantía",
        `Referencia: ${g.referencia ?? ""} · Fecha: ${formatoFecha(g.fecha_garantia)}`,
        [g.texto_garantia ?? ""],
      );
      descargarPdf(doc, `garantia-${(g.referencia ?? "termino").replace(/[^\w.-]+/g, "_")}.pdf`);
    },
    [empresa],
  );

  const listar = useCallback(
    async ({ q, pagina, tamPagina }: { q: string; pagina: number; tamPagina: number }) => {
      const res = await garantiasService.listar({
        q,
        pagina,
        tamPagina,
        columna: "fecha_garantia",
        ascendente: false,
      });
      return { datos: res.datos as unknown as Fila[], total: res.total };
    },
    [],
  );

  const guardar = useCallback(async (datos: Fila, id?: string) => {
    const g = datos as unknown as Partial<Garantia>;
    if (id) await garantiasService.editar(id, g);
    else await garantiasService.crear(g);
  }, []);

  const eliminar = useCallback(async (id: string) => {
    await garantiasService.eliminar(id);
  }, []);

  return (
    <CrudPage
      titulo="Garantías"
      singular="Garantía"
      descripcion="Términos de garantía (referencia, texto y fecha) que se asocian a las órdenes de trabajo."
      placeholderBusqueda="Buscar por referencia…"
      clave={(f) => String(comoGarantia(f).id_garantia)}
      columnas={[
        { clave: "referencia", etiqueta: "Referencia" },
        { clave: "fecha_garantia", etiqueta: "Fecha", formato: "fecha" },
        { clave: "texto_garantia", etiqueta: "Texto" },
      ]}
      campos={[
        { clave: "referencia", etiqueta: "Referencia", obligatorio: true },
        { clave: "fecha_garantia", etiqueta: "Fecha", tipo: "fecha" },
        { clave: "texto_garantia", etiqueta: "Texto de la garantía", tipo: "parrafo" },
      ]}
      listar={listar}
      guardar={guardar}
      eliminar={eliminar}
      ver={detalle}
      acciones={(f) => (
        <Button variant="ghost" size="icon-sm" title="Imprimir" onClick={() => imprimir(comoGarantia(f))}>
          <PrinterIcon />
        </Button>
      )}
      puedeAgregar={puede(["aGarantia"])}
      puedeEditar={puede(["eGarantia"])}
      puedeEliminar={puede(["dGarantia"])}
    />
  );
}
