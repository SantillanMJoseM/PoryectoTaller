// ============================================================================
// Sistema Taller — Contexto de sesión (TASK-0008 / AG-011)
// ============================================================================
// SOURCE_PROMPT.md «Autenticación y sesiones»:
//   • Login administrativo por correo y contraseña (Supabase Auth).
//   • Sesión persistente con expiración + cerrar sesión.
//   • Control de acceso por permisos (códigos de actividad, §11).
// Delega la lógica en autenticacionService (supabase Auth + tabla «usuarios»
// ↔ «permisos» + registro de sesión en la tabla «sesiones»). El portal del
// cliente usa la misma sesión de Supabase con rol cliente (RLS lo separa).
//
// Compatibilidad UI: expone user/loading/signIn/signOut (Layout, App,
// LoginPage) y añade sesion/permisos/puede para el menú por permisos.
// ============================================================================

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/errores";
import { llamarRpc } from "../lib/crud";
import type { User } from "@supabase/supabase-js";
import {
  autenticacionService,
  type SesionAdmin,
} from "../services/autenticacion";

interface AuthCtx {
  /** Usuario de Supabase en sesión (null = sin sesión). */
  user: User | null;
  /** Sesión extendida del taller (datos de «usuarios» + permisos). */
  sesion: SesionAdmin | null;
  loading: boolean;
  permisos: string[];
  /** Inicia sesión administrativa. Devuelve el error (null si es exitosa). */
  signIn: (correo: string, contrasena: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** ¿La sesión tiene alguno de los códigos pedidos (p. ej. ["aCliente", "vCliente"])? */
  puede: (codigos: string[]) => boolean;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  sesion: null,
  loading: true,
  permisos: [],
  signIn: async () => null,
  signOut: async () => {},
  puede: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sesion, setSesion] = useState<SesionAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let montado = true;

    // Restablecer la sesión persistente de Supabase (si la hay, recargar los
    // datos del taller para permisos vigentes y registrar la fila en
    // «sesiones»: SOURCE_PROMPT «sesiones: tabla de sesiones de base de datos»).
    (async () => {
      try {
        const s = await autenticacionService.sesionActual();
        if (!montado) return;
        if (s && !s.idSesion && s.usuario?.id_usuario) {
          // No bloquea el login: es una anotación operativa en «sesiones».
          try {
            const id = await llamarRpc<string>("sesion_registrar", {
              p_tipo: "administrador",
              p_sujeto: s.usuario.id_usuario,
            });
            if (montado && id) s.idSesion = id;
          } catch {
            // Sin RPC disponible, la sesión Supabase sigue siendo válida.
          }
        }
        if (!montado) return;
        setSesion(s);
        setUser(s ? await usuarioSupabase() : null);
      } catch {
        if (!montado) return;
        setSesion(null);
        setUser(null);
      } finally {
        if (montado) setLoading(false);
      }
    })();

    // Cambios de sesión de Supabase (login en otra pestaña, expiración…).
    const { data: sub } = supabase.auth.onAuthStateChange((_evento, s) => {
      setUser(s?.user ?? null);
      if (!s?.user) setSesion(null);
    });

    return () => {
      montado = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (correo: string, contrasena: string): Promise<string | null> => {
    try {
      const s = await autenticacionService.iniciar(correo, contrasena);
      setSesion(s);
      setUser(await usuarioSupabase());
      return null;
    } catch (error) {
      return mensajeError(error);
    }
  };

  const signOut = async () => {
    try {
      await autenticacionService.cerrar(sesion?.idSesion);
    } finally {
      setSesion(null);
      setUser(null);
    }
  };

  const puede = (codigos: string[]) => {
    const lista = sesion?.permisos ?? [];
    if (!codigos.length) return lista.length > 0;
    return codigos.some((c) => lista.includes(c));
  };

  return (
    <Ctx.Provider value={{ user, sesion, loading, permisos: sesion?.permisos ?? [], signIn, signOut, puede }}>
      {children}
    </Ctx.Provider>
  );
}

/** Usuario de Supabase actual (para la cabecera y los guards de rutas). */
async function usuarioSupabase(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export const useAuth = () => useContext(Ctx);
