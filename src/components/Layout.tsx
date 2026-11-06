// ============================================================================
// Sistema Taller — Plantilla del panel (TASK-0009 / AG-009)
// ============================================================================
// Diseño responsive tipo panel administrativo clásico (SOURCE_PROMPT):
// barra lateral fija en escritorio y retráctil en móvil, cabecera superior con
// usuario conectado y menú filtrado por permisos (useAuth().puede, códigos de
// actividad §11). La autorización real la impone RLS; esto solo oculta módulos.
// ============================================================================

import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { MenuIcon, XIcon, LogOutIcon } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";

interface ItemMenu {
  to: string;
  etiqueta: string;
  codigos: string[];
}

/** Menú con los 16 módulos del SOURCE_PROMPT + Panel principal. */
const MENU: ItemMenu[] = [
  { to: "/", etiqueta: "Panel principal", codigos: [] },
  { to: "/clientes", etiqueta: "Clientes", codigos: ["vCliente", "aCliente", "eCliente", "dCliente", "rCliente"] },
  { to: "/productos", etiqueta: "Productos", codigos: ["vProducto", "aProducto", "eProducto", "dProducto", "rProducto"] },
  { to: "/servicios", etiqueta: "Servicios", codigos: ["vServicio", "aServicio", "eServicio", "dServicio"] },
  { to: "/ordenes", etiqueta: "Órdenes de trabajo", codigos: ["vOrden", "aOrden", "eOrden", "dOrden", "rOrden"] },
  { to: "/ventas", etiqueta: "Ventas", codigos: ["vVenta", "aVenta", "eVenta", "dVenta", "rVenta"] },
  { to: "/garantias", etiqueta: "Garantías", codigos: ["vGarantia", "aGarantia", "eGarantia", "dGarantia"] },
  { to: "/financiero", etiqueta: "Financiero", codigos: ["vMovimiento", "aMovimiento", "eMovimiento", "dMovimiento", "rMovimiento"] },
  { to: "/documentos", etiqueta: "Archivos/Documentos", codigos: ["vArchivo", "aArchivo", "eArchivo", "dArchivo"] },
  { to: "/reportes", etiqueta: "Informes/Reportes", codigos: ["rCliente", "rProducto", "rServicio", "rOrden", "rVenta", "rMovimiento"] },
  { to: "/usuarios", etiqueta: "Usuarios", codigos: ["vUsuario", "aUsuario", "eUsuario", "dUsuario"] },
  { to: "/permisos", etiqueta: "Permisos", codigos: ["vPermiso", "aPermiso", "ePermiso"] },
  { to: "/auditoria", etiqueta: "Auditoría", codigos: ["vAuditoria", "dAuditoria"] },
  { to: "/emails", etiqueta: "Cola de emails", codigos: ["vEmail", "aEmail", "eEmail", "dEmail"] },
  { to: "/empresa", etiqueta: "Configuración de empresa", codigos: ["cEmpresa", "eEmpresa", "vEmpresa"] },
];

export default function Layout() {
  const { sesion, signOut } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [abierto, setAbierto] = useState(false);

  const items = MENU.filter(
    (it) => !it.codigos.length || (sesion?.permisos ?? []).some((p) => it.codigos.includes(p)),
  );

  const cerrarSesion = async () => {
    await signOut();
    nav("/login");
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Barra lateral (escritorio) / panel móvil */}
      {abierto && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={() => setAbierto(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform lg:static lg:translate-x-0 ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b p-4">
          <Link to="/" className="text-lg font-bold" onClick={() => setAbierto(false)}>
            Sistema Taller
          </Link>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={() => setAbierto(false)}
            title="Cerrar menú"
          >
            <XIcon />
          </Button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {items.map((it) => {
            const activo = it.to === location.pathname;
            return (
              <Link
                key={it.to}
                to={it.to}
                onClick={() => setAbierto(false)}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  activo
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {it.etiqueta}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <p className="truncate text-xs text-muted-foreground" title={sesion?.correo}>
            {sesion?.correo ?? sesion?.usuario?.nombre ?? "Sesión activa"}
          </p>
          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={() => void cerrarSesion()}
          >
            <LogOutIcon data-icon="inline-start" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-background px-4 py-2 lg:hidden">
          <Button variant="outline" size="icon-sm" onClick={() => setAbierto(true)} title="Abrir menú">
            <MenuIcon />
          </Button>
          <span className="truncate text-sm font-semibold">Sistema Taller</span>
          <ThemeToggle />
          <Button variant="outline" size="icon-sm" onClick={() => void cerrarSesion()} title="Cerrar sesión">
            <LogOutIcon />
          </Button>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
