import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../src/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
    const items = await prisma.cargoCatalog.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: [{ consecutivo: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        consecutivo: true,
        nombre: true,
        isActive: true,
        projectId: true,
      },
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al listar cargos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const body = (await req.json()) as { projectId?: string; nombre?: string };
    const projectId = (body.projectId ?? '').trim();
    const nombre = (body.nombre ?? '').trim();

    if (!projectId) return NextResponse.json({ error: 'La obra (projectId) es requerida' }, { status: 400 });
    if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 400 });

    try {
      const maxRow = await prisma.cargoCatalog.aggregate({
        where: { projectId },
        _max: { consecutivo: true },
      });
      const nextConsecutivo = (maxRow._max.consecutivo ?? 0) + 1;

      const item = await prisma.cargoCatalog.create({
        data: { projectId, nombre, consecutivo: nextConsecutivo },
      });
      return NextResponse.json(
        {
          item: {
            id: item.id,
            consecutivo: item.consecutivo,
            nombre: item.nombre,
            isActive: item.isActive,
            projectId: item.projectId,
          },
        },
        { status: 201 },
      );
    } catch (e: unknown) {
      const pe = e as { code?: string };
      if (pe.code === 'P2002') {
        return NextResponse.json({ error: 'Ya existe un cargo con ese nombre en esta obra' }, { status: 409 });
      }
      throw e;
    }
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al crear cargo' }, { status: 500 });
  }
}
