-- Consecutivo autonumérico por obra (separado del código editable del ítem).
ALTER TABLE "ItemCatalog" ADD COLUMN IF NOT EXISTS "consecutivo" INTEGER;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "projectId"
      ORDER BY "orden" ASC, "createdAt" ASC, "codigo" ASC
    ) AS rn
  FROM "ItemCatalog"
)
UPDATE "ItemCatalog" AS i
SET "consecutivo" = r.rn
FROM ranked AS r
WHERE i.id = r.id AND i."consecutivo" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ItemCatalog_projectId_consecutivo_key"
  ON "ItemCatalog"("projectId", "consecutivo");

CREATE INDEX IF NOT EXISTS "ItemCatalog_projectId_consecutivo_idx"
  ON "ItemCatalog"("projectId", "consecutivo");
