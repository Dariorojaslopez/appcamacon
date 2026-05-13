import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const items = await prisma.tipoCondicionCatalog.findMany({
      where: { isActive: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: { codigo: true, nombre: true, orden: true },
    });

    return NextResponse.json({
      items: items.map((it) => ({ value: it.codigo, label: it.nombre, orden: it.orden })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar tipos de condición' }, { status: 500 });
  }
}
