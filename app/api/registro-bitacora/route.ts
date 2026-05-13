import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../src/infrastructure/auth/tokens';
import prisma from '../../../src/lib/prisma';

type SlotPayload = {
  observaciones?: unknown;
  fotoUrl?: unknown;
  firmaUrl?: unknown;
};

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asOptionalUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    const userId = payload.sub as string;

    const body = (await req.json()) as {
      projectId?: unknown;
      contratista?: SlotPayload;
      interventoria?: SlotPayload;
      idu?: SlotPayload;
    };

    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    if (!projectId) {
      return NextResponse.json({ error: 'Seleccione una obra' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 404 });
    }

    const c = body.contratista ?? {};
    const i = body.interventoria ?? {};
    const d = body.idu ?? {};

    const row = await prisma.registroBitacoraObra.create({
      data: {
        projectId,
        userId,
        contratistaObservaciones: asString(c.observaciones),
        contratistaFotoUrl: asOptionalUrl(c.fotoUrl),
        contratistaFirmaUrl: asOptionalUrl(c.firmaUrl),
        interventoriaObservaciones: asString(i.observaciones),
        interventoriaFotoUrl: asOptionalUrl(i.fotoUrl),
        interventoriaFirmaUrl: asOptionalUrl(i.firmaUrl),
        iduObservaciones: asString(d.observaciones),
        iduFotoUrl: asOptionalUrl(d.fotoUrl),
        iduFirmaUrl: asOptionalUrl(d.firmaUrl),
      },
    });

    return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string; name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (err?.code === 'P2003' || err?.code === 'P2025') {
      return NextResponse.json({ error: 'Obra o usuario no válido' }, { status: 400 });
    }
    console.error('POST /api/registro-bitacora', error);
    return NextResponse.json({ error: 'Error al guardar el registro' }, { status: 500 });
  }
}
