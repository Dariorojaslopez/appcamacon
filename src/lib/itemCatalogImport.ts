import prisma from './prisma';
import type { ItemCatalogExcelRow } from './itemCatalogExcel';

export type ItemCatalogImportResult = {
  created: number;
  updated: number;
  errors: Array<{ fila: number; mensaje: string }>;
};

async function nextItemCatalogConsecutivo(projectId: string): Promise<number> {
  const maxRow = await prisma.itemCatalog.aggregate({
    where: { projectId },
    _max: { consecutivo: true },
  });
  return (maxRow._max.consecutivo ?? 0) + 1;
}

export async function importItemCatalogExcelRows(
  projectId: string,
  subchapterId: string,
  rows: ItemCatalogExcelRow[],
): Promise<ItemCatalogImportResult> {
  const result: ItemCatalogImportResult = { created: 0, updated: 0, errors: [] };

  const sub = await prisma.budgetSubchapter.findFirst({
    where: { id: subchapterId, chapter: { projectId } },
    select: { id: true },
  });
  if (!sub) {
    return {
      created: 0,
      updated: 0,
      errors: [{ fila: 0, mensaje: 'Subcapítulo no válido para esta obra.' }],
    };
  }

  let nextConsecutivo = await nextItemCatalogConsecutivo(projectId);
  const maxOrdenRow = await prisma.itemCatalog.aggregate({
    where: { projectId },
    _max: { orden: true },
  });
  let nextOrden = (maxOrdenRow._max.orden ?? -1) + 1;

  for (const row of rows) {
    const cantidadPersistida = row.cantidad;

    try {
      const existing = await prisma.itemCatalog.findUnique({
        where: { projectId_codigo: { projectId, codigo: row.codigo } },
        select: { id: true },
      });

      if (existing) {
        await prisma.itemCatalog.update({
          where: { id: existing.id },
          data: {
            subchapterId: sub.id,
            descripcion: row.descripcion,
            unidad: row.unidad,
            precioUnitario: row.precioUnitario,
            cantidad: cantidadPersistida,
            cantidadPresupuesto: cantidadPersistida,
            isActive: true,
          },
        });
        result.updated += 1;
      } else {
        await prisma.itemCatalog.create({
          data: {
            projectId,
            subchapterId: sub.id,
            consecutivo: nextConsecutivo++,
            codigo: row.codigo,
            descripcion: row.descripcion,
            unidad: row.unidad,
            precioUnitario: row.precioUnitario,
            cantidad: cantidadPersistida,
            cantidadPresupuesto: cantidadPersistida,
            proveedorId: null,
            orden: nextOrden++,
            isActive: true,
          },
        });
        result.created += 1;
      }
    } catch (e: unknown) {
      const pe = e as { code?: string };
      if (pe.code === 'P2002') {
        result.errors.push({
          fila: row.rowNumber,
          mensaje: `Código ítem "${row.codigo}" duplicado en esta obra.`,
        });
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push({ fila: row.rowNumber, mensaje: msg.slice(0, 240) });
      }
    }
  }

  return result;
}
