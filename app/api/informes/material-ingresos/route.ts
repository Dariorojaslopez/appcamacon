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
      include: { materialIngresos: { orderBy: { createdAt: 'asc' } } },
    });

    return NextResponse.json({
      exists: Boolean(informe),
      informeCerrado: informe?.informeCerrado ?? false,
      cerradoEn: informe?.cerradoEn ? informe.cerradoEn.toISOString() : null,
      ingresos: (informe?.materialIngresos ?? []).map((m) => ({
        id: m.id,
        proveedor: m.proveedor,
        tipoMaterial: m.tipoMaterial,
        noRemision: m.noRemision,
        unidad: m.unidad,
        cantidad: m.cantidad,
        observacion: m.observacion,
        imagenUrl: m.imagenUrl,
        imagenLatitud: m.imagenLatitud,
        imagenLongitud: m.imagenLongitud,
        imagenPrecision: m.imagenPrecision,
        imagenGeoEstado: m.imagenGeoEstado,
        imagenTomadaEn: m.imagenTomadaEn ? m.imagenTomadaEn.toISOString() : null,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar ingresos' }, { status: 500 });
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
      ingresos?: Array<{
        proveedor: string;
        tipoMaterial: string;
        noRemision: string;
        unidad: string;
        cantidad?: number;
        observacion?: string;
        imagenUrl?: string;
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

    const items = Array.isArray(body.ingresos) ? body.ingresos : [];
    const cleaned = items
      .map((m) => ({
        proveedor: String(m.proveedor ?? '').trim(),
        tipoMaterial: String(m.tipoMaterial ?? '').trim(),
        noRemision: String(m.noRemision ?? '').trim(),
        unidad: String(m.unidad ?? '').trim(),
        cantidad:
          typeof m.cantidad === 'number' && Number.isFinite(m.cantidad) ? m.cantidad : null,
        observacion: m.observacion ? String(m.observacion).trim() : null,
        imagenUrl: m.imagenUrl ? String(m.imagenUrl).trim() : null,
        imagenLatitud:
          typeof m.imagenLatitud === 'number' && Number.isFinite(m.imagenLatitud) ? m.imagenLatitud : null,
        imagenLongitud:
          typeof m.imagenLongitud === 'number' && Number.isFinite(m.imagenLongitud) ? m.imagenLongitud : null,
        imagenPrecision:
          typeof m.imagenPrecision === 'number' && Number.isFinite(m.imagenPrecision) ? m.imagenPrecision : null,
        imagenGeoEstado: m.imagenGeoEstado ? String(m.imagenGeoEstado).trim() : null,
        imagenTomadaEn: m.imagenTomadaEn ? new Date(m.imagenTomadaEn) : null,
      }))
      .filter((m) => m.proveedor && m.tipoMaterial && m.noRemision && m.unidad);

    const informe = await prisma.informeDiario.findFirst({
      where: { projectId, date, jornadaCatalogoId: jr.id },
      select: { id: true, informeCerrado: true },
    });

    if (informe?.informeCerrado) {
      return informeCerradoJsonResponse();
    }

    let informeId = informe?.id;
    if (!informeId) {
      const project = await prisma.project.findFirst({ where: { id: projectId, isActive: true } });
      if (!project) return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 400 });

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

    await prisma.materialIngreso.deleteMany({ where: { informeId } });
    if (cleaned.length > 0) {
      await prisma.materialIngreso.createMany({
        data: cleaned.map((m) => ({ ...m, informeId: informeId as string })),
      });
    }

    const saved = await prisma.materialIngreso.findMany({
      where: { informeId: informeId as string },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      ingresos: saved.map((m) => ({
        id: m.id,
        proveedor: m.proveedor,
        tipoMaterial: m.tipoMaterial,
        noRemision: m.noRemision,
        unidad: m.unidad,
        cantidad: m.cantidad,
        observacion: m.observacion,
        imagenUrl: m.imagenUrl,
        imagenLatitud: m.imagenLatitud,
        imagenLongitud: m.imagenLongitud,
        imagenPrecision: m.imagenPrecision,
        imagenGeoEstado: m.imagenGeoEstado,
        imagenTomadaEn: m.imagenTomadaEn ? m.imagenTomadaEn.toISOString() : null,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al guardar ingresos' }, { status: 500 });
  }
}

