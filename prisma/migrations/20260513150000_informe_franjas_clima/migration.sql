-- Condición climática por franja (mañana / tarde / noche) en el informe diario
ALTER TABLE "InformeDiario" ADD COLUMN "franjaClimaMananaCodigo" TEXT;
ALTER TABLE "InformeDiario" ADD COLUMN "franjaClimaTardeCodigo" TEXT;
ALTER TABLE "InformeDiario" ADD COLUMN "franjaClimaNocheCodigo" TEXT;
