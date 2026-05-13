import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import { resolveJornadaCatalogoId } from '../../../../src/lib/informeDailyScope';

function padNumber(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    verifyAccessToken(authCookie);

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const dateParam = searchParams.get('date'); // YYYY-MM-DD (opcional)
    const jornadaId = searchParams.get('jornadaId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId es requerido' }, { status: 400 });
    }

    const jr = await resolveJornadaCatalogoId(jornadaId);
    if (jr.valid === false) {
      return NextResponse.json({ error: jr.error }, { status: jr.status });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 400 });
    }

    const now = new Date();
    const baseDate = dateParam ? new Date(dateParam) : new Date(now.toISOString().slice(0, 10));
    if (Number.isNaN(baseDate.getTime())) {
      return NextResponse.json({ error: 'date no válida' }, { status: 400 });
    }
    baseDate.setUTCHours(0, 0, 0, 0);

    const existing = await prisma.informeDiario.findFirst({
      where: { projectId, date: baseDate, jornadaCatalogoId: jr.id },
      select: {
        id: true,
        informeNo: true,
        centroTrabajo: true,
        frenteObra: true,
        frenteObraCatalogoId: true,
        contratista: true,
        contratistaCatalogoId: true,
        encargadoReporte: true,
        encargadoReporteCatalogoId: true,
        cargo: true,
        cargoCatalogoId: true,
        horaEntrada: true,
        horaSalida: true,
        huboSuspension: true,
        motivoSuspension: true,
        horaSuspension: true,
        horaReinicio: true,
        tipoClima: true,
        horasClima: true,
        franjaClimaMananaCodigo: true,
        franjaClimaTardeCodigo: true,
        franjaClimaNocheCodigo: true,
        informeCerrado: true,
        cerradoEn: true,
      },
    });

    if (existing) {
      return NextResponse.json({
        date: baseDate.toISOString().slice(0, 10),
        informeNo: existing.informeNo,
        centroTrabajo: existing.centroTrabajo,
        existing: true,
        informeCerrado: existing.informeCerrado,
        cerradoEn: existing.cerradoEn ? existing.cerradoEn.toISOString() : null,
        fields: {
          frenteObra: existing.frenteObra ?? '',
          frenteObraCatalogoId: existing.frenteObraCatalogoId ?? '',
          contratista: existing.contratista ?? '',
          contratistaCatalogoId: existing.contratistaCatalogoId ?? '',
          encargadoReporte: existing.encargadoReporte ?? '',
          encargadoReporteCatalogoId: existing.encargadoReporteCatalogoId ?? '',
          cargo: existing.cargo ?? '',
          cargoCatalogoId: existing.cargoCatalogoId ?? '',
          horaEntrada: existing.horaEntrada ?? '',
          horaSalida: existing.horaSalida ?? '',
          huboSuspension: existing.huboSuspension ?? false,
          motivoSuspension: existing.motivoSuspension ?? '',
          horaSuspension: existing.horaSuspension ?? '',
          horaReinicio: existing.horaReinicio ?? '',
          tipoClima: existing.tipoClima ?? '',
          horasClima: existing.horasClima ?? 0,
          franjaClimaManana: existing.franjaClimaMananaCodigo ?? '',
          franjaClimaTarde: existing.franjaClimaTardeCodigo ?? '',
          franjaClimaNoche: existing.franjaClimaNocheCodigo ?? '',
        },
      });
    }

    const maxByProject = await prisma.informeDiario.aggregate({
      where: { projectId },
      _max: { informeConsecutivo: true, centroTrabajoConsecutivo: true },
    });
    const nextInformeConsecutivo = (maxByProject._max.informeConsecutivo ?? 0) + 1;
    const nextCentroTrabajoConsecutivo = (maxByProject._max.centroTrabajoConsecutivo ?? 0) + 1;

    const year = baseDate.getUTCFullYear();
    const informeNo = `IDO-${year}-${padNumber(nextInformeConsecutivo, 3)}`;
    const centroTrabajo = `CT-${padNumber(nextCentroTrabajoConsecutivo, 3)}`;

    return NextResponse.json({
      date: baseDate.toISOString().slice(0, 10),
      informeNo,
      centroTrabajo,
      existing: false,
      informeCerrado: false,
      cerradoEn: null,
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al calcular consecutivos' }, { status: 500 });
  }
}

