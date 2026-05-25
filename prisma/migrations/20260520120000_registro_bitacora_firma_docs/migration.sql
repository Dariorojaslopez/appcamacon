-- Documentos múltiples en firma (contratista, interventoría, IDU)
ALTER TABLE "registro_bitacora_obra" ADD COLUMN IF NOT EXISTS "contratistaFirmaDocs" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "registro_bitacora_obra" ADD COLUMN IF NOT EXISTS "interventoriaFirmaDocs" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "registro_bitacora_obra" ADD COLUMN IF NOT EXISTS "iduFirmaDocs" JSONB NOT NULL DEFAULT '[]';
