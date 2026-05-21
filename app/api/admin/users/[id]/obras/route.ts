import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../../src/lib/prisma';
import { setUserProjectAccess } from '../../../../../../src/lib/userProjectAccess';

function ensureSuperAdmin(req: NextRequest) {
  const authCookie = req.cookies.get('access_token')?.value;
  if (!authCookie) return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) };
  const payload = verifyAccessToken(authCookie);
  if (payload.role !== 'SUPER_ADMIN') {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  }
  return { payload };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = ensureSuperAdmin(req);
    if ('error' in auth && auth.error) return auth.error;

    const { id: userId } = await params;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const [obras, assigned] = await Promise.all([
      prisma.project.findMany({
        where: { isActive: true },
        orderBy: [{ consecutivo: 'asc' }, { name: 'asc' }],
        select: { id: true, consecutivo: true, code: true, name: true },
      }),
      prisma.userProjectAccess.findMany({
        where: { userId },
        select: { projectId: true },
      }),
    ]);

    const assignedSet = new Set(assigned.map((a) => a.projectId));
    return NextResponse.json({
      obras: obras.map((o) => ({
        id: o.id,
        consecutivo: o.consecutivo,
        code: o.code,
        name: o.name,
        assigned: assignedSet.has(o.id),
      })),
      projectIds: Array.from(assignedSet),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar obras del usuario' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = ensureSuperAdmin(req);
    if ('error' in auth && auth.error) return auth.error;

    const { id: userId } = await params;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const body = (await req.json()) as { projectIds?: string[] };
    const projectIds = Array.isArray(body.projectIds) ? body.projectIds : [];

    await setUserProjectAccess(prisma, userId, projectIds);

    return NextResponse.json({
      ok: true,
      projectIds: Array.from(new Set(projectIds.map((id) => String(id).trim()).filter(Boolean))),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    const msg = error instanceof Error ? error.message : 'Error al guardar obras';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
