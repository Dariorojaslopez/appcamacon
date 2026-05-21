import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../src/lib/prisma';
import { authFromRequest, isAuthPayload, requireAccessibleProject } from '../../../../src/lib/requireProjectAccess';

export async function GET(req: NextRequest) {
  try {
    const auth = authFromRequest(req);
    if (!isAuthPayload(auth)) return auth;

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
    const denied = await requireAccessibleProject(auth, projectId);
    if (denied) return denied;

    const items = await prisma.cargoCatalog.findMany({
      where: { projectId, isActive: true },
      orderBy: [{ consecutivo: 'asc' }, { nombre: 'asc' }],
      select: { id: true, consecutivo: true, nombre: true },
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar cargos' }, { status: 500 });
  }
}
