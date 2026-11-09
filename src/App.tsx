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
import { lazy, Suspense } from "react";
import { useAuth } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
const CambiarPassword = lazy(() => import("./pages/CambiarPassword"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Equipos = lazy(() => import("./pages/Equipos"));
const Productos = lazy(() => import("./pages/Productos"));
const Servicios = lazy(() => import("./pages/Servicios"));
const Ordenes = lazy(() => import("./pages/Ordenes"));
const Ventas = lazy(() => import("./pages/Ventas"));
const Garantias = lazy(() => import("./pages/Garantias"));
const Financiero = lazy(() => import("./pages/Financiero"));
const Documentos = lazy(() => import("./pages/Documentos"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const Permisos = lazy(() => import("./pages/Permisos"));
const Reportes = lazy(() => import("./pages/Reportes"));
const Auditoria = lazy(() => import("./pages/Auditoria"));
const Emails = lazy(() => import("./pages/Emails"));
const Empresa = lazy(() => import("./pages/Empresa"));
const Portal = lazy(() => import("./pages/Portal"));

/** Rutas con los códigos de actividad que habilitan cada módulo. */
const RUTAS: { ruta: string; elemento: React.ReactNode; codigos: string[] }[] = [
  { ruta: "/", elemento: <Dashboard />, codigos: [] },
  { ruta: "/clientes", elemento: <Clientes />, codigos: ["vCliente"] },
  { ruta: "/equipos", elemento: <Equipos />, codigos: ["vCliente"] },
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
  const { user, loading, debeCambiarContrasena } = useAuth();
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (debeCambiarContrasena) return <Navigate to="/cambiar-password" replace />;
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
  const { user, loading, debeCambiarContrasena } = useAuth();
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;

  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
    <Routes>
      {/* Login administrativo */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />

      {/* Cambio obligatorio de contraseña */}
      <Route
        path="/cambiar-password"
        element={user ? <CambiarPassword /> : <Navigate to="/login" replace />}
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
    </Suspense>
  );
}