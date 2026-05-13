-- Registro manual de bitácora por obra (fecha, consecutivo, franjas de clima, firmas por rol).
CREATE TABLE "registro_bitacora_obra" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "consecutivo" INTEGER NOT NULL,
    "franjaClimaMananaCodigo" TEXT,
    "franjaClimaTardeCodigo" TEXT,
    "franjaClimaNocheCodigo" TEXT,
    "contratistaObservaciones" TEXT NOT NULL DEFAULT '',
    "contratistaFotoUrl" TEXT,
    "contratistaFirmaUrl" TEXT,
    "interventoriaObservaciones" TEXT NOT NULL DEFAULT '',
    "interventoriaFotoUrl" TEXT,
    "interventoriaFirmaUrl" TEXT,
    "iduObservaciones" TEXT NOT NULL DEFAULT '',
    "iduFotoUrl" TEXT,
    "iduFirmaUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registro_bitacora_obra_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registro_bitacora_obra_projectId_fecha_key" ON "registro_bitacora_obra"("projectId", "fecha");
CREATE INDEX "registro_bitacora_obra_projectId_fecha_idx" ON "registro_bitacora_obra"("projectId", "fecha");

ALTER TABLE "registro_bitacora_obra" ADD CONSTRAINT "registro_bitacora_obra_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "registro_bitacora_obra" ADD CONSTRAINT "registro_bitacora_obra_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
