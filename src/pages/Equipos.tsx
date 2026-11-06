import { useCallback, useEffect, useState } from "react";
import CrudPage, { type Fila } from "../components/CrudPage";
import { useAuth } from "../contexts/AuthContext";
import { catalogosService, clientesService } from "../services";
import { supabase } from "../lib/supabase";
import { formatoFecha } from "../lib/fechas";
import type { Cliente, Equipo } from "../lib/types";

function comoEquipo(fila: Fila): Equipo {
  return fila as unknown as Equipo;
}

function DetalleEquipo({ equipo, clientes, marcas }: { equipo: Equipo; clientes: Cliente[]; marcas: any[] }) {
  const [historial, setHistorial] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    setCargando(true);
    supabase
      .from("equipos_orden")
      .select("*, ordenes_trabajo:orden_id(id_orden, fecha_inicial, estado, defecto, usuario_id, usuarios:usuario_id(nombre))")
      .eq("equipo_id", equipo.id_equipo)
      .order("id_equipo_orden", { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        setHistorial((data ?? []) as any[]);
      })
      .catch(() => setHistorial([]))
      .finally(() => setCargando(false));
  }, [equipo.id_equipo]);

  return (
    <div className="space-y-2">
      <div className="text-sm">
        <p><span className="font-medium">Equipo:</span> {equipo.equipo}</p>
        <p><span className="font-medium">Cliente:</span> {clientes.find((c) => c.id_cliente === equipo.cliente_id)?.nombre_cliente ?? "—"}</p>
        <p><span className="font-medium">Marca:</span> {marcas.find((m) => m.id_marca === equipo.marca_id)?.marca ?? "—"}</p>
        <p><span className="font-medium">Modelo:</span> {equipo.modelo ?? "—"}</p>
        <p><span className="font-medium">Color:</span> {equipo.color ?? "—"}</p>
        <p><span className="font-medium">Condición:</span> {equipo.condicion ?? "—"}</p>
        <p><span className="font-medium">Serie:</span> {equipo.numero_serie ?? "—"}</p>
        <p><span className="font-medium">Chasis:</span> {equipo.numero_chasis ?? "—"}</p>
        <p><span className="font-medium">Motor:</span> {equipo.numero_motor ?? "—"}</p>
      </div>
      <div>
        <h4 className="mb-1 text-sm font-semibold">Historial de órdenes</h4>
        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : historial.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin órdenes registradas.</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {historial.map((h: any) => (
              <li key={h.id_equipo_orden}>
                Orden {String(h.ordenes_trabajo?.id_orden ?? "").slice(0, 8)} · {formatoFecha(h.ordenes_trabajo?.fecha_inicial)} · {h.ordenes_trabajo?.estado ?? "—"} · {h.ordenes_trabajo?.usuarios?.nombre ?? "—"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Equipos() {
  const { puede } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [marcas, setMarcas] = useState<any[]>([]);

  useEffect(() => {
    clientesService.listar({ tamPagina: 200, columna: "nombre_cliente", ascendente: true }).then((r) => setClientes(r.datos as Cliente[])).catch(() => setClientes([]));
    catalogosService.marcas.listar({ tamPagina: 200, columna: "marca", ascendente: true }).then((r) => setMarcas((r as any).datos ?? [])).catch(() => setMarcas([]));
  }, []);

  const listar = useCallback(async ({ q, pagina, tamPagina }: { q: string; pagina: number; tamPagina: number }) => {
    const res = await catalogosService.equipos.listar(undefined, q, { pagina, tamPagina });
    return { datos: ((res as any).datos ?? []) as Fila[], total: (res as any).total ?? 0 };
  }, []);

  const guardar = useCallback(async (datos: Fila, id?: string) => {
    if (id) await catalogosService.equipos.editar(id, datos as any);
    else await catalogosService.equipos.crear(datos as any);
  }, []);

  const eliminar = useCallback(async (id: string) => {
    await catalogosService.equipos.eliminar(id);
  }, []);

  return (
    <CrudPage
      titulo="Equipos"
      singular="Equipo"
      descripcion="Equipos de clientes: serie, chasis, motor, condición e historial de órdenes."
      placeholderBusqueda="Equipo, serie o modelo…"
      clave={(f) => String((f as any).id_equipo)}
      columnas={[
        { clave: "cliente_id", etiqueta: "Cliente", render: (f) => clientes.find((c) => c.id_cliente === (f as any).cliente_id)?.nombre_cliente ?? "—" },
        { clave: "equipo", etiqueta: "Equipo" },
        { clave: "marca_id", etiqueta: "Marca", render: (f) => marcas.find((m) => m.id_marca === (f as any).marca_id)?.marca ?? "—" },
        { clave: "modelo", etiqueta: "Modelo" },
        { clave: "numero_serie", etiqueta: "Serie" },
        { clave: "color", etiqueta: "Color" },
        { clave: "condicion", etiqueta: "Condición" },
      ]}
      campos={[
        { clave: "cliente_id", etiqueta: "Cliente", tipo: "seleccion", obligatorio: true, opciones: clientes.map((c) => ({ valor: c.id_cliente, etiqueta: c.nombre_cliente })) },
        { clave: "equipo", etiqueta: "Equipo", obligatorio: true },
        { clave: "marca_id", etiqueta: "Marca", tipo: "seleccion", opciones: marcas.map((m) => ({ valor: m.id_marca, etiqueta: m.marca })) },
        { clave: "modelo", etiqueta: "Modelo" },
        { clave: "color", etiqueta: "Color" },
        { clave: "condicion", etiqueta: "Condición", tipo: "seleccion", opciones: [
          { valor: "Nuevo", etiqueta: "Nuevo" },
          { valor: "Usado", etiqueta: "Usado" },
          { valor: "Buen estado", etiqueta: "Buen estado" },
          { valor: "Regular", etiqueta: "Regular" },
          { valor: "Dañado", etiqueta: "Dañado" },
          { valor: "Fuera de servicio", etiqueta: "Fuera de servicio" },
        ] },
        { clave: "numero_serie", etiqueta: "Número de serie" },
        { clave: "numero_chasis", etiqueta: "Número de chasis" },
        { clave: "numero_motor", etiqueta: "Número de motor" },
        { clave: "descripcion", etiqueta: "Descripción", tipo: "parrafo" },
      ]}
      listar={listar}
      guardar={guardar}
      eliminar={eliminar}
      clave={(f) => String((f as any).id_equipo)}
      ver={(f) => <DetalleEquipo equipo={comoEquipo(f)} clientes={clientes} marcas={marcas} />}
      puedeAgregar={puede(["aCliente"])}
      puedeEditar={puede(["eCliente"])}
      puedeEliminar={puede(["dCliente"])}
    />
  );
}
