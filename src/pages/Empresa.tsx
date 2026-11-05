// ============================================================================
// Sistema Taller — Configuración de empresa (TASK-0009 / AG-009)
// ============================================================================
// SOURCE_PROMPT.md §16: crear/editar datos de la empresa (nombre, CNPJ, IE,
// dirección, teléfono, correo) y logo para reportes PDF (bucket público
// «logos», ≤ 5 MB). RB-030: solo existe un registro (trigger f_empresa_unica);
// si aún no existe, la pantalla lo crea con el formulario vacío.
// ============================================================================

import { useCallback, useEffect, useState } from "react";
import { SaveIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { useAuth } from "../contexts/AuthContext";
import { empresaService } from "../services";
import type { Empresa } from "../lib/types";

export default function EmpresaPage() {
  const { puede } = useAuth();
  const puedeEditar = puede(["cEmpresa", "eEmpresa"]);

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState({
    nombre: "",
    cnpj: "",
    ie: "",
    calle: "",
    numero: "",
    barrio: "",
    ciudad: "",
    provincia: "",
    telefono: "",
    correo: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const e = await empresaService.obtener();
      setEmpresa(e);
      if (e) {
        setForm({
          nombre: e.nombre ?? "",
          cnpj: e.cnpj ?? "",
          ie: e.ie ?? "",
          calle: e.calle ?? "",
          numero: e.numero ?? "",
          barrio: e.barrio ?? "",
          ciudad: e.ciudad ?? "",
          provincia: e.provincia ?? "",
          telefono: e.telefono ?? "",
          correo: e.correo ?? "",
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la empresa.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const guardar = async () => {
    if (!form.nombre.trim()) {
      setError("El nombre de la empresa es obligatorio.");
      return;
    }
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      if (empresa) {
        const actualizada = await empresaService.actualizar(empresa.id, { ...form });
        setEmpresa(actualizada);
        setMensaje("Datos de la empresa actualizados.");
      } else {
        const creada = await empresaService.crear({ ...form });
        setEmpresa(creada);
        setMensaje("Empresa creada. El logo aparecerá en los encabezados de los PDF.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la empresa.");
    } finally {
      setGuardando(false);
    }
  };

  const subirLogo = async (archivo: File) => {
    if (!empresa) {
      setError("Guarde primero los datos de la empresa para poder subir el logo.");
      return;
    }
    setSubiendo(true);
    setError(null);
    setMensaje(null);
    try {
      const actualizada = await empresaService.subirLogo(empresa.id, archivo);
      setEmpresa(actualizada);
      setMensaje("Logo actualizado: se usará en los encabezados de los reportes PDF.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el logo.");
    } finally {
      setSubiendo(false);
    }
  };

  const campo = (clave: keyof typeof form, etiqueta: string, opciones?: { tipo?: string; span?: boolean }) => (
    <div className={opciones?.span ? "sm:col-span-2 space-y-1" : "space-y-1"} key={clave}>
      <Label>{etiqueta}</Label>
      <Input
        type={opciones?.tipo ?? "text"}
        value={form[clave]}
        disabled={!puedeEditar}
        onChange={(e) => setForm({ ...form, [clave]: e.target.value })}
      />
    </div>
  );

  if (cargando) return <p className="text-sm text-muted-foreground">Cargando empresa…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Configuración de empresa</h2>
        <p className="text-sm text-muted-foreground">
          Datos fiscales y de contacto de la empresa; los PDF de informes usan este encabezado y logo.
        </p>
      </div>

      {mensaje && <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40">{mensaje}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
        className="grid gap-3 sm:grid-cols-2 rounded-xl border bg-background p-4"
      >
        {campo("nombre", "Nombre *")}
        {campo("cnpj", "CNPJ")}
        {campo("ie", "IE")}
        {campo("calle", "Calle")}
        {campo("numero", "Número")}
        {campo("barrio", "Barrio")}
        {campo("ciudad", "Ciudad")}
        {campo("provincia", "Provincia")}
        {campo("telefono", "Teléfono")}
        {campo("correo", "Correo", { tipo: "email" })}

        <div className="sm:col-span-2 flex flex-wrap items-center gap-4 border-t pt-4">
          <div className="flex items-center gap-3">
            {empresa?.url_logo ? (
              <img
                src={empresa.url_logo}
                alt={`Logo de ${empresa.nombre}`}
                className="size-16 rounded-lg border object-contain"
              />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
                Sin logo
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label>Logo para los reportes PDF (máximo 5 MB, imagen)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                disabled={!puedeEditar || !empresa || subiendo}
                className="max-w-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void subirLogo(f);
                  e.target.value = "";
                }}
              />
              {subiendo && <span className="text-xs text-muted-foreground">Subiendo…</span>}
            </div>
            {!empresa && (
              <p className="text-xs text-muted-foreground">Cree primero la empresa para habilitar la carga del logo.</p>
            )}
          </div>
        </div>

        <div className="sm:col-span-2 flex justify-end gap-2">
          <Button type="submit" disabled={guardando || !puedeEditar}>
            <SaveIcon data-icon="inline-start" />
            {guardando ? "Guardando…" : empresa ? "Guardar cambios" : "Crear empresa"}
          </Button>
        </div>
      </form>
    </div>
  );
}
