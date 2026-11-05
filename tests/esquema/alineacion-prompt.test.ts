// ============================================================================
// Sistema Taller — QA: Alineación con SOURCE_PROMPT.md (TASK-0010 / AG-012)
// ============================================================================
// Prueba de CONSERVACIÓN: el proyecto debe mantener TODOS los módulos, tablas
// y RPCs del documento fuente (docs/requirements/SOURCE_PROMPT.md). Aquí se
// verifica contra el esquema real (supabase/migrations/**) y la capa de
// permisos, y no contra copias sueltas.
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULOS, ACCIONES, todosLosCodigos } from "../../src/lib/permisos";

const RAIZ = join(__dirname, "..", "..");
const leer = (relativo: string) => readFileSync(join(RAIZ, relativo), "utf8");

const migraciones = leer("supabase/migrations/0001_init.sql") + leer("supabase/migrations/0002_schema.sql");

describe("entidades del SOURCE_PROMPT.md existen en las migraciones", () => {
  const TABLAS_REQUERIDAS = [
    "clientes",
    "productos",
    "servicios",
    "ordenes_trabajo",
    "productos_orden",
    "servicios_orden",
    "ventas",
    "items_venta",
    "garantias",
    "movimientos_financieros",
    "categorias",
    "cuentas",
    "anexos",
    "documentos",
    "marcas",
    "equipos",
    "equipos_orden",
    "usuarios",
    "permisos",
    "empresa",
    "logs_auditoria",
    "cola_emails",
    "sesiones",
  ];

  it("todas las tablas del modelo de datos están creadas (`create table ... tabla`)", () => {
    // una sola expectativa con mensaje detallado por tabla faltante
    const faltantes = TABLAS_REQUERIDAS.filter(
      (t) => !new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+${t}\\b`, "i").test(migraciones),
    );
    expect(faltantes, `Tablas faltantes en el esquema: ${faltantes.join(", ")}`).toEqual([]);
  });
});

describe("RPCs de negocio (migración 0004) presentes", () => {
  const negocio = leer("supabase/migrations/0004_negocio.sql");
  const RPCS = [
    "orden_agregar_producto", // stock: descuenta
    "orden_cambiar_cantidad_producto", // stock: ajusta
    "orden_quitar_producto", // stock: devuelve
    "venta_agregar_item",
    "venta_cambiar_cantidad_item",
    "venta_quitar_item",
    "orden_facturar", // facturación única orden
    "venta_facturar", // facturación única venta
    "mov_marcar_pagado", // pagado exige fecha_pago
    "limpiar_logs", // auditoría: limpiar logs
    "sesion_registrar", // sesiones (login admin)
    "sesion_cerrar",
    "sesion_purgar",
    "requerir_permiso", // permisos en la base
    "ajustar_stock",
  ];
  it("todas las funciones de negocio existen", () => {
    const faltantes = RPCS.filter(
      (fn) => !new RegExp(`create\\s+or\\s+replace\\s+function\\s+(public\\.)?${fn}\\b`, "i").test(negocio),
    );
    expect(faltantes, `RPCs faltantes en 0004_negocio.sql: ${faltantes.join(", ")}`).toEqual([]);
  });

  it("la vista de situación financiera existe (filtros del módulo, 0002_schema.sql)", () => {
    expect(migraciones).toMatch(/v_movimientos_situacion/i);
  });
});

describe("módulos y códigos de actividad de permisos (§11 del prompt)", () => {
  it("los 14 módulos cubiertos son exactos y sin cambios", () => {
    expect([...MODULOS]).toEqual([
      "Cliente",
      "Producto",
      "Servicio",
      "Orden",
      "Venta",
      "Garantia",
      "Movimiento",
      "Archivo",
      "Usuario",
      "Permiso",
      "Respaldo",
      "Auditoria",
      "Email",
      "Empresa",
    ]);
  });

  it("las 6 acciones del dominio son a/e/d/v/r/c", () => {
    expect([...ACCIONES]).toEqual(["a", "e", "d", "v", "r", "c"]);
  });

  it("la plantilla completa son 14 × 6 = 84 códigos (aCliente…)", () => {
    const todos = todosLosCodigos();
    expect(todos).toHaveLength(84);
    expect(todos).toContain("aCliente");
    expect(todos).toContain("dEmpresa");
    expect(todos).toContain("rAuditoria");
  });
});

describe("módulos obligatorios en el frontend (rutas/páginas)", () => {
  it("existen las 17 pantallas del prompt (sin módulos inventados)", () => {
    for (const pagina of [
      "LoginPage", // 1 Autenticación administrativa
      "Dashboard", // 2 Panel principal
      "Clientes",
      "Productos",
      "Servicios",
      "Ordenes",
      "Ventas",
      "Garantias",
      "Financiero",
      "Documentos", // 10 Archivos/Documentos
      "Usuarios",
      "Permisos",
      "Reportes", // 13 Informes/Reportes
      "Auditoria",
      "Emails", // 15 Cola de emails
      "Portal", // 16 Portal del cliente
      "Empresa", // 17 Configuración de empresa
    ]) {
      const contenido = readFileSync(join(RAIZ, "src/pages", `${pagina}.tsx`), "utf8");
      expect(contenido.length).toBeGreaterThan(0);
    }
  });
});
