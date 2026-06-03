import type { Prisma } from '@prisma/client';
import prisma from './prisma';
import { toYmdUtc } from './registroBitacoraFecha';

/** Folio cronológico (1, 2, 3…) por fecha ascendente dentro de la obra. */
export function buildFolioPorFechaMap(rows: { fecha: Date }[]): Map<string, number> {
  const sorted = [...rows].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const map = new Map<string, number>();
  sorted.forEach((row, index) => map.set(toYmdUtc(row.fecha), index + 1));
  return map;
}

export async function fetchFolioPorFechaMap(projectId: string): Promise<Map<string, number>> {
  const rows = await prisma.registroBitacoraObra.findMany({
    where: { projectId },
    select: { fecha: true },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  });
  return buildFolioPorFechaMap(rows);
}

/** Renumera `consecutivo` en BD según el orden cronológico de `fecha`. */
export async function syncRegistroBitacoraConsecutivos(
  projectId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  const rows = await db.registroBitacoraObra.findMany({
    where: { projectId },
    select: { id: true, fecha: true, consecutivo: true },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
  });

  await Promise.all(
    rows.map((row, index) => {
      const expected = index + 1;
      if (row.consecutivo === expected) return Promise.resolve();
      return db.registroBitacoraObra.update({
        where: { id: row.id },
        data: { consecutivo: expected },
      });
    }),
  );
}
