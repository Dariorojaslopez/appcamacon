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
      include: { noConformidadesObra: { orderBy: { createdAt: 'asc' } } },
    });

    return NextResponse.json({
      exists: Boolean(informe),
      informeCerrado: informe?.informeCerrado ?? false,
      cerradoEn: informe?.cerradoEn ? informe.cerradoEn.toISOString() : null,
      noConformidades: (informe?.noConformidadesObra ?? []).map((n) => ({
        id: n.id,
        noConformidad: n.noConformidad,
        detalle: n.detalle,
        estado: n.estado,
        imagenUrl: n.imagenUrl,
        imagenLatitud: n.imagenLatitud,
        imagenLongitud: n.imagenLongitud,
        imagenPrecision: n.imagenPrecision,
        imagenGeoEstado: n.imagenGeoEstado,
        imagenTomadaEn: n.imagenTomadaEn ? n.imagenTomadaEn.toISOString() : null,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar no conformidades' }, { status: 500 });
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
      noConformidades?: Array<{
        noConformidad: string;
        detalle: string;
        estado: string;
        imagenUrl?: string | null;
        imagenLatitud?: number | null;
        imagenLongitud?: number | null;
        imagenPrecision?: number | null;
        imagenGeoEstado?: string | null;
        imagenTomadaEn?: string | null;
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

    const items = Array.isArray(body.noConformidades) ? body.noConformidades : [];
    const cleaned = items
      .map((n) => {
        const noConformidad = String(n.noConformidad ?? '').trim();
        const detalle = String(n.detalle ?? '').trim();
        const estado = String(n.estado ?? '').trim();
        const imagenUrl = typeof n.imagenUrl === 'string' ? n.imagenUrl.trim() : null;
        const imagenLatitud =
          typeof n.imagenLatitud === 'number' && Number.isFinite(n.imagenLatitud) ? n.imagenLatitud : null;
        const imagenLongitud =
          typeof n.imagenLongitud === 'number' && Number.isFinite(n.imagenLongitud) ? n.imagenLongitud : null;
        const imagenPrecision =
          typeof n.imagenPrecision === 'number' && Number.isFinite(n.imagenPrecision) ? n.imagenPrecision : null;
        const imagenGeoEstado = n.imagenGeoEstado ? String(n.imagenGeoEstado).trim() : null;
        const imagenTomadaEn = n.imagenTomadaEn ? new Date(n.imagenTomadaEn) : null;
        return {
          noConformidad,
          detalle,
          estado,
          imagenUrl,
          imagenLatitud,
          imagenLongitud,
          imagenPrecision,
          imagenGeoEstado,
          imagenTomadaEn,
        };
      })
      .filter((n) => n.noConformidad && n.detalle && n.estado);

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

    await prisma.noConformidadObra.deleteMany({ where: { informeId } });
    if (cleaned.length > 0) {
      await prisma.noConformidadObra.createMany({
        data: cleaned.map((n) => ({
          ...n,
          informeId: informeId as string,
        })),
      });
    }

    const saved = await prisma.noConformidadObra.findMany({
      where: { informeId: informeId as string },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      noConformidades: saved.map((n) => ({
        id: n.id,
        noConformidad: n.noConformidad,
        detalle: n.detalle,
        estado: n.estado,
        imagenUrl: n.imagenUrl,
        imagenLatitud: n.imagenLatitud,
        imagenLongitud: n.imagenLongitud,
        imagenPrecision: n.imagenPrecision,
        imagenGeoEstado: n.imagenGeoEstado,
        imagenTomadaEn: n.imagenTomadaEn ? n.imagenTomadaEn.toISOString() : null,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al guardar no conformidades' }, { status: 500 });
  }
}

