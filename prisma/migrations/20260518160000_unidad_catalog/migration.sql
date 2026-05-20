-- CreateTable
CREATE TABLE "UnidadCatalog" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "simbolo" TEXT,
    "tipoCalculo" TEXT NOT NULL DEFAULT 'manual',
    "orden" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnidadCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UnidadCatalog_codigo_key" ON "UnidadCatalog"("codigo");

CREATE INDEX "UnidadCatalog_isActive_orden_idx" ON "UnidadCatalog"("isActive", "orden");

INSERT INTO "UnidadCatalog" ("id", "codigo", "nombre", "simbolo", "tipoCalculo", "orden", "isActive", "createdAt", "updatedAt") VALUES
('un_seed_m3', 'm3', 'Volumen (L × A × H)', 'm³', 'm3', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('un_seed_m2', 'm2', 'Área (L × A)', 'm²', 'm2', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('un_seed_ml', 'ml', 'Longitud', 'ml', 'length', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('un_seed_m', 'm', 'Longitud simple', 'm', 'length', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('un_seed_und', 'und', 'Conteo', 'und', 'manual', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('un_seed_kg', 'kg', 'Peso', 'kg', 'manual', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('un_seed_ton', 'ton', 'Peso (tonelada)', 'ton', 'manual', 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('un_seed_l', 'l', 'Litros', 'l', 'manual', 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
