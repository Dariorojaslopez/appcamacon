CREATE TABLE "ProveedorCatalog" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "tipoPersona" TEXT NOT NULL,
  "nombreRazonSocial" TEXT NOT NULL,
  "nombreComercial" TEXT,
  "nitDocumento" TEXT NOT NULL,
  "dv" TEXT,
  "email" TEXT,
  "telefono" TEXT,
  "celular" TEXT,
  "direccion" TEXT,
  "pais" TEXT,
  "departamento" TEXT,
  "ciudad" TEXT,
  "codigoPostal" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProveedorCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProveedorCatalog_projectId_nitDocumento_key"
  ON "ProveedorCatalog"("projectId", "nitDocumento");

CREATE INDEX "ProveedorCatalog_projectId_isActive_nombreRazonSocial_idx"
  ON "ProveedorCatalog"("projectId", "isActive", "nombreRazonSocial");

ALTER TABLE "ProveedorCatalog"
  ADD CONSTRAINT "ProveedorCatalog_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ItemCatalog"
  ADD COLUMN "proveedorId" TEXT;

CREATE INDEX "ItemCatalog_proveedorId_idx" ON "ItemCatalog"("proveedorId");

ALTER TABLE "ItemCatalog"
  ADD CONSTRAINT "ItemCatalog_proveedorId_fkey"
  FOREIGN KEY ("proveedorId") REFERENCES "ProveedorCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
