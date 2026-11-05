# Security Audit Report

Verdict: PASS_WITH_OBSERVATIONS
- RLS habilitado en tablas principales.
- Anon solo lectura clientes.
- Observación: políticas RLS amplias para authenticated; refinar por rol.
- Observación: no exponer service role en frontend (solo anon key).
