import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import {
  BUDGET_HIERARCHY_DB_MISSING_MESSAGE,
  isBudgetHierarchySchemaMissingError,
} from '../../../../../src/lib/budgetHierarchy';
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

    const body = (await req.json()) as { chapterId?: string; nombre?: string; orden?: number };
    const chapterId = String(body.chapterId ?? '').trim();
    const nombre = String(body.nombre ?? '').trim();
    if (!chapterId) return NextResponse.json({ error: 'chapterId es requerido' }, { status: 400 });
    if (!nombre) return NextResponse.json({ error: 'El nombre del subcapítulo es requerido' }, { status: 400 });

    const ch = await prisma.budgetChapter.findFirst({ where: { id: chapterId }, select: { id: true } });
    if (!ch) return NextResponse.json({ error: 'Capítulo no encontrado' }, { status: 400 });

    const maxRow = await prisma.budgetSubchapter.aggregate({
      where: { chapterId },
      _max: { orden: true },
    });
    const orden = body.orden != null && Number.isFinite(Number(body.orden)) ? Number(body.orden) : (maxRow._max.orden ?? -1) + 1;

    const subchapter = await prisma.budgetSubchapter.create({
      data: { chapterId, nombre, orden, isActive: true },
    });
    return NextResponse.json({ subchapter }, { status: 201 });
  } catch (e: unknown) {
    const pe = e as { name?: string; message?: string };
    if (pe.name === 'TokenExpiredError' || pe.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (isBudgetHierarchySchemaMissingError(e)) {
      return NextResponse.json({ error: BUDGET_HIERARCHY_DB_MISSING_MESSAGE }, { status: 503 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Error al crear subcapítulo' }, { status: 500 });
  }
}
