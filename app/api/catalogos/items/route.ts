import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../src/lib/prisma';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
    if (!projectId) return NextResponse.json({ items: [] }, { status: 200 });

    const itemsRaw = await prisma.itemCatalog.findMany({
      where: { projectId, isActive: true },
      orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
      include: {
        subchapter: {
          include: { chapter: { select: { codigo: true, nombre: true } } },
        },
      },
    });
    const items = (itemsRaw as any[]).map((it) => {
      const ch = it.subchapter?.chapter;
      const sub = it.subchapter;
      const rubro =
        ch && sub
          ? `${String(ch.codigo).trim()} ${String(ch.nombre).trim()} › ${String(sub.nombre).trim()}`
          : null;
      return {
        id: it.id,
        codigo: it.codigo,
        descripcion: it.descripcion,
        unidad: it.unidad ?? null,
        precioUnitario: it.precioUnitario ?? null,
        cantidad: it.cantidad ?? null,
        largo: it.largo ?? null,
        ancho: it.ancho ?? null,
        altura: it.altura ?? null,
        imagenUrl: it.imagenUrl ?? null,
        rubro,
      };
    });
    return NextResponse.json({ items }, { status: 200 });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar ítems' }, { status: 500 });
  }
}
