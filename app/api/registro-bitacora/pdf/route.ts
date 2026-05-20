import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import {
  jsonRegistroBitacoraSchemaPendiente,
  prismaIndicaTablaRegistroBitacoraDesactualizada,
} from '../../../../src/lib/prismaRegistroBitacoraSchema';
import {
  fechaRegistroEnRangoObra,
  parseRangoRegistroBitacora,
  parseYmdUtc,
  toYmdUtc,
} from '../../../../src/lib/registroBitacoraFecha';
import { buildRegistroBitacoraPdfDocumentHtml } from '../../../../src/lib/registroBitacoraPdfHtml';
import {
  buildDiaPdfData,
  buildObraPdfBase,
  formatFechaEsPdf,
} from '../../../../src/lib/registroBitacoraPdfBuild';

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const { searchParams, origin } = new URL(req.url);
    const projectId = searchParams.get('projectId')?.trim() ?? '';
    const fechaDesdeStr =
      searchParams.get('fechaDesde')?.trim() ?? searchParams.get('fecha')?.trim() ?? '';
    const fechaHastaStr =
      searchParams.get('fechaHasta')?.trim() ?? searchParams.get('fecha')?.trim() ?? '';

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
      select: {
        name: true,
        code: true,
        description: true,
        startDate: true,
        endDate: true,
        logoUrl: true,
      },
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
      include: { user: { select: { name: true } } },
      orderBy: { fecha: 'asc' },
    });

    if (registros.length === 0) {
      return NextResponse.json(
        {
          error:
            'No hay registros guardados en ese rango de fechas. Guarde al menos un día antes de imprimir.',
        },
        { status: 404 },
      );
    }

    const fechas = registros.map((r) => r.fecha);
    const informes = await prisma.informeDiario.findMany({
      where: { projectId, date: { in: fechas } },
      select: {
        date: true,
        franjaClimaMananaCodigo: true,
        franjaClimaTardeCodigo: true,
        franjaClimaNocheCodigo: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const informePorFecha = new Map<string, (typeof informes)[0]>();
    for (const inf of informes) {
      const key = toYmdUtc(inf.date);
      if (!informePorFecha.has(key)) informePorFecha.set(key, inf);
    }

    const tipos = await prisma.tipoCondicionCatalog.findMany({
      where: { isActive: true },
      select: { codigo: true, nombre: true },
    });
    const catalog = new Map(tipos.map((t) => [t.codigo, t.nombre]));

    const obra = buildObraPdfBase(origin, project);
    const dias = registros.map((reg) => {
      const fecha = reg.fecha;
      const key = toYmdUtc(fecha);
      const informeDia = informePorFecha.get(key) ?? null;
      return buildDiaPdfData(origin, project, reg, fecha, informeDia, catalog);
    });

    const periodoTexto =
      fechaDesdeStr === fechaHastaStr
        ? formatFechaEsPdf(parseYmdUtc(fechaDesdeStr)!)
        : `${formatFechaEsPdf(rango.desde)} — ${formatFechaEsPdf(rango.hasta)}`;

    const toolbarDetalle =
      registros.length === 1
        ? '1 registro'
        : `${registros.length} registros en el período`;

    const html = buildRegistroBitacoraPdfDocumentHtml({
      obra,
      periodoTexto,
      toolbarDetalle,
      dias,
    });

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (prismaIndicaTablaRegistroBitacoraDesactualizada(error)) {
      console.error('GET /api/registro-bitacora/pdf (schema)', error);
      return jsonRegistroBitacoraSchemaPendiente();
    }
    console.error('GET /api/registro-bitacora/pdf', error);
    return NextResponse.json({ error: 'Error al generar el documento' }, { status: 500 });
  }
}
