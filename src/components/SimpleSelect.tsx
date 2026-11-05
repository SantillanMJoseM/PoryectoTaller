// ============================================================================
// Sistema Taller — Selector simple (TASK-0009 / AG-009)
// ============================================================================
// Select nativo estilizado con la paleta shadcn/Tailwind del proyecto.
// Se usa en los formularios de los módulos (estado, tipo, categoría, cliente…)
// porque mantiene el comportamiento clásico de panel administrativo y evita
// dependencias de portal/dropdown en los modales.
// ============================================================================

import { cn } from "../lib/utils";

export interface OpcionSelect {
  valor: string;
  etiqueta: string;
}

interface SimpleSelectProps {
  value: string;
  onChange: (valor: string) => void;
  opciones: OpcionSelect[];
  /** Opción vacía («— Seleccione —»); si se omite no se muestra. */
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export default function SimpleSelect({
  value,
  onChange,
  opciones,
  placeholder,
  disabled,
  id,
  className,
}: SimpleSelectProps) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm whitespace-nowrap transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.etiqueta}
        </option>
      ))}
    </select>
  );
}

/** Opción comodín para selects con placeholder («— Seleccione —»). */
export const OPCION_VACIA: OpcionSelect = { valor: "", etiqueta: "—" };
