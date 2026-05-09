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
    const items = await prisma.frenteObraCatalog.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: [{ projectId: 'asc' }, { orden: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        orden: true,
        isActive: true,
        projectId: true,
        project: { select: { code: true, name: true } },
      },
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al listar frentes de obra' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const body = (await req.json()) as {
      projectId?: string;
      nombre?: string;
      orden?: number;
    };
    const projectId = (body.projectId ?? '').trim();
    const nombre = (body.nombre ?? '').trim();
    if (!projectId) return NextResponse.json({ error: 'La obra es requerida' }, { status: 400 });
    if (!nombre) return NextResponse.json({ error: 'El nombre del frente es requerido' }, { status: 400 });

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 400 });

    const orden = typeof body.orden === 'number' && Number.isFinite(body.orden) ? Math.trunc(body.orden) : 0;

    try {
      const item = await prisma.frenteObraCatalog.create({
        data: { projectId, nombre, orden },
      });
      return NextResponse.json(
        {
          item: {
            id: item.id,
            nombre: item.nombre,
            orden: item.orden,
            isActive: item.isActive,
            projectId: item.projectId,
          },
        },
        { status: 201 },
      );
    } catch (e: unknown) {
      const pe = e as { code?: string };
      if (pe.code === 'P2002') {
        return NextResponse.json({ error: 'Ya existe un frente con ese nombre en esta obra' }, { status: 409 });
      }
      throw e;
    }
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al crear frente de obra' }, { status: 500 });
  }
}
