import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import { normalizeReportDate, resolveJornadaCatalogoId } from '../../../../src/lib/informeDailyScope';
import { informeCerradoJsonResponse } from '../../../../src/lib/informeCerrado';

async function getInformeScope(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');
  const dateStr = searchParams.get('date');
  const jornadaId = searchParams.get('jornadaId');
  if (!projectId || !dateStr) {
    return { error: NextResponse.json({ error: 'projectId y date son requeridos' }, { status: 400 }) };
  }
  const jr = await resolveJornadaCatalogoId(jornadaId);
  if (jr.valid === false) {
    return { error: NextResponse.json({ error: jr.error }, { status: jr.status }) };
  }
  const reportDate = normalizeReportDate(dateStr);
  if (!reportDate) {
    return { error: NextResponse.json({ error: 'date no válida' }, { status: 400 }) };
  }
  return { projectId, reportDate, jornadaCatalogoId: jr.id };
}

/** Migra una sola fila legacy del InformeDiario a InformeSuspension. */
async function migrateLegacySuspensionIfNeeded(informe: {
  id: string;
  huboSuspension: boolean | null;
  motivoSuspension: string | null;
  horaSuspension: string | null;
  horaReinicio: string | null;
  tipoClima: string | null;
  horasClima: number | null;
}) {
  const hasLegacy =
    informe.huboSuspension &&
    (String(informe.motivoSuspension ?? '').trim() !== '' ||
      String(informe.horaSuspension ?? '').trim() !== '' ||
      String(informe.horaReinicio ?? '').trim() !== '');
  if (!hasLegacy) return;

  await prisma.$transaction(async (tx) => {
    await tx.informeSuspension.create({
      data: {
        informeDiarioId: informe.id,
        motivoSuspension: String(informe.motivoSuspension ?? '').trim() || '—',
        horaSuspension: String(informe.horaSuspension ?? '').trim() || '00:00',
        horaReinicio: String(informe.horaReinicio ?? '').trim() || '00:00',
        tipoClima: informe.tipoClima?.trim() || null,
        horasClima: typeof informe.horasClima === 'number' ? informe.horasClima : null,
        orden: 0,
      },
    });
    await tx.informeDiario.update({
      where: { id: informe.id },
      data: {
        huboSuspension: false,
        motivoSuspension: null,
        horaSuspension: null,
        horaReinicio: null,
        tipoClima: null,
        horasClima: null,
      },
    });
  });
}

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const scope = await getInformeScope(req);
    if ('error' in scope) return scope.error;

    const informe = await prisma.informeDiario.findFirst({
      where: {
        projectId: scope.projectId,
        date: scope.reportDate,
        jornadaCatalogoId: scope.jornadaCatalogoId,
      },
      select: {
        id: true,
        informeCerrado: true,
        huboSuspension: true,
        motivoSuspension: true,
        horaSuspension: true,
        horaReinicio: true,
        tipoClima: true,
        horasClima: true,
      },
    });

    if (!informe) {
      return NextResponse.json({ items: [] });
    }

    let items = await prisma.informeSuspension.findMany({
      where: { informeDiarioId: informe.id },
      orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
    });

    if (items.length === 0) {
      await migrateLegacySuspensionIfNeeded(informe);
      items = await prisma.informeSuspension.findMany({
        where: { informeDiarioId: informe.id },
        orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }],
      });
    }

    return NextResponse.json({
      items: items.map((s) => ({
        id: s.id,
        motivoSuspension: s.motivoSuspension,
        horaSuspension: s.horaSuspension,
        horaReinicio: s.horaReinicio,
        tipoClima: s.tipoClima ?? '',
        horasClima: s.horasClima ?? 0,
        orden: s.orden,
      })),
      informeCerrado: informe.informeCerrado,
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al listar suspensiones' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const body = (await req.json()) as {
      projectId?: string;
      date?: string;
      jornadaId?: string;
      motivoSuspension?: string;
      horaSuspension?: string;
      horaReinicio?: string;
      tipoClima?: string;
      horasClima?: number;
    };

    const { projectId, date: dateStr, jornadaId } = body;
    if (!projectId || !dateStr) {
      return NextResponse.json({ error: 'projectId y date son requeridos' }, { status: 400 });
    }

    const jr = await resolveJornadaCatalogoId(jornadaId);
    if (jr.valid === false) {
      return NextResponse.json({ error: jr.error }, { status: jr.status });
    }
    const reportDate = normalizeReportDate(dateStr);
    if (!reportDate) {
      return NextResponse.json({ error: 'date no válida' }, { status: 400 });
    }

    const informe = await prisma.informeDiario.findFirst({
      where: {
        projectId,
        date: reportDate,
        jornadaCatalogoId: jr.id,
      },
      select: { id: true, informeCerrado: true },
    });

    if (!informe) {
      return NextResponse.json(
        {
          error:
            'No existe informe para esta obra, fecha y jornada. Guarde primero «Datos generales» del informe.',
        },
        { status: 400 },
      );
    }

    if (informe.informeCerrado) return informeCerradoJsonResponse();

    const motivo = String(body.motivoSuspension ?? '').trim();
    const hS = String(body.horaSuspension ?? '').trim();
    const hR = String(body.horaReinicio ?? '').trim();
    if (!motivo || !hS || !hR) {
      return NextResponse.json(
        { error: 'motivo, hora de suspensión y hora de reinicio son requeridos.' },
        { status: 400 },
      );
    }

    const maxOrden = await prisma.informeSuspension.aggregate({
      where: { informeDiarioId: informe.id },
      _max: { orden: true },
    });
    const orden = (maxOrden._max.orden ?? -1) + 1;

    const created = await prisma.informeSuspension.create({
      data: {
        informeDiarioId: informe.id,
        motivoSuspension: motivo,
        horaSuspension: hS,
        horaReinicio: hR,
        tipoClima: body.tipoClima?.trim() || null,
        horasClima: typeof body.horasClima === 'number' ? body.horasClima : null,
        orden,
      },
    });

    return NextResponse.json({
      item: {
        id: created.id,
        motivoSuspension: created.motivoSuspension,
        horaSuspension: created.horaSuspension,
        horaReinicio: created.horaReinicio,
        tipoClima: created.tipoClima ?? '',
        horasClima: created.horasClima ?? 0,
        orden: created.orden,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al crear suspensión' }, { status: 500 });
  }
}
