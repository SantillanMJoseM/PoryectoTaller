import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";
import jsPDF from "jspdf";

export default function Reportes() {
  const [msg, setMsg] = useState("");
  const gen = async (table: string) => {
    const { data } = await supabase.from(table).select("*").limit(200);
    const doc = new jsPDF();
    doc.text(`Reporte ${table}`, 10, 10);
    let y = 20;
    (data ?? []).forEach((r: any) => {
      doc.text(JSON.stringify(r).slice(0, 100), 10, y);
      y += 6;
      if (y > 280) { doc.addPage(); y = 10; }
    });
    doc.save(`${table}.pdf`);
    setMsg(`PDF generado para ${table}`);
  };
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Reportes</h2>
      <div className="flex flex-wrap gap-2">
        {["clientes","productos","servicios","ordenes_trabajo","ventas","movimientos_financieros"].map((t) => (
          <Button key={t} onClick={() => gen(t)}>{t}</Button>
        ))}
      </div>
      {msg && <p className="mt-4 text-sm">{msg}</p>}
    </div>
  );
}
