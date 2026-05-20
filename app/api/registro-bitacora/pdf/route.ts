import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import {
  jsonRegistroBitacoraSchemaPendiente,
  prismaIndicaTablaRegistroBitacoraDesactualizada,
} from '../../../../src/lib/prismaRegistroBitacoraSchema';
import {
  buildUtcDateRangeInclusive,
  fechaRegistroEnRangoObra,
  parseRangoRegistroBitacora,
  parseYmdUtc,
  toYmdUtc,
} from '../../../../src/lib/registroBitacoraFecha';
import { buildPdfPreviewContentSecurityPolicy, generateNonce } from '../../../../src/lib/csp';
import { buildRegistroBitacoraPdfDocumentHtml } from '../../../../src/lib/registroBitacoraPdfHtml';
import {
  groupInformesClimaPorYmd,
  sortedYmdKeysConDatosEnRango,
} from '../../../../src/lib/registroBitacoraClimaPdf';
import {
  buildDiaPdfData,
  buildDiaPdfDataSoloInforme,
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

    const rangoInformes = buildUtcDateRangeInclusive(rango.desde, rango.hasta);
    const informes = await prisma.informeDiario.findMany({
      where: {
        projectId,
        date: { gte: rangoInformes.gte, lt: rangoInformes.lt },
      },
      select: {
        date: true,
        franjaClimaMananaCodigo: true,
        franjaClimaTardeCodigo: true,
        franjaClimaNocheCodigo: true,
        jornadaCatalogo: {
          select: { nombre: true, horaInicio: true, horaFin: true, orden: true },
        },
      },
      orderBy: [{ date: 'asc' }, { jornadaCatalogo: { orden: 'asc' } }],
    });

    const informesPorFecha = groupInformesClimaPorYmd(informes);
    const diasYmd = sortedYmdKeysConDatosEnRango(rango.desde, rango.hasta, registros, informesPorFecha);

    if (diasYmd.length === 0) {
      return NextResponse.json(
        {
          error:
            'No hay registros de bitácora ni informes diarios en ese rango de fechas.',
        },
        { status: 404 },
      );
    }

    const registrosByYmd = new Map(registros.map((r) => [toYmdUtc(r.fecha), r] as const));

    const tipos = await prisma.tipoCondicionCatalog.findMany({
      where: { isActive: true },
      select: { codigo: true, nombre: true },
    });
    const catalog = new Map(tipos.map((t) => [t.codigo, t.nombre]));

    const obra = buildObraPdfBase(origin, project);
    const dias = diasYmd.map((ymd) => {
      const fecha = parseYmdUtc(ymd)!;
      const informesDelDia = informesPorFecha.get(ymd) ?? [];
      const reg = registrosByYmd.get(ymd);
      if (reg) {
        return buildDiaPdfData(origin, project, reg, fecha, informesDelDia, catalog);
      }
      return buildDiaPdfDataSoloInforme(project, fecha, informesDelDia, catalog);
    });

    const periodoTexto =
      fechaDesdeStr === fechaHastaStr
        ? formatFechaEsPdf(parseYmdUtc(fechaDesdeStr)!)
        : `${formatFechaEsPdf(rango.desde)} — ${formatFechaEsPdf(rango.hasta)}`;

    const toolbarDetalle =
      dias.length === 1 ? '1 día' : `${dias.length} días en el período`;

    const styleNonce = req.headers.get('x-nonce') ?? generateNonce();

    const html = buildRegistroBitacoraPdfDocumentHtml({
      obra,
      periodoTexto,
      toolbarDetalle,
      dias,
      styleNonce,
    });

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': buildPdfPreviewContentSecurityPolicy(styleNonce),
      },
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
