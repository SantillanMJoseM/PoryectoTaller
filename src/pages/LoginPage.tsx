// ============================================================================
// Sistema Taller — Login administrativo (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md «Autenticación y sesiones»: login por correo electrónico y
// contraseña (Supabase Auth, hash bcrypt), sesión persistente con expiración,
// cerrar sesión. El portal de cliente es una zona separada: /portal (correo +
// documento). Enlaces visibles para coordinar las dos entradas.
// ============================================================================

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";

export default function LoginPage() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!email.trim() || !password) {
      setErr("Ingrese su correo y su contraseña.");
      return;
    }
    setLoading(true);
    const e2 = await signIn(email.trim(), password);
    setLoading(false);
    if (e2) setErr(e2);
    else nav("/");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Sistema Taller</CardTitle>
          <CardDescription>Ingreso administrativo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1">
              <Label>Correo electrónico</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@taller.com"
                autoComplete="username"
              />
            </div>
            <div className="space-y-1">
              <Label>Contraseña</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            ¿Es un cliente?{" "}
            <Link to="/portal" className="underline underline-offset-2 hover:text-foreground">
              Ingrese al portal del cliente
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
