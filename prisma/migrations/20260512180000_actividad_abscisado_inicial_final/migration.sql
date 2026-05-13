-- AlterTable: reemplazar abscisado único por abscisado inicial / final (opcionales)
ALTER TABLE "ActividadObra" ADD COLUMN "abscisadoInicial" TEXT;
ALTER TABLE "ActividadObra" ADD COLUMN "abscisadoFinal" TEXT;

UPDATE "ActividadObra" SET "abscisadoInicial" = "abscisado" WHERE "abscisado" IS NOT NULL AND TRIM("abscisado") <> '';

ALTER TABLE "ActividadObra" DROP COLUMN "abscisado";
