import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../../src/lib/prisma';

function auth(req: NextRequest) {
  const authCookie = req.cookies.get('access_token')?.value;
  if (!authCookie) return { status: 401, error: 'No autenticado' } as const;
  const payload = verifyAccessToken(authCookie);
  if (payload.role !== 'SUPER_ADMIN') return { status: 403, error: 'No autorizado' } as const;
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const a = auth(req);
    if (a) return NextResponse.json({ error: a.error }, { status: a.status });
    const { id } = await params;
    const body = (await req.json()) as { nombre?: string; orden?: number; isActive?: boolean };
    const data: Record<string, unknown> = {};
    if (body.nombre !== undefined) {
      const n = String(body.nombre).trim();
      if (!n) return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });
      data.nombre = n;
    }
    if (body.orden !== undefined) data.orden = Number(body.orden) || 0;
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });

    const subchapter = await prisma.budgetSubchapter.update({ where: { id }, data: data as any });
    return NextResponse.json({ subchapter });
  } catch (e: unknown) {
    const pe = e as { name?: string };
    if (pe.name === 'TokenExpiredError' || pe.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Error al actualizar subcapítulo' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const a = auth(req);
    if (a) return NextResponse.json({ error: a.error }, { status: a.status });
    const { id } = await params;
    await prisma.budgetSubchapter.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const pe = e as { name?: string };
    if (pe.name === 'TokenExpiredError' || pe.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Error al eliminar subcapítulo' }, { status: 500 });
  }
}
