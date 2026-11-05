import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

export default function LoginPage() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const e2 = await signIn(email, password);
    setLoading(false);
    if (e2) setErr(e2); else nav("/");
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <Card className="w-96">
        <CardHeader><CardTitle>Ingreso administrativo</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div><Label>Correo</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Contraseña</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <Button className="w-full" disabled={loading}>{loading ? "Ingresando..." : "Ingresar"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
