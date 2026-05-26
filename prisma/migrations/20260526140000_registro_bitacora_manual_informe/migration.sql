-- AlterTable
ALTER TABLE "registro_bitacora_obra" ADD COLUMN "contratistaPersonalManual" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "contratistaEquiposManual" JSONB NOT NULL DEFAULT '[]';
