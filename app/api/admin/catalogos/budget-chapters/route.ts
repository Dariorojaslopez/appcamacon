import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../src/lib/prisma';

function auth(req: NextRequest) {
  const authCookie = req.cookies.get('access_token')?.value;
  if (!authCookie) return { status: 401, error: 'No autenticado' } as const;
  const payload = verifyAccessToken(authCookie);
  if (payload.role !== 'SUPER_ADMIN') return { status: 403, error: 'No autorizado' } as const;
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const a = auth(req);
    if (a) return NextResponse.json({ error: a.error }, { status: a.status });

    const body = (await req.json()) as { projectId?: string; codigo?: string; nombre?: string; orden?: number };
    const projectId = String(body.projectId ?? '').trim();
    const codigo = String(body.codigo ?? '').trim();
    const nombre = String(body.nombre ?? '').trim();
    if (!projectId) return NextResponse.json({ error: 'projectId es requerido' }, { status: 400 });
    if (!codigo) return NextResponse.json({ error: 'El código del capítulo es requerido' }, { status: 400 });
    if (!nombre) return NextResponse.json({ error: 'El nombre del capítulo es requerido' }, { status: 400 });

    const project = await prisma.project.findFirst({ where: { id: projectId, isActive: true }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Obra no encontrada' }, { status: 400 });

    const maxRow = await prisma.budgetChapter.aggregate({
      where: { projectId },
      _max: { orden: true },
    });
    const orden = body.orden != null && Number.isFinite(Number(body.orden)) ? Number(body.orden) : (maxRow._max.orden ?? -1) + 1;

    const chapter = await prisma.budgetChapter.create({
      data: { projectId, codigo, nombre, orden, isActive: true },
    });
    return NextResponse.json({ chapter }, { status: 201 });
  } catch (e: unknown) {
    const pe = e as { code?: string; name?: string; message?: string };
    const msg = String(pe.message ?? '');
    if (pe.name === 'TokenExpiredError' || pe.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (pe.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un capítulo con ese código en esta obra' }, { status: 409 });
    }
    if (/BudgetChapter/i.test(msg) && /does not exist|no existe|Unknown model/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            'La base de datos no tiene las tablas de presupuesto jerárquico. En el servidor ejecute: npx prisma migrate deploy',
        },
        { status: 503 },
      );
    }
    console.error(e);
    return NextResponse.json({ error: 'Error al crear capítulo' }, { status: 500 });
  }
}
