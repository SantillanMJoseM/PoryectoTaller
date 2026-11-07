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
import { clientesService, catalogosService, ordenesService, ventasService } from "../services";
import { supabase } from "../lib/supabase";
import { formatoFecha } from "../lib/fechas";
import { formatoDinero } from "../lib/dinero";
import type { Cliente, Equipo, OrdenTrabajo, Venta } from "../lib/types";

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

function PanelCliente({ cliente }: { cliente: Cliente }) {
  const [tab, setTab] = useState<"resumen" | "equipos" | "ordenes" | "ventas" | "movimientos">("resumen");
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let montado = true;
    setCargando(true);
    Promise.all([
      catalogosService.equipos.listar(cliente.id_cliente).catch(() => ({ datos: [] })),
      ordenesService.listarFiltradas({ clienteId: cliente.id_cliente, tamPagina: 100 }).catch(() => ({ datos: [] })),
      ventasService.listarFiltradas({ clienteId: cliente.id_cliente, tamPagina: 100 }).catch(() => ({ datos: [] })),
      Promise.resolve(supabase.from("movimientos_financieros").select("*").eq("cliente_id", cliente.id_cliente)).then((r) => r.data ?? []).catch(() => []),
    ]).then(([eq, or, ve, mv]) => {
      if (!montado) return;
      setEquipos(((eq as any)?.datos ?? []) as Equipo[]);
      setOrdenes(((or as any)?.datos ?? []) as OrdenTrabajo[]);
      setVentas(((ve as any)?.datos ?? []) as Venta[]);
      setMovimientos((mv as any) ?? []);
      setCargando(false);
    });
    return () => {
      montado = false;
    };
  }, [cliente.id_cliente]);

  const tabs = [
    { id: "resumen", label: "Resumen" },
    { id: "equipos", label: `Equipos (${equipos.length})` },
    { id: "ordenes", label: `Órdenes (${ordenes.length})` },
    { id: "ventas", label: `Facturas (${ventas.length})` },
    { id: "movimientos", label: `Movimientos (${movimientos.length})` },
  ] as const;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-lg px-3 py-1 text-sm ${tab === t.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : tab === "resumen" ? (
        <div className="space-y-1 text-sm">
          <p><span className="font-medium">Nombre:</span> {cliente.nombre_cliente}</p>
          <p><span className="font-medium">Documento:</span> {cliente.documento ?? "—"}</p>
          <p><span className="font-medium">Correo:</span> {cliente.correo ?? "—"}</p>
          <p><span className="font-medium">Teléfono:</span> {cliente.telefono ?? "—"}</p>
          <p><span className="font-medium">Dirección:</span> {[cliente.calle, cliente.numero, cliente.barrio, cliente.ciudad, cliente.estado, cliente.codigo_postal].filter(Boolean).join(", ") || "—"}</p>
          <p><span className="font-medium">Equipos:</span> {equipos.length}</p>
          <p><span className="font-medium">Órdenes:</span> {ordenes.length}</p>
          <p><span className="font-medium">Facturas:</span> {ventas.length}</p>
          <p><span className="font-medium">Movimientos:</span> {movimientos.length}</p>
        </div>
      ) : tab === "equipos" ? (
        equipos.length === 0 ? <p className="text-sm text-muted-foreground">Sin equipos.</p> : (
          <ul className="list-disc pl-5 text-sm">
            {equipos.map((e) => (
              <li key={e.id_equipo}>
                {e.equipo} · {e.modelo ?? "—"} · {e.color ?? "—"} · Serie: {e.numero_serie ?? "—"} · Chasis: {e.numero_chasis ?? "—"} · {e.condicion ?? "—"}
              </li>
            ))}
          </ul>
        )
      ) : tab === "ordenes" ? (
        ordenes.length === 0 ? <p className="text-sm text-muted-foreground">Sin órdenes.</p> : (
          <ul className="list-disc pl-5 text-sm">
            {ordenes.map((o) => (
              <li key={o.id_orden}>
                {String(o.id_orden).slice(0, 8)} · {formatoFecha(o.fecha_inicial)} · {o.estado} · {o.descripcion_producto ?? "—"} · {formatoDinero(o.valor_total)}
              </li>
            ))}
          </ul>
        )
      ) : tab === "ventas" ? (
        ventas.length === 0 ? <p className="text-sm text-muted-foreground">Sin facturas.</p> : (
          <ul className="list-disc pl-5 text-sm">
            {ventas.map((v) => (
              <li key={v.id_venta}>
                {String(v.id_venta).slice(0, 8)} · {formatoFecha(v.fecha_venta)} · {v.facturado ? "Facturada" : "Sin facturar"} · {formatoDinero(v.valor_total)}
              </li>
            ))}
          </ul>
        )
      ) : (
        movimientos.length === 0 ? <p className="text-sm text-muted-foreground">Sin movimientos.</p> : (
          <ul className="list-disc pl-5 text-sm">
            {movimientos.map((m) => (
              <li key={m.id_movimiento}>
                {m.descripcion} · {formatoDinero(m.valor)} · {m.pagado ? "Pagado" : "Pendiente"}
              </li>
            ))}
          </ul>
        )
      )}
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
      ver={(fila) => <PanelCliente cliente={comoCliente(fila)} />}
      puedeAgregar={puede(["aCliente"])}
      puedeEditar={puede(["eCliente"])}
      puedeEliminar={puede(["dCliente"])}
    />
  );
}
