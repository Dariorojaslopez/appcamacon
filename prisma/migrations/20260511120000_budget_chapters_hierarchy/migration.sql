-- Jerarquía presupuesto: Capítulo → Subcapítulo → Ítem (ItemCatalog)

CREATE TABLE "BudgetChapter" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetChapter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BudgetChapter_projectId_codigo_key" ON "BudgetChapter"("projectId", "codigo");
CREATE INDEX "BudgetChapter_projectId_orden_idx" ON "BudgetChapter"("projectId", "orden");

ALTER TABLE "BudgetChapter" ADD CONSTRAINT "BudgetChapter_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BudgetSubchapter" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BudgetSubchapter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BudgetSubchapter_chapterId_orden_idx" ON "BudgetSubchapter"("chapterId", "orden");

ALTER TABLE "BudgetSubchapter" ADD CONSTRAINT "BudgetSubchapter_chapterId_fkey"
  FOREIGN KEY ("chapterId") REFERENCES "BudgetChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ItemCatalog" ADD COLUMN "subchapterId" TEXT;

INSERT INTO "BudgetChapter" ("id", "projectId", "codigo", "nombre", "orden", "isActive", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || p."id"), p."id", '0',
  'General — reasigne a capítulos de presupuesto', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Project" p;

INSERT INTO "BudgetSubchapter" ("id", "chapterId", "nombre", "orden", "isActive", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || c."id"), c."id",
  'Ítems sin subcapítulo (reasigne según APU)', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "BudgetChapter" c
WHERE c."codigo" = '0';

UPDATE "ItemCatalog" AS i
SET "subchapterId" = s."id"
FROM "BudgetSubchapter" AS s
INNER JOIN "BudgetChapter" AS c ON s."chapterId" = c."id"
WHERE c."projectId" = i."projectId" AND c."codigo" = '0';

ALTER TABLE "ItemCatalog" ALTER COLUMN "subchapterId" SET NOT NULL;

CREATE INDEX "ItemCatalog_subchapterId_idx" ON "ItemCatalog"("subchapterId");

ALTER TABLE "ItemCatalog" ADD CONSTRAINT "ItemCatalog_subchapterId_fkey"
  FOREIGN KEY ("subchapterId") REFERENCES "BudgetSubchapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
