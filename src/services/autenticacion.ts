// ============================================================================
// Sistema Taller — Servicio de Autenticación administrativa (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md «Autenticación y sesiones»:
//   • Login administrativo por correo y contraseña (Supabase Auth: hash
//     bcrypt/argon2 gestionado por la base de datos).
//   • Sesión persistente con expiración + cerrar sesión.
//   • Control de acceso por permisos: al iniciar sesión se guarda el nombre y
//     el grupo de permisos del usuario del taller (tabla usuarios ↔ permisos).
//   • Cada inicio registra una fila en la tabla «sesiones» (RPC
//     sesion_registrar, 12 h para administradores).
// El rol del JWT (app_metadata.rol) lo asigna la configuración de Supabase
// (auth.hooks o creación por panel); ver docs/backend/SERVICES.md.
// ============================================================================

import { supabase } from "../lib/supabase";
import { mensajeError } from "../lib/errores";
import { tieneAlgunPermiso } from "../lib/permisos";
import { llamarRpc, crearCrud } from "../lib/crud";
import type { Permiso, Usuario } from "../lib/types";

export interface SesionAdmin {
  idSupabase: string; // auth.users.id
  correo: string;
  usuario?: (Usuario & { permisos: Permiso | Permiso[] | null }) | null;
  idSesion?: string; // fila de la tabla sesiones
  permisos: string[];
}

export const autenticacionService = {
  /** Login administrativo. Devuelve la sesión con los permisos del usuario.
   *  Error en español si el correo o la contraseña son inválidos. */
  async iniciar(correo: string, contrasena: string): Promise<SesionAdmin> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo.trim(),
      password: contrasena,
    });
    if (error) {
      const m = /invalid login credentials/i.test(error.message)
        ? "Correo o contraseña incorrectos."
        : mensajeError(error);
      throw new Error(m);
    }
    const authUser = data.user;
    if (!authUser?.email) throw new Error("Credenciales incompletas.");

    // Datos del taller (tabla usuarios) para nombre y permisos.
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("*, permisos:id_permiso(*)")
      .eq("correo", authUser.email)
      .maybeSingle();

    const grupo = Array.isArray(usuario?.permisos)
      ? (usuario as { permisos: Permiso[] }).permisos[0]
      : usuario?.permisos;

    // Guard: usuario sin grupo o desactivado no puede entrar.
    if (!usuario || !(usuario as { estado_usuario?: boolean }).estado_usuario) {
      await supabase.auth.signOut();
      throw new Error("Usuario inexistente o inactivo.");
    }
    if (!grupo || !grupo.estado) {
      await supabase.auth.signOut();
      throw new Error("El usuario no tiene un grupo de permisos activo.");
    }

    // Registro de sesión en la tabla sesiones (12 h admin).
    let idSesion: string | undefined;
    try {
      idSesion = (await llamarRpc<string>("sesion_registrar", {
        p_tipo: "administrador",
        p_sujeto: (usuario as { id_usuario: string }).id_usuario,
      })) ?? undefined;
    } catch {
      // La RPC existe en la migración 0004; si falla (por ejemplo, sin rol),
      // la sesión Supabase sigue siendo válida y el error no bloquea el login.
    }

    return {
      idSupabase: authUser.id,
      correo: authUser.email,
      usuario: (usuario ?? null) as (Usuario & { permisos: Permiso | Permiso[] | null }) | null,
      idSesion,
      permisos: grupo.permisos ?? [],
    };
  },

  /** Cierra la sesión de Supabase y desactiva la fila de «sesiones». */
  async cerrar(idSesion?: string): Promise<void> {
    if (idSesion) {
      try {
        await llamarRpc("sesion_cerrar", { p_sesion: idSesion });
      } catch {
        // no impedir el cierre por un fallo en la tablita de sesiones
      }
    }
    await supabase.auth.signOut();
  },

  /** Sesión actual de Supabase (persistente, con expiración automática). */
  async sesionActual(): Promise<SesionAdmin | null> {
    const { data } = await supabase.auth.getSession();
    const authUser = data.session?.user;
    if (!authUser?.email) return null;
    const { data: usuario } = await supabase
      .from("usuarios")
      .select("*, permisos:id_permiso(*)")
      .eq("correo", authUser.email)
      .maybeSingle();
    const grupo = Array.isArray(usuario?.permisos)
      ? (usuario as { permisos: Permiso[] }).permisos[0]
      : usuario?.permisos;
    return {
      idSupabase: authUser.id,
      correo: authUser.email,
      usuario: (usuario ?? null) as (Usuario & { permisos: Permiso | Permiso[] | null }) | null,
      permisos: grupo?.estado ? (grupo.permisos ?? []) : [],
    };
  },

  /** ¿El usuario en sesión tiene alguno de los códigos pedidos? */
  async puede(algunos: string[]): Promise<boolean> {
    const s = await this.sesionActual();
    if (!s) return false;
    return tieneAlgunPermiso(s.permisos, algunos);
  },

  /** Crear la credencial de acceso de un usuario del taller. ROPA: exige una
   *  función de borde con clave de servicio (crear-usuario-admin); desde el
   *  navegador no se expone esa clave (SOURCE_PROMPT «No exponer credenciales»). */
  async crearCredencial(correo: string, contrasena: string): Promise<void> {
    const errorContrasena = validarContrasenaValor(contrasena);
    if (errorContrasena) throw new Error(errorContrasena);
    const { error } = await supabase.functions.invoke("crear-usuario-admin", {
      body: { correo, contrasena },
    });
    if (error) {
      throw new Error(
        "No se pudo crear la credencial de acceso. Configure la función de borde «crear-usuario-admin» (Supabase Edge Function con rol de servicio).",
      );
    }
  },
};

function validarContrasenaValor(clave: string): string | null {
  if (!clave || clave.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
  return null;
}

/** Acceso de solo lectura a la tabla de sesiones (para administración). */
export const sesionesTabla = crearCrud("sesiones", "id_sesion");
