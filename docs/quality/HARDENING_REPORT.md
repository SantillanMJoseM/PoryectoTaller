# Hardening Report — Sistema Taller

Cambios:
- Code-splitting con lazy loading + manualChunks (main bundle ~282KB).
- Migración 0006_rls_hardening.sql con RLS en tablas faltantes.
- Nuevas pruebas de aislamiento (2) → 153/153 passed.
- Build OK.

Limitaciones:
- RLS refinado a nivel SQL; validación real en Supabase staging pendiente.
- Portal usa anon; aislamiento a nivel de servicio.
