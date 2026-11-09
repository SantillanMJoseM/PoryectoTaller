import { api, setTokens, clearTokens } from "../lib/api";
import { mensajeError } from "../lib/errores";
import { tieneAlgunPermiso } from "../lib/permisos";
import { llamarRpc, crearCrud } from "../lib/crud";
import type { Permiso, Usuario } from "../lib/types";

export interface SesionAdmin {
  idSupabase: string;
  correo: string;
  usuario?: (Usuario & { permisos: Permiso | Permiso[] | null }) | null;
  idSesion?: string;
  permisos: string[];
}

export const autenticacionService = {
  async iniciar(correo: string, contrasena: string): Promise<SesionAdmin> {
    let data: any;
    try {
      data = await api.post("/api/auth/login", { correo: correo.trim(), contrasena });
    } catch (e: any) {
      const m = /invalid/i.test(e?.message ?? "") ? "Correo o contraseña incorrectos." : (e?.message ?? mensajeError(e));
      throw new Error(m);
    }
    setTokens(data.accessToken, data.refreshToken);
    const user = data.user;
    // load full perfil from backend
    let perfil: any = null;
    try {
      const list = await api.get(`/api/usuarios?correo=${encodeURIComponent(user.correo)}`);
      perfil = (list?.datos ?? [])[0] ?? null;
    } catch {}
    // attach permisos group
    let grupo: any = null;
    if (perfil?.permisoId) {
      try { grupo = await api.get(`/api/permisos/${perfil.permisoId}`); } catch {}
    }
    const permisos = data.user?.permisos ?? grupo?.permisos ?? [];
    if (perfil && !perfil.estadoUsuario) {
      clearTokens();
      throw new Error("Usuario inexistente o inactivo.");
    }
    if (!grupo || grupo.estado === false) {
      // allow if permisos present
    }
    let idSesion: string | undefined;
    try {
      idSesion = (await llamarRpc<string>("sesion_registrar", { p_tipo: "administrador", p_sujeto: user.id })) ?? undefined;
    } catch {}
    return {
      idSupabase: user.id,
      correo: user.correo,
      usuario: perfil ? ({ ...perfil, permisos: grupo } as any) : null,
      idSesion,
      permisos,
    };
  },
  async cerrar(idSesion?: string): Promise<void> {
    if (idSesion) {
      try { await llamarRpc("sesion_cerrar", { p_sesion: idSesion }); } catch {}
    }
    try { await api.post("/api/auth/logout", {}); } catch {}
    clearTokens();
  },
  async sesionActual(): Promise<SesionAdmin | null> {
    const t = localStorage.getItem("st_access_token");
    if (!t) return null;
    try {
      const me = await api.get("/api/auth/me");
      if (me.tipo !== "administrador") return null;
      const user = me.user;
      let grupo = user?.permiso ?? null;
      const permisos = me.permisos ?? (Array.isArray(grupo?.permisos) ? grupo.permisos : []);
      return {
        idSupabase: user.idUsuario ?? user.id,
        correo: user.correo,
        usuario: user ? ({ ...user, permisos: grupo } as any) : null,
        permisos,
      };
    } catch {
      return null;
    }
  },
  async puede(algunos: string[]): Promise<boolean> {
    const s = await this.sesionActual();
    if (!s) return false;
    return tieneAlgunPermiso(s.permisos, algunos);
  },
  async crearCredencial(correo: string, contrasena: string): Promise<void> {
    await api.post("/api/auth/crear-credencial", { correo, contrasena });
  },
};

export const sesionesTabla = crearCrud("sesiones", "id_sesion");
