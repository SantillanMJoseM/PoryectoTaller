// ============================================================================
// Sistema Taller — QA: Autenticación administrativa (TASK-0010 / AG-012)
// ============================================================================
// SOURCE_PROMPT.md «Autenticación y sesiones» cubierto:
//   • Login administrativo por correo + contraseña (Supabase Auth).
//   • Mensaje en español cuando las credenciales fallan.
//   • Guard: usuario inexistente/inactivo o grupo de permisos inactivo no
//     entra (y se cierra la sesión de Supabase).
//   • El login devuelve los permisos del grupo del usuario (códigos de
//     actividad usados por el menú).
//   • Registro de sesión en la tabla «sesiones» vía RPC sesion_registrar.
//   • Cerrar sesión: sesion_cerrar + signOut.
// ============================================================================

import { beforeEach, describe, expect, it, vi } from "vitest";
import { falso } from "../helpers/supabaseFalso";
import { autenticacionService } from "../../src/services/autenticacion";

vi.mock("../../src/lib/supabase", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/lib/supabase")>();
  const mod = await import("../helpers/supabaseFalso");
  return { ...original, supabase: mod.falso.supabase };
});

beforeEach(() => {
  falso.limpiar();
  falso.estadoAuth.usuario = { id: "auth-1", email: "admin@taller.com" };
});

describe("login administrativo", () => {
  it("credenciales inválidas → mensaje en español", async () => {
    falso.estadoAuth.errorIniciar = { message: "Invalid login credentials" };
    await expect(autenticacionService.iniciar("admin@taller.com", "mal")).rejects.toThrow(
      "Correo o contraseña incorrectos.",
    );
  });

  it("login correcto con permisos: sesion_registrar y grupo de códigos", async () => {
    falso.establecer("usuarios", [
      {
        id_usuario: "u-1",
        correo: "admin@taller.com",
        nombre: "Admin",
        estado_usuario: true,
        permisos: { id_permiso: "p-1", nombre: "Administrador", estado: true, permisos: "aCliente,eCliente,vCliente" },
      },
    ]);
    const sesion = await autenticacionService.iniciar("admin@taller.com", "secreta");
    expect(sesion.idSupabase).toBe("auth-1");
    // El grupo entrega los códigos de actividad (texto separado por comas o lista).
    expect(String(sesion.permisos)).toContain("aCliente");
    expect(String(sesion.permisos)).toContain("eCliente");
    expect(String(sesion.permisos)).toContain("vCliente");
    expect(falso.ultimaRpc("sesion_registrar")?.args.p_tipo).toBe("administrador");
  });

  it("usuario inexistente/inactivo → signOut + error", async () => {
    falso.establecer("usuarios", []); // correo sin fila en la tabla del taller
    await expect(autenticacionService.iniciar("admin@taller.com", "secreta")).rejects.toThrow(
      "Usuario inexistente o inactivo.",
    );
    expect(falso.llamadasAuth).toContain("signOut");
  });

  it("usuario desactivado (estado_usuario false) → rechazo", async () => {
    falso.establecer("usuarios", [
      { id_usuario: "u-2", correo: "admin@taller.com", estado_usuario: false, permisos: { estado: true, permisos: "vCliente" } },
    ]);
    await expect(autenticacionService.iniciar("admin@taller.com", "secreta")).rejects.toThrow(
      "Usuario inexistente o inactivo.",
    );
    expect(falso.llamadasAuth).toContain("signOut");
  });

  it("grupo de permisos inactivo → rechazo específico", async () => {
    falso.establecer("usuarios", [
      { id_usuario: "u-3", correo: "admin@taller.com", estado_usuario: true, permisos: { estado: false, permisos: "vCliente" } },
    ]);
    await expect(autenticacionService.iniciar("admin@taller.com", "secreta")).rejects.toThrow(
      "El usuario no tiene un grupo de permisos activo.",
    );
    expect(falso.llamadasAuth).toContain("signOut");
  });

  it("sin RPC de sesiones el login no se bloquea (degradación suave)", async () => {
    falso.establecer("usuarios", [
      { id_usuario: "u-1", correo: "admin@taller.com", estado_usuario: true, permisos: { estado: true, permisos: "vCliente" } },
    ]);
    const sesion = await autenticacionService.iniciar("admin@taller.com", "secreta");
    expect(sesion.idSesion).toBeUndefined();
    expect(String(sesion.permisos)).toContain("vCliente");
  });
});

describe("cerrar sesión", () => {
  it("sesion_cerrar + signOut", async () => {
    await autenticacionService.cerrar("ses-9");
    expect(falso.ultimaRpc("sesion_cerrar")?.args).toEqual({ p_sesion: "ses-9" });
    expect(falso.llamadasAuth).toContain("signOut");
  });

  it("sin id de sesión solo hace signOut", async () => {
    await autenticacionService.cerrar();
    expect(falso.rpcLlamadas).toHaveLength(0);
    expect(falso.llamadasAuth).toContain("signOut");
  });
});
