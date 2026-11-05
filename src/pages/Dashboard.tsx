import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export default function Dashboard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    (async () => {
      const tables = ["clientes", "productos", "servicios", "ordenes_trabajo", "ventas", "movimientos_financieros"];
      const res: Record<string, number> = {};
      for (const t of tables) {
        const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
        res[t] = count ?? 0;
      }
      setCounts(res);
    })();
  }, []);
  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Panel principal</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Object.entries(counts).map(([k, v]) => (
          <Card key={k}>
            <CardHeader><CardTitle className="text-sm capitalize">{k.replace("_", " ")}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{v}</p></CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
