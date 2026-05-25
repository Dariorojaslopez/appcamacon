-- Usuario y fecha/hora del último guardado por sección (contratista, interventoría, IDU)
ALTER TABLE "registro_bitacora_obra" ADD COLUMN IF NOT EXISTS "contratistaGuardadoPor" TEXT;
ALTER TABLE "registro_bitacora_obra" ADD COLUMN IF NOT EXISTS "contratistaGuardadoEn" TIMESTAMP(3);
ALTER TABLE "registro_bitacora_obra" ADD COLUMN IF NOT EXISTS "interventoriaGuardadoPor" TEXT;
ALTER TABLE "registro_bitacora_obra" ADD COLUMN IF NOT EXISTS "interventoriaGuardadoEn" TIMESTAMP(3);
ALTER TABLE "registro_bitacora_obra" ADD COLUMN IF NOT EXISTS "iduGuardadoPor" TEXT;
ALTER TABLE "registro_bitacora_obra" ADD COLUMN IF NOT EXISTS "iduGuardadoEn" TIMESTAMP(3);
