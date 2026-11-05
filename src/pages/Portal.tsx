import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function Portal() {
  const [email, setEmail] = useState("");
  const [doc, setDoc] = useState("");
  const [cliente, setCliente] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const login = async () => {
    const { data } = await supabase.from("clientes").select("*").eq("correo", email).eq("documento", doc).maybeSingle();
    if (data) { setCliente(data); setMsg(""); } else setMsg("No coincide");
  };
  if (cliente) {
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold">Portal del cliente</h2>
        <p>Bienvenido {cliente.nombre_cliente}</p>
        <Button className="mt-4" onClick={() => setCliente(null)}>Cerrar sesión</Button>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-96 space-y-4 rounded bg-white p-6 shadow">
        <h2 className="text-xl font-bold">Portal del cliente</h2>
        <div><Label>Correo</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label>Documento</Label><Input value={doc} onChange={(e) => setDoc(e.target.value)} /></div>
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        <Button className="w-full" onClick={login}>Ingresar</Button>
      </div>
    </div>
  );
}
