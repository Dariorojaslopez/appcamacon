-- AlterTable
ALTER TABLE "Project" ADD COLUMN "bitacoraNotifyContratistaUserId" TEXT,
ADD COLUMN "bitacoraNotifyInterventorUserId" TEXT,
ADD COLUMN "bitacoraNotifyIduUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_bitacoraNotifyContratistaUserId_fkey" FOREIGN KEY ("bitacoraNotifyContratistaUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_bitacoraNotifyInterventorUserId_fkey" FOREIGN KEY ("bitacoraNotifyInterventorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_bitacoraNotifyIduUserId_fkey" FOREIGN KEY ("bitacoraNotifyIduUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
