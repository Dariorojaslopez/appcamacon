import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../../src/lib/prisma';

const HHMM = /^\d{1,2}:\d{2}$/;

function parseHora(s: string): boolean {
  const t = s.trim();
  if (!HHMM.test(t)) return false;
  const [h, m] = t.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { id } = await params;
    const body = (await req.json()) as {
      nombre?: string;
      horaInicio?: string;
      horaFin?: string;
      orden?: number;
      isActive?: boolean;
    };

    const data: {
      nombre?: string;
      horaInicio?: string;
      horaFin?: string;
      orden?: number;
      isActive?: boolean;
    } = {};

    if (body.nombre !== undefined) {
      const nombre = String(body.nombre).trim();
      if (!nombre) return NextResponse.json({ error: 'El nombre no puede quedar vacío' }, { status: 400 });
      data.nombre = nombre;
    }
    if (body.horaInicio !== undefined) {
      const h = String(body.horaInicio).trim();
      if (!parseHora(h)) {
        return NextResponse.json({ error: 'horaInicio inválida (use HH:mm)' }, { status: 400 });
      }
      data.horaInicio = h;
    }
    if (body.horaFin !== undefined) {
      const h = String(body.horaFin).trim();
      if (!parseHora(h)) {
        return NextResponse.json({ error: 'horaFin inválida (use HH:mm)' }, { status: 400 });
      }
      data.horaFin = h;
    }
    if (body.orden !== undefined && Number.isFinite(body.orden)) data.orden = Number(body.orden);
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    const updated = await prisma.jornadaCatalog.update({ where: { id }, data });
    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar jornada' }, { status: 500 });
  }
}
