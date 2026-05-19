import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../../src/lib/prisma';
import { buildItemCatalogTemplateBuffer } from '../../../../../../src/lib/itemCatalogExcel';

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
    const subchapterId = req.nextUrl.searchParams.get('subchapterId')?.trim() || '';

    if (!projectId) {
      return NextResponse.json({ error: 'Seleccione una obra' }, { status: 400 });
    }
    if (!subchapterId) {
      return NextResponse.json({ error: 'Seleccione capítulo / subcapítulo en el formulario' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { code: true, name: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Obra no encontrada' }, { status: 400 });
    }

    const sub = await prisma.budgetSubchapter.findFirst({
      where: { id: subchapterId, chapter: { projectId } },
      include: { chapter: { select: { codigo: true, nombre: true } } },
    });
    if (!sub) {
      return NextResponse.json({ error: 'Subcapítulo no válido para esta obra' }, { status: 400 });
    }

    const buffer = await buildItemCatalogTemplateBuffer();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="plantilla_items_contractuales.xlsx"',
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
