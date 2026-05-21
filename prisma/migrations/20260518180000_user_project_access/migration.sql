-- CreateTable
CREATE TABLE "UserProjectAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProjectAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProjectAccess_userId_projectId_key" ON "UserProjectAccess"("userId", "projectId");

CREATE INDEX "UserProjectAccess_userId_idx" ON "UserProjectAccess"("userId");

CREATE INDEX "UserProjectAccess_projectId_idx" ON "UserProjectAccess"("projectId");

ALTER TABLE "UserProjectAccess" ADD CONSTRAINT "UserProjectAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserProjectAccess" ADD CONSTRAINT "UserProjectAccess_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
