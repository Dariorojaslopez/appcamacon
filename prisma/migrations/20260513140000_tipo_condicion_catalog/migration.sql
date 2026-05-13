-- CreateTable
CREATE TABLE "TipoCondicionCatalog" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipoCondicionCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TipoCondicionCatalog_codigo_key" ON "TipoCondicionCatalog"("codigo");

CREATE INDEX "TipoCondicionCatalog_isActive_orden_idx" ON "TipoCondicionCatalog"("isActive", "orden");

-- Valores por defecto (mismos códigos que antes en el cliente)
INSERT INTO "TipoCondicionCatalog" ("id", "codigo", "nombre", "orden", "isActive", "createdAt", "updatedAt") VALUES
('tc_seed_soleado', 'SOLEADO', 'Soleado', 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tc_seed_nublado', 'NUBLADO', 'Nublado', 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tc_seed_lluvia', 'LLUVIA', 'Lluvia', 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tc_seed_tormenta', 'TORMENTA', 'Tormenta', 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tc_seed_viento', 'VIENTO', 'Viento', 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tc_seed_otro', 'OTRO', 'Otro', 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
