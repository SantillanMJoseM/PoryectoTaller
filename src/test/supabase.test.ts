// ============================================================================
// Sistema Taller — Pruebas del cliente Supabase + Storage (TASK-0008 / AG-011)
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  esSupabaseConfigurado,
  SUPABASE_URL,
  BUCKETS,
  rutaSegura,
  avisoConfiguracion,
  LIMITE_ALMACEN_BYTES,
} from "../lib/supabase";

describe("cliente supabase (TASK-0008)", () => {
  it("expone los buckets privados de la migración 0005", () => {
    expect(BUCKETS.documentos).toBe("documentos");
    expect(BUCKETS.anexos).toBe("anexos");
  });

  it("límite de almacenamiento de 20 MB", () => {
    expect(LIMITE_ALMACEN_BYTES).toBe(20 * 1024 * 1024);
  });

  it("sin .env, el cliente funciona con valores de prueba y lo avisa", () => {
    // Las variables VITE_* no están definidas en el entorno de pruebas.
    expect(esSupabaseConfigurado).toBe(false);
    expect(avisoConfiguracion()).toContain("VITE_SUPABASE_URL");
    expect(typeof SUPABASE_URL).toBe("string");
  });

  it("rutaSegura sanitiza el nombre y antepone un uuid", () => {
    const ruta = rutaSegura("factura 2026 (final).pdf");
    expect(ruta).toMatch(/^[0-9a-f-]{36}-factura_2026__final_\.pdf$/);
    expect(rutaSegura("a/../b@x.png")).not.toMatch(/[\/@]/);
  });
});
