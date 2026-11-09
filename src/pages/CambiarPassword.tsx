import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { llamarRpc } from "../lib/crud";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function CambiarPassword() {
  const { debeCambiarContrasena } = useAuth();
  const navigate = useNavigate();
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const validar = (v: string) => v.length >= 8;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validar(nueva)) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (nueva !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setGuardando(true);
    try {
      await api.post("/api/auth/force-change-password", { nueva });
      await llamarRpc("finalizar_cambio_contrasena", {});
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña.");
    } finally {
      setGuardando(false);
    }
  };

  if (!debeCambiarContrasena) {
    return <div className="p-6">No es necesario cambiar la contraseña.</div>;
  }

  return (
    <div className="mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-xl font-semibold">Cambio obligatorio de contraseña</h1>
      <p className="text-sm text-muted-foreground">
        Por seguridad, debe establecer una nueva contraseña antes de continuar.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <Label>Nueva contraseña</Label>
          <Input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Confirmar contraseña</Label>
          <Input type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={guardando}>
          {guardando ? "Guardando..." : "Cambiar contraseña"}
        </Button>
      </form>
    </div>
  );
}
