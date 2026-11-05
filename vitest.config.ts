// ============================================================================
// Sistema Taller — Configuración de Vitest (TASK-0010 / AG-012 QA)
// ============================================================================
// Configuración separada de vite.config.ts para que `npm test` ejecute:
//   • src/test/**   → pruebas unitarias existentes (lib pura, cliente RS).
//   • tests/**      → suite de QA: flujos críticos con Supabase simulado
//                     (ver docs/qa/PLAN_PRUEBAS_TASK-0010.md).
// Entorno por defecto: node. Las pruebas que necesitan localStorage (portal
// del cliente) declaran `// @vitest-environment jsdom` en su cabecera.
// ============================================================================

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/test/**/*.test.ts", "tests/**/*.test.ts"],
    globals: false,
    // Sin cobertura activada (la instrumentación requiere @vitest/coverage-*,
    // no instalado): no se inventan porcentajes de cobertura en los reportes.
  },
});
