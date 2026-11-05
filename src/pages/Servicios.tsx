// ============================================================================
// Sistema Taller — Servicios (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §4: crear, editar, eliminar y visualizar servicios con
// nombre, descripción y precio. Los servicios se consumen en Órdenes de
// trabajo (servicios_orden, sin efecto en stock).
// ============================================================================

import { useCallback } from "react";
import CrudPage, { type Fila } from "../components/CrudPage";
import { useAuth } from "../contexts/AuthContext";
import { serviciosService } from "../services";
import type { Servicio } from "../lib/types";

function comoServicio(fila: Fila): Servicio {
  return fila as unknown as Servicio;
}

function detalle(fila: Fila) {
  const s = comoServicio(fila);
  const linea = (etiqueta: string, valor?: string | number | null) => (
    <div key={etiqueta} className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 font-medium">{etiqueta}:</span>
      <span className="text-muted-foreground">{valor === undefined || valor === null || valor === "" ? "—" : String(valor)}</span>
    </div>
  );
  return (
    <div className="space-y-1">
      {linea("Nombre", s.nombre)}
      {linea("Descripción", s.descripcion)}
      {linea("Precio", Number(s.precio ?? 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
    </div>
  );
}

export default function Servicios() {
  const { puede } = useAuth();

  const listar = useCallback(
    async ({ q, pagina, tamPagina }: { q: string; pagina: number; tamPagina: number }) => {
      const res = await serviciosService.listar({
        q,
        pagina,
        tamPagina,
        columna: "nombre",
        ascendente: true,
      });
      return { datos: res.datos as unknown as Fila[], total: res.total };
    },
    [],
  );

  const guardar = useCallback(async (datos: Fila, id?: string) => {
    const s = datos as unknown as Partial<Servicio>;
    if (id) await serviciosService.editar(id, s);
    else await serviciosService.crear(s);
  }, []);

  const eliminar = useCallback(async (id: string) => {
    await serviciosService.eliminar(id);
  }, []);

  return (
    <CrudPage
      titulo="Servicios"
      singular="Servicio"
      descripcion="Catálogo de servicios con nombre, descripción y precio para las órdenes de trabajo."
      placeholderBusqueda="Buscar por nombre…"
      clave={(f) => String(comoServicio(f).id_servicio)}
      columnas={[
        { clave: "nombre", etiqueta: "Nombre" },
        { clave: "descripcion", etiqueta: "Descripción" },
        { clave: "precio", etiqueta: "Precio", formato: "dinero" },
      ]}
      campos={[
        { clave: "nombre", etiqueta: "Nombre", obligatorio: true },
        { clave: "descripcion", etiqueta: "Descripción", tipo: "parrafo" },
        { clave: "precio", etiqueta: "Precio", tipo: "dinero" },
      ]}
      listar={listar}
      guardar={guardar}
      eliminar={eliminar}
      ver={detalle}
      puedeAgregar={puede(["aServicio"])}
      puedeEditar={puede(["eServicio"])}
      puedeEliminar={puede(["dServicio"])}
    />
  );
}
