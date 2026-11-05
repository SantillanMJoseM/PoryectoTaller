// ============================================================================
// Sistema Taller — Rutas de la aplicación (TASK-0009 / AG-009)
// ============================================================================
// Rutas privadas protegidas: / */}
//  • Guard de sesión (una sesión administrativa activa).
//  • Guard de permisos por módulo (códigos de actividad, §11 del prompt).
// El portal del cliente (/portal) es una zona pública separada del panel.
// La autorización definitiva la impone RLS en Supabase.
// ============================================================================

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import Clientes from "./pages/Clientes";
import Productos from "./pages/Productos";
import Servicios from "./pages/Servicios";
import Ordenes from "./pages/Ordenes";
import Ventas from "./pages/Ventas";
import Garantias from "./pages/Garantias";
import Financiero from "./pages/Financiero";
import Documentos from "./pages/Documentos";
import Usuarios from "./pages/Usuarios";
import Permisos from "./pages/Permisos";
import Reportes from "./pages/Reportes";
import Auditoria from "./pages/Auditoria";
import Emails from "./pages/Emails";
import Empresa from "./pages/Empresa";
import Portal from "./pages/Portal";

/** Rutas con los códigos de actividad que habilitan cada módulo. */
const RUTAS: { ruta: string; elemento: React.ReactNode; codigos: string[] }[] = [
  { ruta: "/", elemento: <Dashboard />, codigos: [] },
  { ruta: "/clientes", elemento: <Clientes />, codigos: ["vCliente"] },
  { ruta: "/productos", elemento: <Productos />, codigos: ["vProducto"] },
  { ruta: "/servicios", elemento: <Servicios />, codigos: ["vServicio"] },
  { ruta: "/ordenes", elemento: <Ordenes />, codigos: ["vOrden"] },
  { ruta: "/ventas", elemento: <Ventas />, codigos: ["vVenta"] },
  { ruta: "/garantias", elemento: <Garantias />, codigos: ["vGarantia"] },
  { ruta: "/financiero", elemento: <Financiero />, codigos: ["vMovimiento"] },
  { ruta: "/documentos", elemento: <Documentos />, codigos: ["vArchivo"] },
  { ruta: "/usuarios", elemento: <Usuarios />, codigos: ["vUsuario"] },
  { ruta: "/permisos", elemento: <Permisos />, codigos: ["vPermiso"] },
  {
    ruta: "/reportes",
    elemento: <Reportes />,
    codigos: ["rCliente", "rProducto", "rServicio", "rOrden", "rVenta", "rMovimiento"],
  },
  { ruta: "/auditoria", elemento: <Auditoria />, codigos: ["vAuditoria"] },
  { ruta: "/emails", elemento: <Emails />, codigos: ["vEmail"] },
  { ruta: "/empresa", elemento: <Empresa />, codigos: ["cEmpresa", "eEmpresa", "vEmpresa"] },
];

function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Bloquea el módulo si el usuario no tiene ninguno de los códigos pedidos. */
function RutaPermisos({ codigos, children }: { codigos: string[]; children: React.ReactNode }) {
  const { puede } = useAuth();
  if (!codigos.length || puede(codigos)) return <>{children}</>;
  return (
    <div className="rounded-xl border bg-background p-6">
      <h2 className="text-lg font-semibold">Acceso restringido</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        El grupo de permisos de su usuario no habilita este módulo. Contacte al administrador
        para contar con los códigos de actividad correspondientes.
      </p>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  return (
    <Routes>
      {/* Login administrativo */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Portal del cliente (ingreso por correo + documento) */}
      <Route path="/portal" element={<Portal />} />

      {/* Panel administrativo privado */}
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        {RUTAS.map((r) => (
          <Route
            key={r.ruta}
            path={r.ruta}
            element={<RutaPermisos codigos={r.codigos}>{r.elemento}</RutaPermisos>}
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
