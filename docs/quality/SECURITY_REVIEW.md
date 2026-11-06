# Security Review — Sistema Taller

Veredicto: PASS_WITH_OBSERVATIONS

Hallazgos:
- RLS habilitado en tablas principales (clientes, productos, servicios, ordenes, ventas, financiero, documentos, usuarios, permisos, empresa).
- Políticas anon solo lectura clientes; authenticated amplio.
- Frontend usa solo VITE_SUPABASE_ANON_KEY; no se exponen secretos.
- Observación: refinar RLS por rol en producción.
- Observación: validar JWT y permisos en backend/RPC.

Evidencias: migraciones 0003_rls.sql, .env.example.
