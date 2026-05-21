import type { PrismaClient } from '@prisma/client';
import prisma from './prisma';

export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

export function isUnrestrictedProjectAccess(role: string): boolean {
  return role === SUPER_ADMIN_ROLE;
}

export async function listAccessibleProjectIds(userId: string): Promise<string[]> {
  const rows = await prisma.userProjectAccess.findMany({
    where: { userId },
    select: { projectId: true },
  });
  return rows.map((r) => r.projectId);
}

export async function findAccessibleProject(
  userId: string,
  role: string,
  projectId: string,
): Promise<{ id: string } | null> {
  const id = projectId.trim();
  if (!id) return null;
  if (isUnrestrictedProjectAccess(role)) {
    return prisma.project.findFirst({
      where: { id, isActive: true },
      select: { id: true },
    });
  }
  return prisma.project.findFirst({
    where: { id, isActive: true, userAccess: { some: { userId } } },
    select: { id: true },
  });
}

export async function listAccessibleProjects(userId: string, role: string) {
  const where = isUnrestrictedProjectAccess(role)
    ? { isActive: true as const }
    : { isActive: true as const, userAccess: { some: { userId } } };
  return prisma.project.findMany({
    where,
    orderBy: [{ consecutivo: 'asc' }, { name: 'asc' }],
    select: { id: true, consecutivo: true, name: true, code: true },
  });
}

export async function setUserProjectAccess(
  db: PrismaClient,
  userId: string,
  projectIds: string[],
): Promise<void> {
  const unique = Array.from(new Set(projectIds.map((id) => id.trim()).filter(Boolean)));
  if (unique.length > 0) {
    const count = await db.project.count({
      where: { id: { in: unique }, isActive: true },
    });
    if (count !== unique.length) {
      throw new Error('Una o más obras no son válidas o están inactivas');
    }
  }
  await db.$transaction([
    db.userProjectAccess.deleteMany({ where: { userId } }),
    ...(unique.length > 0
      ? [
          db.userProjectAccess.createMany({
            data: unique.map((projectId) => ({ userId, projectId })),
          }),
        ]
      : []),
  ]);
}
