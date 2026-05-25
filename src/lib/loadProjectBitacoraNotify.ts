import prisma from './prisma';
import type { ProjectBitacoraNotifyUserIds } from './projectBitacoraNotifyUsers';

const notifySelect = {
  name: true,
  code: true,
  bitacoraNotifyContratistaUserId: true,
  bitacoraNotifyInterventorUserId: true,
  bitacoraNotifyIduUserId: true,
} as const;

export type ProjectBitacoraNotifyRow = ProjectBitacoraNotifyUserIds & {
  name: string;
  code: string;
};

/** Carga datos de notificación de la obra (Prisma + respaldo SQL si hiciera falta). */
export async function loadProjectBitacoraNotify(
  projectId: string,
): Promise<ProjectBitacoraNotifyRow | null> {
  try {
    const p = await prisma.project.findUnique({
      where: { id: projectId },
      select: notifySelect,
    });
    if (p) return p;
  } catch (err) {
    console.warn('loadProjectBitacoraNotify: prisma', err);
  }

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        name: string;
        code: string;
        bitacoraNotifyContratistaUserId: string | null;
        bitacoraNotifyInterventorUserId: string | null;
        bitacoraNotifyIduUserId: string | null;
      }>
    >`
      SELECT "name", "code",
        "bitacoraNotifyContratistaUserId",
        "bitacoraNotifyInterventorUserId",
        "bitacoraNotifyIduUserId"
      FROM "Project"
      WHERE "id" = ${projectId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch (err) {
    console.warn('loadProjectBitacoraNotify: sql', err);
    return null;
  }
}
