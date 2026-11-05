import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

interface Col { key: string; label: string }
interface Field { key: string; label: string; type?: string }

export default function SimpleCrud({ title, table, pk, columns, fields }: { title: string; table: string; pk: string; columns: Col[]; fields: Field[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const { data } = await supabase.from(table).select("*").order(pk, { ascending: false }).limit(100);
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await supabase.from(table).insert(form);
    setLoading(false);
    setOpen(false);
    setForm({});
    load();
  };

  const remove = async (id: any) => {
    if (!confirm("Eliminar?")) return;
    await supabase.from(table).delete().eq(pk, id);
    load();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger><Button>Nuevo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo {title}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input type={f.type || "text"} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                </div>
              ))}
              <Button disabled={loading}>{loading ? "Guardando..." : "Guardar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r[pk]}>
              {columns.map((c) => <TableCell key={c.key}>{String(r[c.key] ?? "")}</TableCell>)}
              <TableCell><Button variant="destructive" size="sm" onClick={() => remove(r[pk])}>Eliminar</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
