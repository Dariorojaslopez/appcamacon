import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../../src/lib/prisma';
import {
  buildItemCatalogTemplateBuffer,
  type ItemCatalogCatalogoObra,
} from '../../../../../../src/lib/itemCatalogExcel';

async function ensureAdmin(req: NextRequest) {
  const authCookie = req.cookies.get('access_token')?.value;
  if (!authCookie) return { ok: false as const, status: 401, error: 'No autenticado' };
  const payload = verifyAccessToken(authCookie);
  if (payload.role !== 'SUPER_ADMIN') return { ok: false as const, status: 403, error: 'No autorizado' };
  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await ensureAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim() || '';
    let catalogo: ItemCatalogCatalogoObra | undefined;

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, isActive: true },
        select: { code: true, name: true },
      });
      if (!project) {
        return NextResponse.json({ error: 'Obra no encontrada' }, { status: 400 });
      }

      const chapters = await prisma.budgetChapter.findMany({
        where: { projectId },
        orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
        include: {
          subchapters: { orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] },
        },
      });

      const proveedores = await prisma.proveedorCatalog.findMany({
        where: { projectId, isActive: true },
        orderBy: { nombreRazonSocial: 'asc' },
        select: { nitDocumento: true, nombreComercial: true, nombreRazonSocial: true },
      });

      catalogo = {
        obraLabel: `${project.code} — ${project.name}`,
        capitulos: chapters.map((ch) => ({
          codigo: ch.codigo,
          nombre: ch.nombre,
          subcapitulos: ch.subchapters.map((s) => ({ nombre: s.nombre })),
        })),
        proveedores: proveedores.map((p) => ({
          nit: p.nitDocumento ?? '',
          nombre: p.nombreComercial || p.nombreRazonSocial || '',
        })),
      };
    }

    const buffer = await buildItemCatalogTemplateBuffer(catalogo);
    const suffix = projectId && catalogo ? '_con_catalogo_obra' : '';
    const filename = `plantilla_items_contractuales${suffix}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error('[items/plantilla]', error);
    return NextResponse.json({ error: 'No se pudo generar la plantilla Excel' }, { status: 500 });
  }
}
