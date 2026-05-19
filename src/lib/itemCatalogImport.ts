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
  rows: ItemCatalogExcelRow[],
): Promise<ItemCatalogImportResult> {
  const result: ItemCatalogImportResult = { created: 0, updated: 0, errors: [] };

  const chapters = await prisma.budgetChapter.findMany({
    where: { projectId },
    include: { subchapters: true },
  });

  const chapterByCodigo = new Map(chapters.map((c) => [c.codigo.trim().toLowerCase(), c]));

  const proveedores = await prisma.proveedorCatalog.findMany({
    where: { projectId, isActive: true },
    select: { id: true, nitDocumento: true },
  });
  const proveedorByNit = new Map(
    proveedores.map((p) => [String(p.nitDocumento ?? '').trim().replace(/\D/g, ''), p.id]),
  );

  let nextConsecutivo = await nextItemCatalogConsecutivo(projectId);
  const maxOrdenRow = await prisma.itemCatalog.aggregate({
    where: { projectId },
    _max: { orden: true },
  });
  let nextOrden = (maxOrdenRow._max.orden ?? -1) + 1;

  for (const row of rows) {
    const ch = chapterByCodigo.get(row.codigoCapitulo.trim().toLowerCase());
    if (!ch) {
      result.errors.push({
        fila: row.rowNumber,
        mensaje: `Capítulo "${row.codigoCapitulo}" no existe en esta obra.`,
      });
      continue;
    }

    const subNombreNorm = row.nombreSubcapitulo.trim().toLowerCase();
    const sub = ch.subchapters.find((s) => s.nombre.trim().toLowerCase() === subNombreNorm);
    if (!sub) {
      result.errors.push({
        fila: row.rowNumber,
        mensaje: `Subcapítulo "${row.nombreSubcapitulo}" no existe en el capítulo ${row.codigoCapitulo}.`,
      });
      continue;
    }

    let proveedorId: string | null = null;
    if (row.nitProveedor) {
      const nitKey = row.nitProveedor.replace(/\D/g, '');
      proveedorId = proveedorByNit.get(nitKey) ?? null;
      if (!proveedorId) {
        result.errors.push({
          fila: row.rowNumber,
          mensaje: `Proveedor con NIT "${row.nitProveedor}" no encontrado en esta obra.`,
        });
        continue;
      }
    }

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
            proveedorId,
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
            proveedorId,
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
