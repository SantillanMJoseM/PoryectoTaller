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

function Guard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Cargando...</div>;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/portal" element={<Portal />} />
      <Route element={<Guard><Layout /></Guard>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/productos" element={<Productos />} />
        <Route path="/servicios" element={<Servicios />} />
        <Route path="/ordenes" element={<Ordenes />} />
        <Route path="/ventas" element={<Ventas />} />
        <Route path="/garantias" element={<Garantias />} />
        <Route path="/financiero" element={<Financiero />} />
        <Route path="/documentos" element={<Documentos />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/permisos" element={<Permisos />} />
        <Route path="/reportes" element={<Reportes />} />
        <Route path="/auditoria" element={<Auditoria />} />
        <Route path="/emails" element={<Emails />} />
        <Route path="/empresa" element={<Empresa />} />
      </Route>
    </Routes>
  );
}
