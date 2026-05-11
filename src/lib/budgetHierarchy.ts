import type { PrismaClient } from '@prisma/client';

const DEFAULT_CHAPTER_CODIGO = '0';

/** Crea capítulo y subcapítulo por defecto (migración o primera vez en obra nueva). */
export async function ensureDefaultBudgetHierarchy(
  prisma: PrismaClient,
  projectId: string,
): Promise<{ chapterId: string; subchapterId: string }> {
  const existing = await prisma.budgetChapter.findFirst({
    where: { projectId, codigo: DEFAULT_CHAPTER_CODIGO },
    include: { subchapters: { orderBy: { orden: 'asc' }, take: 1 } },
  });
  if (existing?.subchapters[0]) {
    return { chapterId: existing.id, subchapterId: existing.subchapters[0].id };
  }
  if (existing) {
    const sub = await prisma.budgetSubchapter.create({
      data: {
        chapterId: existing.id,
        nombre: 'Ítems sin subcapítulo (reasigne según APU)',
        orden: 0,
        isActive: true,
      },
    });
    return { chapterId: existing.id, subchapterId: sub.id };
  }
  const ch = await prisma.budgetChapter.create({
    data: {
      projectId,
      codigo: DEFAULT_CHAPTER_CODIGO,
      nombre: 'General — reasigne a capítulos de presupuesto',
      orden: 0,
      isActive: true,
    },
  });
  const sub = await prisma.budgetSubchapter.create({
    data: {
      chapterId: ch.id,
      nombre: 'Ítems sin subcapítulo (reasigne según APU)',
      orden: 0,
      isActive: true,
    },
  });
  return { chapterId: ch.id, subchapterId: sub.id };
}

export async function assertSubchapterBelongsToProject(
  prisma: PrismaClient,
  projectId: string,
  subchapterId: string,
): Promise<boolean> {
  const row = await prisma.budgetSubchapter.findFirst({
    where: { id: subchapterId, chapter: { projectId } },
    select: { id: true },
  });
  return Boolean(row);
}
