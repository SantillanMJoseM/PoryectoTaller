// ============================================================================
// Sistema Taller — Servicio de Usuarios y Permisos (TASK-0007 / AG-008)
// ============================================================================
// SOURCE_PROMPT.md §10 y §11.
//  Usuarios: nombre, RG, CPF, dirección, teléfonos, correo; contraseña con
//    hash en Supabase Auth (bcrypt) — migración 0002 D-04 retiró la columna
//    insegura contrasena. Estado activo/inactivo, fecha de registro y
//    de expiración; asignación de grupo de permisos (permiso_id).
//  Permisos: grupos con códigos de actividad (aCliente, eOrden, …) en jsonb.
//    Desactivar grupo en vez de borrarlo cuando aún lo asignan usuarios.
// ============================================================================
import { crearCrud, llamarRpc } from "../lib/crud";
import { mensajeError } from "../lib/errores";
import { supabase } from "../lib/supabase";
import { validarUsuario } from "../lib/validaciones";
import {
  tienePermiso,
  tieneAlgunPermiso,
  normalizarCodigos,
} from "../lib/permisos";
import type { Permiso, Usuario } from "../lib/types";

const crudUsuarios = crearCrud<Usuario>("usuarios", "id_usuario", ["nombre", "correo", "cpf"]);
const crudPermisos = crearCrud<Permiso>("permisos", "id_permiso", ["nombre"]);

const SELECT_USUARIO = `*, permisos:permiso_id(*)`;

export const usuariosService = {
  listar: crudUsuarios.listar,
  contar: crudUsuarios.contar,

  async obtener(id: string): Promise<Usuario | null> {
    const { data, error } = await supabase
      .from("usuarios")
      .select(SELECT_USUARIO)
      .eq("id_usuario", id)
      .maybeSingle();
    if (error) throw new Error(mensajeError(error));
    return (data ?? null) as Usuario | null;
  },

  async crear(datos: Partial<Usuario>): Promise<Usuario> {
    if (!datos.nombre?.trim()) throw new Error("El nombre del usuario es obligatorio.");
    if (!validarCorreoOpcional(datos.correo))
      throw new Error("Correo electrónico inválido.");
    const errores = validarUsuario(datos);
    if (Object.keys(errores).length > 0)
      throw new Error("Datos inválidos: " + Object.values(errores).join(" "));
    return crudUsuarios.crear({ ...datos, estado_usuario: datos.estado_usuario ?? true });
  },

  /** Edita el perfil del usuario. La contraseña vive en Supabase Auth y se
   *  gestiona con autenticacionService.crearCredencial (requiere función de
   *  borde con rol de servicio — ver docs/backend/SERVICES.md). */
  async editar(id: string, datos: Partial<Usuario>): Promise<Usuario> {
    const campos: Record<string, string> = {};
    if ("correo" in datos) {
      if (!validarCorreoOpcional(datos.correo)) campos.correo = "Correo electrónico inválido.";
    }
    if (Object.keys(campos).length > 0)
      throw new Error("Datos inválidos: " + Object.values(campos).join(" "));
    return crudUsuarios.editar(id, datos);
  },

  eliminar: crudUsuarios.eliminar,

  /** Activa/desactiva el usuario (estado booleano del prompt). */
  async cambiarEstado(id: string, activo: boolean): Promise<Usuario> {
    return crudUsuarios.editar(id, { estado_usuario: activo } as Partial<Usuario>);
  },

  /** Asigna un grupo de permisos al usuario. */
  async asignarPermiso(id: string, idPermiso: string): Promise<Usuario> {
    return crudUsuarios.editar(id, { permiso_id: idPermiso } as Partial<Usuario>);
  },
};

function validarCorreoOpcional(correo?: string | null): boolean {
  if (!correo) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
}

export const permisosService = {
  listar: crudPermisos.listar,
  obtener: crudPermisos.obtener,
  contar: crudPermisos.contar,

  async crear(datos: Partial<Permiso>): Promise<Permiso> {
    if (!datos.nombre?.trim()) throw new Error("El nombre del grupo es obligatorio.");
    return crudPermisos.crear({
      ...datos,
      permisos: normalizarCodigos(datos.permisos ?? []),
      estado: datos.estado ?? true,
    });
  },

  async editar(id: string, datos: Partial<Permiso>): Promise<Permiso> {
    if ("permisos" in datos)
      datos.permisos = normalizarCodigos(datos.permisos ?? []);
    return crudPermisos.editar(id, datos);
  },

  /** Desactiva el grupo (no lo borra: puede tener usuarios asignados). */
  async desactivar(id: string): Promise<Permiso> {
    return crudPermisos.editar(id, { estado: false } as Partial<Permiso>);
  },
};

// ---------------------------------------------------------------------------
// Control de acceso en el cliente (el fuerte lo impone RLS)
// ---------------------------------------------------------------------------

/** ¿La sesión (usuario con su grupo) puede ejecutar el código pedido? */
export function puedeAcceder(
  usuario: (Usuario & { permisos?: Permiso | Permiso[] | null }) | null,
  codigoRequerido: string,
): boolean {
  if (!usuario) return false;
  const grupo = Array.isArray(usuario.permisos) ? usuario.permisos[0] : usuario.permisos;
  if (!grupo) return false;
  if (!grupo.estado) return false;
  return tienePermiso(grupo.permisos ?? [], codigoRequerido);
}

/** ¿Puede ver alguna de las acciones del módulo (nivel módulo)? */
export function puedeVerModulo(
  usuario: (Usuario & { permisos?: Permiso | Permiso[] | null }) | null,
  codigosModulo: string[],
): boolean {
  if (!usuario) return false;
  const grupo = Array.isArray(usuario.permisos) ? usuario.permisos[0] : usuario.permisos;
  if (!grupo || !grupo.estado) return false;
  return tieneAlgunPermiso(grupo.permisos ?? [], codigosModulo);
}

/** Sesiones de la tabla «sesiones» (RNF-S-08) para el usuario actual. */
export const sesionesService = {
  registrarAdministrador: (idUsuario: string) =>
    llamarRpc<string>("sesion_registrar", { p_tipo: "administrador", p_sujeto: idUsuario }),
  registrarCliente: (idCliente: string, duracionHoras = 24) =>
    llamarRpc<string>("sesion_registrar", {
      p_tipo: "cliente",
      p_sujeto: idCliente,
      p_duracion_horas: duracionHoras,
    }),
  cerrar: (idSesion: string) =>
    llamarRpc("sesion_cerrar", { p_sesion: idSesion }),
  purgar: () => llamarRpc<number>("sesion_purgar"),
};

/** Contraseña para la credencial de acceso (fuente única: lib/validaciones). */
export { validarContrasena } from "../lib/validaciones";