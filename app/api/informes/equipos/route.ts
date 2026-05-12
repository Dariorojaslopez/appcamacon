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
      include: {
        equipos: {
          orderBy: { createdAt: 'asc' },
          include: { horarios: { orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] } },
        },
      },
    });

    return NextResponse.json({
      exists: Boolean(informe),
      informeCerrado: informe?.informeCerrado ?? false,
      cerradoEn: informe?.cerradoEn ? informe.cerradoEn.toISOString() : null,
      equipos: (informe?.equipos ?? []).map((e) => ({
        id: e.id,
        descripcion: e.descripcion,
        placaRef: e.placaRef,
        propiedad: e.propiedad,
        estado: e.estado,
        observacion: e.observacion,
        imagenUrl: e.imagenUrl,
        imagenLatitud: e.imagenLatitud,
        imagenLongitud: e.imagenLongitud,
        imagenPrecision: e.imagenPrecision,
        imagenGeoEstado: e.imagenGeoEstado,
        imagenTomadaEn: e.imagenTomadaEn ? e.imagenTomadaEn.toISOString() : null,
        horasTrabajadas: e.horasTrabajadas,
        horaIngreso: e.horaIngreso,
        horaSalida: e.horaSalida,
        horarios: e.horarios.map((h) => ({
          id: h.id,
          horaIngreso: h.horaIngreso,
          horaSalida: h.horaSalida,
          horasTrabajadas: h.horasTrabajadas,
          orden: h.orden,
        })),
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar equipos' }, { status: 500 });
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
      equipos?: Array<{
        descripcion: string;
        placaRef?: string;
        propiedad?: string;
        estado?: string;
        observacion?: string;
        imagenUrl?: string;
        imagenLatitud?: number | null;
        imagenLongitud?: number | null;
        imagenPrecision?: number | null;
        imagenGeoEstado?: string | null;
        imagenTomadaEn?: string | null;
        horasTrabajadas?: number;
        horaIngreso?: string;
        horaSalida?: string;
        horarios?: Array<{
          horaIngreso?: string;
          horaSalida?: string;
          horasTrabajadas?: number;
        }>;
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

    const project = await prisma.project.findFirst({ where: { id: projectId, isActive: true } });
    if (!project) {
      return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 400 });
    }

    const items = Array.isArray(body.equipos) ? body.equipos : [];
    const cleaned = items
      .map((e) => {
        const horarios = Array.isArray(e.horarios)
          ? e.horarios
              .map((h) => ({
                horaIngreso: h.horaIngreso ? String(h.horaIngreso).trim() : '',
                horaSalida: h.horaSalida ? String(h.horaSalida).trim() : '',
                horasTrabajadas:
                  typeof h.horasTrabajadas === 'number' && Number.isFinite(h.horasTrabajadas)
                    ? h.horasTrabajadas
                    : 0,
              }))
              .filter((h) => h.horaIngreso && h.horaSalida)
          : [];
        const legacyHoraIngreso = e.horaIngreso ? String(e.horaIngreso).trim() : '';
        const legacyHoraSalida = e.horaSalida ? String(e.horaSalida).trim() : '';
        const legacyHoras =
          typeof e.horasTrabajadas === 'number' && Number.isFinite(e.horasTrabajadas)
            ? e.horasTrabajadas
            : 0;
        const effectiveHorarios =
          horarios.length > 0
            ? horarios
            : legacyHoraIngreso || legacyHoraSalida
              ? [{ horaIngreso: legacyHoraIngreso, horaSalida: legacyHoraSalida, horasTrabajadas: legacyHoras }]
              : [];
        const totalHoras = effectiveHorarios.reduce((sum, h) => sum + (Number(h.horasTrabajadas) || 0), 0);
        return {
          descripcion: String(e.descripcion ?? '').trim(),
          placaRef: e.placaRef ? String(e.placaRef).trim() : null,
          propiedad: e.propiedad ? String(e.propiedad).trim() : null,
          estado: e.estado ? String(e.estado).trim() : null,
          observacion: e.observacion ? String(e.observacion).trim() : null,
          imagenUrl: e.imagenUrl ? String(e.imagenUrl).trim() : null,
          imagenLatitud:
            typeof e.imagenLatitud === 'number' && Number.isFinite(e.imagenLatitud) ? e.imagenLatitud : null,
          imagenLongitud:
            typeof e.imagenLongitud === 'number' && Number.isFinite(e.imagenLongitud) ? e.imagenLongitud : null,
          imagenPrecision:
            typeof e.imagenPrecision === 'number' && Number.isFinite(e.imagenPrecision) ? e.imagenPrecision : null,
          imagenGeoEstado: e.imagenGeoEstado ? String(e.imagenGeoEstado).trim() : null,
          imagenTomadaEn: e.imagenTomadaEn ? new Date(e.imagenTomadaEn) : null,
          horasTrabajadas: totalHoras,
          horaIngreso: effectiveHorarios[0]?.horaIngreso || null,
          horaSalida: effectiveHorarios[effectiveHorarios.length - 1]?.horaSalida || null,
          horarios: effectiveHorarios,
        };
      })
      .filter((e) => e.descripcion);

    const existing = await prisma.informeDiario.findFirst({
      where: { projectId, date, jornadaCatalogoId: jr.id },
      select: { id: true, informeCerrado: true },
    });

    if (existing?.informeCerrado) {
      return informeCerradoJsonResponse();
    }

    let informeId = existing?.id;
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

    await prisma.equipoObra.deleteMany({ where: { informeId } });
    for (const e of cleaned) {
      await prisma.equipoObra.create({
        data: {
          informeId: informeId as string,
          descripcion: e.descripcion,
          placaRef: e.placaRef,
          propiedad: e.propiedad,
          estado: e.estado,
          observacion: e.observacion,
          imagenUrl: e.imagenUrl,
          imagenLatitud: e.imagenLatitud,
          imagenLongitud: e.imagenLongitud,
          imagenPrecision: e.imagenPrecision,
          imagenGeoEstado: e.imagenGeoEstado,
          imagenTomadaEn: e.imagenTomadaEn,
          horasTrabajadas: e.horasTrabajadas,
          horaIngreso: e.horaIngreso,
          horaSalida: e.horaSalida,
          horarios: {
            create: e.horarios.map((h, idx) => ({
              horaIngreso: h.horaIngreso,
              horaSalida: h.horaSalida,
              horasTrabajadas: h.horasTrabajadas,
              orden: idx,
            })),
          },
        },
      });
    }

    const saved = await prisma.equipoObra.findMany({
      where: { informeId: informeId as string },
      orderBy: { createdAt: 'asc' },
      include: { horarios: { orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] } },
    });

    return NextResponse.json({
      ok: true,
      equipos: saved.map((e) => ({
        id: e.id,
        descripcion: e.descripcion,
        placaRef: e.placaRef,
        propiedad: e.propiedad,
        estado: e.estado,
        observacion: e.observacion,
        imagenUrl: e.imagenUrl,
        imagenLatitud: e.imagenLatitud,
        imagenLongitud: e.imagenLongitud,
        imagenPrecision: e.imagenPrecision,
        imagenGeoEstado: e.imagenGeoEstado,
        imagenTomadaEn: e.imagenTomadaEn ? e.imagenTomadaEn.toISOString() : null,
        horasTrabajadas: e.horasTrabajadas,
        horaIngreso: e.horaIngreso,
        horaSalida: e.horaSalida,
        horarios: e.horarios.map((h) => ({
          id: h.id,
          horaIngreso: h.horaIngreso,
          horaSalida: h.horaSalida,
          horasTrabajadas: h.horasTrabajadas,
          orden: h.orden,
        })),
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al guardar equipos' }, { status: 500 });
  }
}

