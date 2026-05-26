import prisma from './prisma';
import type { ProjectBitacoraNotifyRow } from './projectBitacoraNotifyUsers';

export type ProjectBitacoraNotifyLoadRow = ProjectBitacoraNotifyRow & {
  name: string;
  code: string;
};

function sortNotifyRows(
  rows: { role: string; userId: string; sortOrder: number }[],
): { role: string; userId: string; sortOrder: number }[] {
  return [...rows].sort((a, b) => a.role.localeCompare(b.role) || a.sortOrder - b.sortOrder);
}

/** Carga datos de notificación de la obra. */
export async function loadProjectBitacoraNotify(
  projectId: string,
): Promise<ProjectBitacoraNotifyLoadRow | null> {
  try {
    const p = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        name: true,
        code: true,
        bitacoraNotifyUsers: {
          select: { role: true, userId: true, sortOrder: true },
        },
      },
    });
    if (p) {
      return {
        name: p.name,
        code: p.code,
        bitacoraNotifyUsers: sortNotifyRows(p.bitacoraNotifyUsers),
      };
    }
  } catch (err) {
    console.warn('loadProjectBitacoraNotify: prisma', err);
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, code: true },
    });
    if (!project) return null;
    const rows = await prisma.projectBitacoraNotifyUser.findMany({
      where: { projectId },
      select: { role: true, userId: true, sortOrder: true },
    });
    return { ...project, bitacoraNotifyUsers: sortNotifyRows(rows) };
  } catch (err) {
    console.warn('loadProjectBitacoraNotify: fallback', err);
    return null;
  }
}
