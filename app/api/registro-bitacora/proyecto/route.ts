import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import { toYmdUtc } from '../../../../src/lib/registroBitacoraFecha';

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim() ?? '';
    if (!projectId) {
      return NextResponse.json({ error: 'projectId es requerido' }, { status: 400 });
    }

    const p = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        startDate: true,
        endDate: true,
        logoUrl: true,
        consecutivo: true,
      },
    });
    if (!p) return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 404 });

    return NextResponse.json({
      id: p.id,
      name: p.name,
      code: p.code,
      startDate: p.startDate ? p.startDate.toISOString() : null,
      endDate: p.endDate ? p.endDate.toISOString() : null,
      fechaMin: p.startDate ? toYmdUtc(p.startDate) : null,
      fechaMax: p.endDate ? toYmdUtc(p.endDate) : null,
      logoUrl: p.logoUrl,
      consecutivoObra: p.consecutivo,
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error('GET /api/registro-bitacora/proyecto', error);
    return NextResponse.json({ error: 'Error al cargar la obra' }, { status: 500 });
  }
}
