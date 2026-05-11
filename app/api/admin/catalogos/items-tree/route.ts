import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import {
  BUDGET_HIERARCHY_DB_MISSING_MESSAGE,
  isBudgetHierarchySchemaMissingError,
} from '../../../../../src/lib/budgetHierarchy';
import prisma from '../../../../../src/lib/prisma';

async function ensureAdmin(req: NextRequest) {
  const authCookie = req.cookies.get('access_token')?.value;
  if (!authCookie) return { ok: false as const, status: 401, error: 'No autenticado' };
  const payload = verifyAccessToken(authCookie);
  if (payload.role !== 'SUPER_ADMIN') return { ok: false as const, status: 403, error: 'No autorizado' };
  return { ok: true as const };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await ensureAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
    if (!projectId) return NextResponse.json({ chapters: [] }, { status: 200 });

    const chapters = await prisma.budgetChapter.findMany({
      where: { projectId },
      orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
      include: {
        subchapters: {
          orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
          include: {
            items: {
              orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
            },
          },
        },
      },
    });

    return NextResponse.json({ chapters });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (isBudgetHierarchySchemaMissingError(error)) {
      return NextResponse.json({ error: BUDGET_HIERARCHY_DB_MISSING_MESSAGE }, { status: 503 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar estructura de presupuesto' }, { status: 500 });
  }
}
