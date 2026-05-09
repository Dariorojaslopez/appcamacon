import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../src/infrastructure/auth/tokens';
import prisma from '../../../src/lib/prisma';

/** Lista obras activas para cualquier usuario autenticado (selector en informes). */
export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    verifyAccessToken(authCookie);

    const obras = await prisma.project.findMany({
      where: { isActive: true },
      orderBy: [{ consecutivo: 'asc' }, { name: 'asc' }],
      select: { id: true, consecutivo: true, name: true, code: true },
    });
    return NextResponse.json({
      obras: obras.map((o) => ({
        id: o.id,
        consecutivo: o.consecutivo,
        name: o.name,
        code: o.code,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al listar obras' }, { status: 500 });
  }
}
