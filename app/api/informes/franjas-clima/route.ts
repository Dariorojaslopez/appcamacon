import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import { resolveJornadaCatalogoId } from '../../../../src/lib/informeDailyScope';
import { informeCerradoJsonResponse } from '../../../../src/lib/informeCerrado';

function parseDayUtc(ymd: string): Date | null {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    const userId = payload.sub as string;

    const body = (await req.json()) as {
      projectId?: string;
      date?: string;
      jornadaId?: string;
      franjaClimaMananaCodigo?: string | null;
      franjaClimaTardeCodigo?: string | null;
      franjaClimaNocheCodigo?: string | null;
    };

    const projectId = body.projectId?.trim();
    const dateStr = body.date?.trim();
    if (!projectId || !dateStr) {
      return NextResponse.json({ error: 'projectId y date son requeridos' }, { status: 400 });
    }

    const reportDate = parseDayUtc(dateStr);
    if (!reportDate) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });

    const jr = await resolveJornadaCatalogoId(body.jornadaId);
    if (jr.valid === false) return NextResponse.json({ error: jr.error }, { status: jr.status });

    const project = await prisma.project.findFirst({ where: { id: projectId, isActive: true }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 400 });

    const existing = await prisma.informeDiario.findFirst({
      where: { projectId, date: reportDate, jornadaCatalogoId: jr.id },
      select: { id: true, informeCerrado: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'No existe informe para esta obra, fecha y jornada. Guarde primero «Datos generales».' },
        { status: 404 },
      );
    }
    if (existing.informeCerrado) return informeCerradoJsonResponse();

    const informe = await prisma.informeDiario.update({
      where: { id: existing.id },
      data: {
        userId,
        franjaClimaMananaCodigo:
          body.franjaClimaMananaCodigo === null || body.franjaClimaMananaCodigo === undefined
            ? null
            : String(body.franjaClimaMananaCodigo).trim() || null,
        franjaClimaTardeCodigo:
          body.franjaClimaTardeCodigo === null || body.franjaClimaTardeCodigo === undefined
            ? null
            : String(body.franjaClimaTardeCodigo).trim() || null,
        franjaClimaNocheCodigo:
          body.franjaClimaNocheCodigo === null || body.franjaClimaNocheCodigo === undefined
            ? null
            : String(body.franjaClimaNocheCodigo).trim() || null,
      },
      select: {
        id: true,
        franjaClimaMananaCodigo: true,
        franjaClimaTardeCodigo: true,
        franjaClimaNocheCodigo: true,
      },
    });

    return NextResponse.json({ informe }, { status: 200 });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al guardar condiciones por franja' }, { status: 500 });
  }
}
