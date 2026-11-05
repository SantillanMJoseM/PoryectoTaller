# React + TypeScript + Vite

Proyecto **Sistema Taller** (PROJECT-001). Stack: React + TypeScript + Tailwind CSS + shadcn/ui + Supabase.

## Documentación

| Área | Documento |
|---|---|
| Requisitos (fuente de verdad) | `docs/requirements/SOURCE_PROMPT.md` |
| Requisitos funcionales / reglas / no funcionales / historias | `docs/requirements/FUNCTIONAL_REQUIREMENTS.md`, `BUSINESS_RULES.md`, `NON_FUNCTIONAL_REQUIREMENTS.md`, `USER_STORIES.md` |
| **Arquitectura** | `docs/architecture/ARCHITECTURE.md` |
| **Decisiones (ADRs)** | `docs/architecture/ADR.md` |
| **Diagrama de componentes y matriz de trazabilidad** | `docs/architecture/COMPONENT_DIAGRAM.md` |

## Arranque (desarrollo)

```bash
cp .env.example .env          # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
supabase start                # Postgres + Auth + Storage locales
supabase db reset             # aplica supabase/migrations y carga supabase/seed.sql
npm install
npm run dev                   # http://localhost:5173
```

Scripts: `npm run dev` · `npm run build` · `npm run lint` (oxlint) · `npm run test` (vitest) · `npx tsc -b` (tipos).

---

## Plantilla original

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
