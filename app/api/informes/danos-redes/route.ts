import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import { resolveJornadaCatalogoId } from '../../../../src/lib/informeDailyScope';
import { informeCerradoJsonResponse } from '../../../../src/lib/informeCerrado';

function normalizeDate(date: string): Date | null {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function padNumber(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const dateStr = searchParams.get('date');
    const jornadaId = searchParams.get('jornadaId');
    if (!projectId || !dateStr) {
      return NextResponse.json({ error: 'projectId y date son requeridos' }, { status: 400 });
    }

    const date = normalizeDate(dateStr);
    if (!date) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });

    const jr = await resolveJornadaCatalogoId(jornadaId);
    if (jr.valid === false) {
      return NextResponse.json({ error: jr.error }, { status: jr.status });
    }

    const informe = await prisma.informeDiario.findFirst({
      where: { projectId, date, jornadaCatalogoId: jr.id },
      include: { danosRedesObra: { orderBy: { createdAt: 'asc' } } },
    });

    return NextResponse.json({
      exists: Boolean(informe),
      informeCerrado: informe?.informeCerrado ?? false,
      cerradoEn: informe?.cerradoEn ? informe.cerradoEn.toISOString() : null,
      danos: (informe?.danosRedesObra ?? []).map((d) => ({
        id: d.id,
        horaReporte: d.horaReporte,
        direccion: d.direccion,
        tipoDano: d.tipoDano,
        entidad: d.entidad,
        noReporte: d.noReporte,
        observacion: d.observacion,
        imagenUrl: d.imagenUrl,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar daños' }, { status: 500 });
  }
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
      jornadaCatalogoId?: string;
      danos?: Array<{
        horaReporte?: string | null;
        direccion: string;
        tipoDano: string;
        entidad: string;
        noReporte: string;
        observacion?: string | null;
        imagenUrl?: string | null;
      }>;
    };

    const projectId = body.projectId;
    const dateStr = body.date;
    if (!projectId || !dateStr) {
      return NextResponse.json({ error: 'projectId y date son requeridos' }, { status: 400 });
    }

    const date = normalizeDate(dateStr);
    if (!date) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });

    const jr = await resolveJornadaCatalogoId(body.jornadaId ?? body.jornadaCatalogoId);
    if (jr.valid === false) {
      return NextResponse.json({ error: jr.error }, { status: jr.status });
    }

    const items = Array.isArray(body.danos) ? body.danos : [];
    const cleaned = items
      .map((d) => {
        const horaReporte = typeof d.horaReporte === 'string' ? d.horaReporte : null;
        const direccion = String(d.direccion ?? '').trim();
        const tipoDano = String(d.tipoDano ?? '').trim();
        const entidad = String(d.entidad ?? '').trim();
        const noReporte = String(d.noReporte ?? '').trim();
        const observacion = typeof d.observacion === 'string' ? d.observacion.trim() : null;
        const imagenUrl = typeof d.imagenUrl === 'string' ? d.imagenUrl.trim() : null;

        return {
          horaReporte,
          direccion,
          tipoDano,
          entidad,
          noReporte,
          observacion,
          imagenUrl,
        };
      })
      .filter((d) => d.direccion && d.tipoDano && d.entidad && d.noReporte);

    const informe = await prisma.informeDiario.findFirst({
      where: { projectId, date, jornadaCatalogoId: jr.id },
      select: { id: true, informeCerrado: true },
    });

    if (informe?.informeCerrado) {
      return informeCerradoJsonResponse();
    }

    let informeId = informe?.id;
    if (!informeId) {
      const maxByProject = await prisma.informeDiario.aggregate({
        where: { projectId },
        _max: { informeConsecutivo: true, centroTrabajoConsecutivo: true },
      });
      const nextInformeConsecutivo = (maxByProject._max.informeConsecutivo ?? 0) + 1;
      const nextCentroTrabajoConsecutivo = (maxByProject._max.centroTrabajoConsecutivo ?? 0) + 1;
      const year = date.getUTCFullYear();
      const informeNo = `IDO-${year}-${padNumber(nextInformeConsecutivo, 3)}`;
      const centroTrabajo = `CT-${padNumber(nextCentroTrabajoConsecutivo, 3)}`;

      const created = await prisma.informeDiario.create({
        data: {
          userId,
          projectId,
          date,
          jornadaCatalogoId: jr.id,
          informeConsecutivo: nextInformeConsecutivo,
          informeNo,
          centroTrabajoConsecutivo: nextCentroTrabajoConsecutivo,
          centroTrabajo,
        },
        select: { id: true },
      });
      informeId = created.id;
    } else {
      await prisma.informeDiario.update({ where: { id: informeId }, data: { userId } });
    }

    await prisma.danoRedesObra.deleteMany({ where: { informeId } });
    if (cleaned.length > 0) {
      await prisma.danoRedesObra.createMany({
        data: cleaned.map((d) => ({
          ...d,
          informeId: informeId as string,
        })),
      });
    }

    const saved = await prisma.danoRedesObra.findMany({
      where: { informeId: informeId as string },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      danos: saved.map((d) => ({
        id: d.id,
        horaReporte: d.horaReporte,
        direccion: d.direccion,
        tipoDano: d.tipoDano,
        entidad: d.entidad,
        noReporte: d.noReporte,
        observacion: d.observacion,
        imagenUrl: d.imagenUrl,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al guardar daños' }, { status: 500 });
  }
}

