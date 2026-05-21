import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import {
  jsonRegistroBitacoraSchemaPendiente,
  prismaIndicaTablaRegistroBitacoraDesactualizada,
} from '../../../../src/lib/prismaRegistroBitacoraSchema';
import {
  diffInclusiveCalendarDaysUtc,
  fechaRegistroEnRangoObra,
  parseRangoRegistroBitacora,
  toYmdUtc,
} from '../../../../src/lib/registroBitacoraFecha';
import { findInformesDiariosEnRango } from '../../../../src/lib/registroBitacoraClimaPdf';
import { authFromRequest, isAuthPayload, requireAccessibleProject } from '../../../../src/lib/requireProjectAccess';

export async function GET(req: NextRequest) {
  try {
    const auth = authFromRequest(req);
    if (!isAuthPayload(auth)) return auth;

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim() ?? '';

    const denied = await requireAccessibleProject(auth, projectId);
    if (denied) return denied;
    const fechaDesdeStr = req.nextUrl.searchParams.get('fechaDesde')?.trim() ?? '';
    const fechaHastaStr = req.nextUrl.searchParams.get('fechaHasta')?.trim() ?? '';

    if (!projectId || !fechaDesdeStr || !fechaHastaStr) {
      return NextResponse.json(
        { error: 'projectId, fechaDesde y fechaHasta (YYYY-MM-DD) son requeridos' },
        { status: 400 },
      );
    }

    const rango = parseRangoRegistroBitacora(fechaDesdeStr, fechaHastaStr);
    if (rango.ok === false) {
      return NextResponse.json({ error: rango.error }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { startDate: true, endDate: true },
    });
    if (!project) return NextResponse.json({ error: 'Obra no encontrada' }, { status: 404 });

    const rangoObraDesde = fechaRegistroEnRangoObra(rango.desde, project.startDate, project.endDate);
    if (rangoObraDesde.ok === false) {
      return NextResponse.json({ error: rangoObraDesde.error }, { status: 400 });
    }
    const rangoObraHasta = fechaRegistroEnRangoObra(rango.hasta, project.startDate, project.endDate);
    if (rangoObraHasta.ok === false) {
      return NextResponse.json({ error: rangoObraHasta.error }, { status: 400 });
    }

    const registros = await prisma.registroBitacoraObra.findMany({
      where: {
        projectId,
        fecha: { gte: rango.desde, lte: rango.hasta },
      },
      select: { fecha: true, consecutivo: true },
      orderBy: { fecha: 'asc' },
    });

    const totalDias = diffInclusiveCalendarDaysUtc(rango.desde, rango.hasta);
    const informesEnRango = await findInformesDiariosEnRango(projectId, rango.desde, rango.hasta);

    return NextResponse.json({
      fechaDesde: fechaDesdeStr,
      fechaHasta: fechaHastaStr,
      totalDias,
      conRegistro: registros.length,
      conInforme: informesEnRango.length,
      registros: registros.map((r) => ({
        fecha: toYmdUtc(r.fecha),
        consecutivo: r.consecutivo,
      })),
      informes: informesEnRango.map((inf) => ({
        fecha: toYmdUtc(inf.date),
        informeNo: inf.informeNo ?? null,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (prismaIndicaTablaRegistroBitacoraDesactualizada(error)) {
      return jsonRegistroBitacoraSchemaPendiente();
    }
    console.error('GET /api/registro-bitacora/rango', error);
    return NextResponse.json({ error: 'Error al consultar el rango' }, { status: 500 });
  }
}
