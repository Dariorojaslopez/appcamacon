CREATE TABLE "EquipoObraHorario" (
  "id" TEXT NOT NULL,
  "equipoId" TEXT NOT NULL,
  "horaIngreso" TEXT NOT NULL,
  "horaSalida" TEXT NOT NULL,
  "horasTrabajadas" DOUBLE PRECISION NOT NULL,
  "orden" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EquipoObraHorario_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EquipoObraHorario_equipoId_orden_idx"
  ON "EquipoObraHorario"("equipoId", "orden");

ALTER TABLE "EquipoObraHorario"
  ADD CONSTRAINT "EquipoObraHorario_equipoId_fkey"
  FOREIGN KEY ("equipoId") REFERENCES "EquipoObra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "EquipoObraHorario" (
  "id",
  "equipoId",
  "horaIngreso",
  "horaSalida",
  "horasTrabajadas",
  "orden",
  "createdAt",
  "updatedAt"
)
SELECT
  'eqh_' || md5(random()::text || clock_timestamp()::text || "id"),
  "id",
  "horaIngreso",
  "horaSalida",
  COALESCE("horasTrabajadas", 0),
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "EquipoObra"
WHERE COALESCE("horaIngreso", '') <> ''
   OR COALESCE("horaSalida", '') <> ''
   OR "horasTrabajadas" IS NOT NULL;
