-- Add missing equipo fields from migration 0010_equipos_ampliacion
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "numero_chasis" TEXT;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "numero_motor" TEXT;
ALTER TABLE "equipos" ADD COLUMN IF NOT EXISTS "condicion" TEXT;
CREATE INDEX IF NOT EXISTS "idx_equipos_condicion" ON "equipos"("condicion");
