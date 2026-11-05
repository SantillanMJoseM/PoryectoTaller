// ============================================================================
// Sistema Taller — Diálogo de confirmación (TASK-0009 / AG-009)
// ============================================================================
// Confirmaciones en español para acciones destructivas o de negocio
// (eliminar registros, facturar ordenes/ventas, marcar pagos, limpiar logs…).
// ============================================================================

import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface ConfirmDialogProps {
  abierto: boolean;
  titulo?: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  variante?: "default" | "destructive";
  ocupado?: boolean;
  /** Contenido adicional entre el mensaje y los botones (campos del diálogo). */
  children?: React.ReactNode;
  onCerrar: () => void;
  onConfirmar: () => void;
}

export default function ConfirmDialog({
  abierto,
  titulo = "Confirmar",
  mensaje,
  textoConfirmar = "Confirmar",
  textoCancelar = "Cancelar",
  variante = "destructive",
  ocupado = false,
  children,
  onCerrar,
  onConfirmar,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={abierto}
      onOpenChange={(o) => {
        if (!o && !ocupado) onCerrar();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{mensaje}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={ocupado}>
            {textoCancelar}
          </Button>
          <Button variant={variante} onClick={onConfirmar} disabled={ocupado}>
            {ocupado ? "Procesando…" : textoConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
