import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";

const items = [
  { to: "/", label: "Panel" },
  { to: "/clientes", label: "Clientes" },
  { to: "/productos", label: "Productos" },
  { to: "/servicios", label: "Servicios" },
  { to: "/ordenes", label: "Órdenes" },
  { to: "/ventas", label: "Ventas" },
  { to: "/garantias", label: "Garantías" },
  { to: "/financiero", label: "Financiero" },
  { to: "/documentos", label: "Documentos" },
  { to: "/usuarios", label: "Usuarios" },
  { to: "/permisos", label: "Permisos" },
  { to: "/reportes", label: "Reportes" },
  { to: "/auditoria", label: "Auditoría" },
  { to: "/emails", label: "Cola Emails" },
  { to: "/empresa", label: "Empresa" },
];

export default function Layout() {
  const { user, signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r bg-white p-4">
        <h1 className="mb-4 text-xl font-bold">Sistema Taller</h1>
        <nav className="space-y-1">
          {items.map((it) => (
            <Link key={it.to} to={it.to} className="block rounded px-3 py-2 text-sm hover:bg-slate-100">
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="mt-6">
          <p className="text-xs text-slate-500">{user?.email}</p>
          <Button variant="outline" size="sm" className="mt-2 w-full" onClick={async () => { await signOut(); nav("/login"); }}>Cerrar sesión</Button>
        </div>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
