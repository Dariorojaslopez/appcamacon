-- Permitir editar días anteriores en el registro de bitácora (por obra)
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "bitacoraPermitirEditarDiasAnteriores" BOOLEAN NOT NULL DEFAULT false;
