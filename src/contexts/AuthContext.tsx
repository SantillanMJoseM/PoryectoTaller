import { createContext, useContext, useEffect, useState } from "react";
import { mensajeError } from "../lib/errores";
import {
  autenticacionService,
  type SesionAdmin,
} from "../services/autenticacion";

interface AuthCtx {
  user: any | null;
  sesion: SesionAdmin | null;
  loading: boolean;
  permisos: string[];
  signIn: (correo: string, contrasena: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  puede: (codigos: string[]) => boolean;
  debeCambiarContrasena: boolean;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  sesion: null,
  loading: true,
  permisos: [],
  signIn: async () => null,
  signOut: async () => {},
  puede: () => false,
  debeCambiarContrasena: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [sesion, setSesion] = useState<SesionAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [debeCambiarContrasena, setDebeCambiarContrasena] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await autenticacionService.sesionActual();
        setSesion(s);
        setDebeCambiarContrasena(Boolean(s?.usuario?.debe_cambiar_contrasena ?? s?.usuario?.debeCambiarContrasena));
      } catch {
        setSesion(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = async (correo: string, contrasena: string): Promise<string | null> => {
    try {
      const s = await autenticacionService.iniciar(correo, contrasena);
      setSesion(s);
      setDebeCambiarContrasena(Boolean(s?.usuario?.debe_cambiar_contrasena ?? s?.usuario?.debeCambiarContrasena));
      return null;
    } catch (error) {
      return mensajeError(error);
    }
  };

  const signOut = async () => {
    try { await autenticacionService.cerrar(sesion?.idSesion); } finally {
      setSesion(null);
    }
  };

  const puede = (codigos: string[]) => {
    const lista = sesion?.permisos ?? [];
    if (!codigos.length) return lista.length > 0;
    return codigos.some((c) => lista.includes(c));
  };

  return (
    <Ctx.Provider value={{ user: sesion ? { email: sesion.correo } : null, sesion, loading, permisos: sesion?.permisos ?? [], signIn, signOut, puede, debeCambiarContrasena }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
