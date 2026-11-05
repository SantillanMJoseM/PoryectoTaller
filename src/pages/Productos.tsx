// ============================================================================
// Sistema Taller — Productos (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §3: campos de compra/venta, unidad, stock y stock mínimo;
// alerta de stock bajo (RF-016, vista v_stock_alerta). El stock no se edita a
// mano: se descuenta al agregar el producto a una orden/venta y se incrementa
// al quitarlo; el único ajuste directo autorizado es productosService.
// ajustarStock(p_delta) — botón «Ajustar stock» con confirmación.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import CrudPage, { type Fila } from "../components/CrudPage";
import ConfirmDialog from "../components/ConfirmDialog";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../contexts/AuthContext";
import { productosService } from "../services";
import type { Producto } from "../lib/types";

function comoProducto(fila: Fila): Producto {
  return fila as unknown as Producto;
}

export default function Productos() {
  const { puede } = useAuth();
  const [alertas, setAlertas] = useState<
    { id_producto: string; descripcion: string; stock: number; stock_minimo: number; faltante: number }[]
  >([]);

  useEffect(() => {
    productosService
      .alertaStock()
      .then(setAlertas)
      .catch(() => setAlertas([]));
  }, []);

  // Ajuste de stock autorizado (única vía sin orden/venta).
  const [ajuste, setAjuste] = useState<Fila | null>(null);
  const [delta, setDelta] = useState("");
  const [ajustando, setAjustando] = useState(false);
  const [errorAjuste, setErrorAjuste] = useState<string | null>(null);

  const listar = useCallback(
    async ({ q, pagina, tamPagina }: { q: string; pagina: number; tamPagina: number }) => {
      const res = await productosService.listar({ q, pagina, tamPagina });
      return { datos: res.datos as unknown as Fila[], total: res.total };
    },
    [],
  );

  const guardar = useCallback(async (datos: Fila, id?: string) => {
    const p = datos as unknown as Partial<Producto>;
    if (id) await productosService.editar(id, p);
    else await productosService.crear(p);
  }, []);

  const eliminar = useCallback(async (id: string) => {
    await productosService.eliminar(id);
  }, []);

  const aplicarAjuste = async () => {
    if (!ajuste) return;
    const valor = Number(delta.replace(",", "."));
    if (!Number.isFinite(valor) || valor === 0) {
      setErrorAjuste("Ingrese un valor distinto de cero (positivo o negativo).");
      return;
    }
    setAjustando(true);
    setErrorAjuste(null);
    try {
      await productosService.ajustarStock(comoProducto(ajuste).id_producto, valor);
      setAjuste(null);
      setDelta("");
      await productosService.alertaStock().then(setAlertas).catch(() => undefined);
      await listar({ q: "", pagina: 1, tamPagina: 1 });
    } finally {
      setAjustando(false);
    }
  };

  const cabecera =
    alertas.length > 0 ? (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/40">
        <div className="flex items-center gap-2">
          <Badge variant="destructive">Alerta de stock</Badge>
          <span className="text-sm font-medium">
            {alertas.length} producto(s) con stock bajo
          </span>
        </div>
        <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
          {alertas.slice(0, 5).map((a) => (
            <li key={a.id_producto}>
              {a.descripcion}: quedan {a.stock} (mínimo {a.stock_minimo})
            </li>
          ))}
          {alertas.length > 5 && <li>… y {alertas.length - 5} más</li>}
        </ul>
      </div>
    ) : undefined;

  return (
    <>
      <CrudPage
        titulo="Productos"
        singular="Producto"
        descripcion="Compra/venta, unidad, stock y stock mínimo con alerta de faltante. El stock se mueve con órdenes y ventas."
        placeholderBusqueda="Buscar por descripción…"
        clave={(f) => String(comoProducto(f).id_producto)}
        columnas={[
          { clave: "descripcion", etiqueta: "Descripción" },
          { clave: "unidad", etiqueta: "Unidad" },
          { clave: "precio_compra", etiqueta: "Precio compra", formato: "dinero" },
          { clave: "precio_venta", etiqueta: "Precio venta", formato: "dinero" },
          {
            clave: "stock",
            etiqueta: "Stock",
            render: (f) => {
              const p = comoProducto(f);
              const bajo = Number(p.stock) < Number(p.stock_minimo);
              return (
                <span className="flex items-center gap-2">
                  {String(p.stock)}
                  {bajo && <Badge variant="destructive">Bajo</Badge>}
                </span>
              );
            },
          },
          { clave: "stock_minimo", etiqueta: "Stock mín." },
          { clave: "salida", etiqueta: "Salida", formato: "booleano" },
          { clave: "entrada", etiqueta: "Entrada", formato: "booleano" },
        ]}
        campos={[
          { clave: "descripcion", etiqueta: "Descripción", obligatorio: true },
          { clave: "unidad", etiqueta: "Unidad", placeholder: "Unidad, metros, piezas…" },
          { clave: "precio_compra", etiqueta: "Precio de compra", tipo: "dinero" },
          { clave: "precio_venta", etiqueta: "Precio de venta", tipo: "dinero" },
          { clave: "stock_minimo", etiqueta: "Stock mínimo", tipo: "numero" },
          { clave: "salida", etiqueta: "Habilitado para salida (venta/orden)", tipo: "booleano" },
          { clave: "entrada", etiqueta: "Habilitado para entrada (compra)", tipo: "booleano" },
        ]}
        listar={listar}
        guardar={guardar}
        eliminar={eliminar}
        cabecera={cabecera}
        acciones={(f) =>
          puede(["eProducto"]) ? (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Ajustar stock"
              onClick={() => {
                setAjuste(f);
                setDelta("");
                setErrorAjuste(null);
              }}
            >
              ±
            </Button>
          ) : null
        }
        puedeAgregar={puede(["aProducto"])}
        puedeEditar={puede(["eProducto"])}
        puedeEliminar={puede(["dProducto"])}
      />

      <ConfirmDialog
        abierto={ajuste !== null}
        titulo="Ajustar stock"
        mensaje={
          ajuste
            ? `Producto “${comoProducto(ajuste).descripcion}” — stock actual ${comoProducto(ajuste).stock}.`
            : ""
        }
        textoConfirmar="Aplicar"
        ocupado={ajustando}
        onCerrar={() => setAjuste(null)}
        onConfirmar={() => void aplicarAjuste()}
      >
        <div className="-mt-2 mb-2 space-y-1">
          <Label>Variación (+/-)</Label>
          <Input
            type="number"
            step="1"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="p. ej. 10 para sumar, -3 para restar"
          />
          {errorAjuste && <p className="text-xs text-destructive">{errorAjuste}</p>}
          <p className="text-xs text-muted-foreground">
            El ajuste queda registrado en el movimiento de inventario. El stock normal se
            descuenta/devuelve con órdenes de trabajo y ventas.
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}
