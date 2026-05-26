-- CreateTable
CREATE TABLE "ProjectBitacoraNotifyUser" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectBitacoraNotifyUser_pkey" PRIMARY KEY ("id")
);

-- Migrate existing single-user assignments
INSERT INTO "ProjectBitacoraNotifyUser" ("id", "projectId", "role", "userId", "sortOrder")
SELECT gen_random_uuid()::text, "id", 'contratista', "bitacoraNotifyContratistaUserId", 0
FROM "Project"
WHERE "bitacoraNotifyContratistaUserId" IS NOT NULL;

INSERT INTO "ProjectBitacoraNotifyUser" ("id", "projectId", "role", "userId", "sortOrder")
SELECT gen_random_uuid()::text, "id", 'interventor', "bitacoraNotifyInterventorUserId", 0
FROM "Project"
WHERE "bitacoraNotifyInterventorUserId" IS NOT NULL;

INSERT INTO "ProjectBitacoraNotifyUser" ("id", "projectId", "role", "userId", "sortOrder")
SELECT gen_random_uuid()::text, "id", 'idu', "bitacoraNotifyIduUserId", 0
FROM "Project"
WHERE "bitacoraNotifyIduUserId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_bitacoraNotifyContratistaUserId_fkey";
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_bitacoraNotifyInterventorUserId_fkey";
ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_bitacoraNotifyIduUserId_fkey";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "bitacoraNotifyContratistaUserId",
DROP COLUMN "bitacoraNotifyInterventorUserId",
DROP COLUMN "bitacoraNotifyIduUserId";

-- CreateIndex
CREATE UNIQUE INDEX "ProjectBitacoraNotifyUser_projectId_role_userId_key" ON "ProjectBitacoraNotifyUser"("projectId", "role", "userId");

-- CreateIndex
CREATE INDEX "ProjectBitacoraNotifyUser_projectId_role_idx" ON "ProjectBitacoraNotifyUser"("projectId", "role");

-- AddForeignKey
ALTER TABLE "ProjectBitacoraNotifyUser" ADD CONSTRAINT "ProjectBitacoraNotifyUser_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBitacoraNotifyUser" ADD CONSTRAINT "ProjectBitacoraNotifyUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
