// ============================================================================
// Sistema Taller — Clientes (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §2: crear, editar, eliminar y visualizar clientes; búsqueda
// por nombre/documento/correo; paginación; vinculación con órdenes, ventas,
// financiero y garantías (vista de vínculos del servicio clientesService).
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import CrudPage, { type Fila } from "../components/CrudPage";
import { useAuth } from "../contexts/AuthContext";
import { clientesService } from "../services";
import { formatoFecha } from "../lib/fechas";
import type { Cliente } from "../lib/types";

/** Cuenta de vínculos del cliente (órdenes, ventas, movimientos, equipos). */
function Vinculos({ id }: { id: string }) {
  const [vinculos, setVinculos] = useState<{ ordenes: number; ventas: number; movimientos: number; equipos: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let montado = true;
    clientesService
      .vinculos(id)
      .then((v) => {
        if (montado) setVinculos(v);
      })
      .catch((e) => {
        if (montado) setError(e instanceof Error ? e.message : "Sin vínculos.");
      });
    return () => {
      montado = false;
    };
  }, [id]);
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (!vinculos) return <p className="text-xs text-muted-foreground">Buscando vínculos…</p>;
  return (
    <ul className="list-disc pl-5 text-sm">
      <li>Órdenes de trabajo: {vinculos.ordenes}</li>
      <li>Ventas: {vinculos.ventas}</li>
      <li>Movimientos financieros: {vinculos.movimientos}</li>
      <li>Equipos: {vinculos.equipos}</li>
    </ul>
  );
}

function comoCliente(fila: Fila): Cliente {
  return fila as unknown as Cliente;
}

function detalle(fila: Fila) {
  const c = comoCliente(fila);
  const linea = (etiqueta: string, valor?: string | null) => (
    <div key={etiqueta} className="flex gap-2 text-sm">
      <span className="w-36 shrink-0 font-medium">{etiqueta}:</span>
      <span className="text-muted-foreground">{valor ?? "—"}</span>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {linea("Nombre", c.nombre_cliente)}
        {linea("Sexo", c.sexo ?? undefined)}
        {linea("Persona física", c.persona_fisica ? "Sí" : "No")}
        {linea("Documento", c.documento)}
        {linea("Correo", c.correo)}
        {linea("Teléfono", c.telefono)}
        {linea("Celular", c.celular)}
        {linea("Calle", c.calle)}
        {linea("Número", c.numero)}
        {linea("Barrio", c.barrio)}
        {linea("Ciudad", c.ciudad)}
        {linea("Estado/Provincia", c.estado)}
        {linea("Código postal", c.codigo_postal)}
        {linea("Fecha de registro", formatoFecha(c.fecha_registro))}
      </div>
      <div>
        <h4 className="mb-1 text-sm font-semibold">Vinculación con el negocio</h4>
        <Vinculos id={c.id_cliente} />
      </div>
    </div>
  );
}

export default function Clientes() {
  const { puede } = useAuth();

  const listar = useCallback(
    async ({ q, pagina, tamPagina }: { q: string; pagina: number; tamPagina: number }) => {
      const res = await clientesService.listar({ q, pagina, tamPagina });
      return { datos: res.datos as unknown as Fila[], total: res.total };
    },
    [],
  );

  const guardar = useCallback(async (datos: Fila, id?: string) => {
    const c = datos as unknown as Partial<Cliente>;
    if (id) await clientesService.editar(id, c);
    else await clientesService.crear(c);
  }, []);

  const eliminar = useCallback(async (id: string) => {
    await clientesService.eliminar(id);
  }, []);

  return (
    <CrudPage
      titulo="Clientes"
      singular="Cliente"
      descripcion="Búsqueda por nombre, documento o correo; vinculación con órdenes, ventas, financiero y garantías."
      placeholderBusqueda="Nombre, documento o correo…"
      clave={(f) => String(comoCliente(f).id_cliente)}
      columnas={[
        { clave: "nombre_cliente", etiqueta: "Nombre" },
        { clave: "documento", etiqueta: "Documento" },
        { clave: "correo", etiqueta: "Correo" },
        { clave: "telefono", etiqueta: "Teléfono" },
        { clave: "ciudad", etiqueta: "Ciudad" },
        { clave: "fecha_registro", etiqueta: "Registro", formato: "fecha" },
      ]}
      campos={[
        { clave: "nombre_cliente", etiqueta: "Nombre", obligatorio: true },
        { clave: "documento", etiqueta: "Documento", obligatorio: true },
        {
          clave: "sexo",
          etiqueta: "Sexo",
          tipo: "seleccion",
          opciones: [
            { valor: "Femenino", etiqueta: "Femenino" },
            { valor: "Masculino", etiqueta: "Masculino" },
            { valor: "Otro", etiqueta: "Otro" },
          ],
        },
        { clave: "persona_fisica", etiqueta: "Persona física", tipo: "booleano" },
        { clave: "correo", etiqueta: "Correo electrónico", placeholder: "ejemplo@correo.com" },
        { clave: "telefono", etiqueta: "Teléfono" },
        { clave: "celular", etiqueta: "Celular" },
        { clave: "calle", etiqueta: "Calle" },
        { clave: "numero", etiqueta: "Número" },
        { clave: "barrio", etiqueta: "Barrio" },
        { clave: "ciudad", etiqueta: "Ciudad" },
        { clave: "estado", etiqueta: "Estado/Provincia" },
        { clave: "codigo_postal", etiqueta: "Código postal" },
      ]}
      listar={listar}
      guardar={guardar}
      eliminar={eliminar}
      ver={detalle}
      puedeAgregar={puede(["aCliente"])}
      puedeEditar={puede(["eCliente"]) || puede(["cCliente"])}
      puedeEliminar={puede(["dCliente"])}
    />
  );
}
