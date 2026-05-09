import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../src/lib/prisma';

const HHMM = /^\d{1,2}:\d{2}$/;

function parseHora(s: string): boolean {
  const t = s.trim();
  if (!HHMM.test(t)) return false;
  const [h, m] = t.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const items = await prisma.jornadaCatalog.findMany({
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        horaInicio: true,
        horaFin: true,
        orden: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al listar jornadas' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const body = (await req.json()) as {
      nombre?: string;
      horaInicio?: string;
      horaFin?: string;
      orden?: number;
    };
    const nombre = (body.nombre ?? '').trim();
    const horaInicio = (body.horaInicio ?? '').trim();
    const horaFin = (body.horaFin ?? '').trim();
    if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    if (!parseHora(horaInicio) || !parseHora(horaFin)) {
      return NextResponse.json(
        { error: 'horaInicio y horaFin deben tener formato HH:mm (ej. 06:00, 18:30)' },
        { status: 400 },
      );
    }

    const item = await prisma.jornadaCatalog.create({
      data: {
        nombre,
        horaInicio,
        horaFin,
        orden: Number.isFinite(body.orden) ? Number(body.orden) : 0,
        isActive: true,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al crear jornada' }, { status: 500 });
  }
}
