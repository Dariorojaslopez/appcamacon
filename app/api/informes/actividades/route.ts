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
      include: { actividadesObra: { orderBy: { createdAt: 'asc' } } },
    });

    return NextResponse.json({
      exists: Boolean(informe),
      informeCerrado: informe?.informeCerrado ?? false,
      cerradoEn: informe?.cerradoEn ? informe.cerradoEn.toISOString() : null,
      actividades: (informe?.actividadesObra ?? []).map((a) => ({
        id: a.id,
        pk: a.pk,
        abscisado: a.abscisado,
        itemContractual: a.itemContractual,
        descripcion: a.descripcion,
        unidadMedida: a.unidadMedida,
        observacion: a.observacion,
        observacionTexto: (a as { observacionTexto?: string | null }).observacionTexto ?? '',
        imagenUrl: a.imagenUrl,
        imagenLatitud: a.imagenLatitud,
        imagenLongitud: a.imagenLongitud,
        imagenPrecision: a.imagenPrecision,
        imagenGeoEstado: a.imagenGeoEstado,
        imagenTomadaEn: a.imagenTomadaEn ? a.imagenTomadaEn.toISOString() : null,
        largo: a.largo,
        ancho: a.ancho,
        altura: a.altura,
        cantidadTotal: a.cantidadTotal,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar actividades' }, { status: 500 });
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
      actividades?: Array<{
        pk: string;
        abscisado: string;
        itemContractual: string;
        descripcion: string;
        unidadMedida: string;
        observacion?: boolean;
        observacionTexto?: string;
        imagenUrl?: string | null;
        imagenLatitud?: number | null;
        imagenLongitud?: number | null;
        imagenPrecision?: number | null;
        imagenGeoEstado?: string | null;
        imagenTomadaEn?: string | null;
        largo?: number;
        ancho?: number;
        altura?: number;
        cantidadTotal?: number;
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

    const items = Array.isArray(body.actividades) ? body.actividades : [];
    const cleaned = items
      .map((a) => {
        const pk = String(a.pk ?? '').trim();
        const abscisado = String(a.abscisado ?? '').trim();
        const itemContractual = String(a.itemContractual ?? '').trim();
        const descripcion = String(a.descripcion ?? '').trim();
        const unidadMedida = String(a.unidadMedida ?? '').trim();
        const observacionTexto = String(a.observacionTexto ?? '').trim();
        const observacion = observacionTexto.length > 0 || Boolean(a.observacion);
        const imagenUrl = typeof a.imagenUrl === 'string' ? a.imagenUrl.trim() : null;
        const imagenLatitud =
          typeof a.imagenLatitud === 'number' && Number.isFinite(a.imagenLatitud) ? a.imagenLatitud : null;
        const imagenLongitud =
          typeof a.imagenLongitud === 'number' && Number.isFinite(a.imagenLongitud) ? a.imagenLongitud : null;
        const imagenPrecision =
          typeof a.imagenPrecision === 'number' && Number.isFinite(a.imagenPrecision) ? a.imagenPrecision : null;
        const imagenGeoEstado = a.imagenGeoEstado ? String(a.imagenGeoEstado).trim() : null;
        const imagenTomadaEn = a.imagenTomadaEn ? new Date(a.imagenTomadaEn) : null;
        const largo = typeof a.largo === 'number' ? a.largo : null;
        const ancho = typeof a.ancho === 'number' ? a.ancho : null;
        const altura = typeof a.altura === 'number' ? a.altura : null;
        const cantidadFromRequest = typeof a.cantidadTotal === 'number' ? a.cantidadTotal : null;
        const cantidadTotal =
          cantidadFromRequest != null && Number.isFinite(cantidadFromRequest)
            ? cantidadFromRequest
            : largo != null && ancho != null && altura != null
              ? largo * ancho * altura
              : null;

        return {
          pk,
          abscisado,
          itemContractual,
          descripcion,
          unidadMedida,
          observacion,
          observacionTexto,
          imagenUrl,
          imagenLatitud,
          imagenLongitud,
          imagenPrecision,
          imagenGeoEstado,
          imagenTomadaEn,
          largo,
          ancho,
          altura,
          cantidadTotal,
        };
      })
      .filter((a) => a.pk && a.abscisado && a.itemContractual && a.descripcion && a.unidadMedida);

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

    await prisma.actividadObra.deleteMany({ where: { informeId } });
    if (cleaned.length > 0) {
      await prisma.actividadObra.createMany({
        data: cleaned.map((a) => ({
            pk: a.pk,
            abscisado: a.abscisado,
            itemContractual: a.itemContractual,
            descripcion: a.descripcion,
            unidadMedida: a.unidadMedida,
            observacion: a.observacion,
            imagenUrl: a.imagenUrl,
            imagenLatitud: a.imagenLatitud,
            imagenLongitud: a.imagenLongitud,
            imagenPrecision: a.imagenPrecision,
            imagenGeoEstado: a.imagenGeoEstado,
            imagenTomadaEn: a.imagenTomadaEn,
            largo: a.largo,
            ancho: a.ancho,
            altura: a.altura,
            cantidadTotal: a.cantidadTotal,
            informeId: informeId as string,
          })),
      });
    }

    const saved = await prisma.actividadObra.findMany({
      where: { informeId: informeId as string },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      actividades: saved.map((a) => ({
        id: a.id,
        pk: a.pk,
        abscisado: a.abscisado,
        itemContractual: a.itemContractual,
        descripcion: a.descripcion,
        unidadMedida: a.unidadMedida,
        observacion: a.observacion,
        observacionTexto: (a as { observacionTexto?: string | null }).observacionTexto ?? '',
        imagenUrl: a.imagenUrl,
        imagenLatitud: a.imagenLatitud,
        imagenLongitud: a.imagenLongitud,
        imagenPrecision: a.imagenPrecision,
        imagenGeoEstado: a.imagenGeoEstado,
        imagenTomadaEn: a.imagenTomadaEn ? a.imagenTomadaEn.toISOString() : null,
        largo: a.largo,
        ancho: a.ancho,
        altura: a.altura,
        cantidadTotal: a.cantidadTotal,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al guardar actividades' }, { status: 500 });
  }
}

