import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../src/lib/prisma';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const items = await prisma.jornadaCatalog.findMany({
      where: { isActive: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true, horaInicio: true, horaFin: true, orden: true },
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar jornadas' }, { status: 500 });
  }
}
