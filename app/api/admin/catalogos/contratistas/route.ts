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
    const items = await prisma.contratistaCatalog.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: [{ cedula: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        cedula: true,
        nombre: true,
        isActive: true,
        projectId: true,
        project: { select: { code: true, name: true } },
      },
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al listar contratistas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const body = (await req.json()) as { projectId?: string; cedula?: string; nombre?: string };
    const projectId = (body.projectId ?? '').trim();
    const cedula = (body.cedula ?? '').trim();
    const nombre = (body.nombre ?? '').trim();

    if (!projectId) return NextResponse.json({ error: 'La obra (projectId) es requerida' }, { status: 400 });
    if (!cedula) return NextResponse.json({ error: 'La cédula es requerida' }, { status: 400 });
    if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 400 });

    try {
      const item = await prisma.contratistaCatalog.create({
        data: { projectId, cedula, nombre },
      });
      return NextResponse.json({ item }, { status: 201 });
    } catch (e: unknown) {
      const pe = e as { code?: string };
      if (pe.code === 'P2002') {
        return NextResponse.json(
          { error: 'Ya existe un contratista con esa cédula en esta obra' },
          { status: 409 },
        );
      }
      throw e;
    }
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al crear contratista' }, { status: 500 });
  }
}

