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
import { buildPdfPreviewContentSecurityPolicy, generateNonce } from '../../../../src/lib/csp';
import { buildRegistroBitacoraPdfDocumentHtml } from '../../../../src/lib/registroBitacoraPdfHtml';
import { findInformesDiariosEnRango } from '../../../../src/lib/registroBitacoraClimaPdf';
import {
  buildInformeDiarioPdfPage,
  buildObraPdfBase,
  buildRegistroSinInformePdfPage,
  formatFechaEsPdf,
} from '../../../../src/lib/registroBitacoraPdfBuild';
import {
  informeDiarioTieneDatosParaPdf,
  paginaRegistroBitacoraPdfTieneDatos,
  registroBitacoraTieneDatosParaPdf,
} from '../../../../src/lib/registroBitacoraPdfDatos';
import { fetchFolioPorFechaMap, syncRegistroBitacoraConsecutivos } from '../../../../src/lib/registroBitacoraFolio';
import { authFromRequest, isAuthPayload, requireAccessibleProject } from '../../../../src/lib/requireProjectAccess';
import type { RegistroBitacoraPdfDia } from '../../../../src/lib/registroBitacoraPdfHtml';

export async function GET(req: NextRequest) {
  try {
    const auth = authFromRequest(req);
    if (!isAuthPayload(auth)) return auth;

    const { searchParams, origin } = new URL(req.url);
    const projectId = searchParams.get('projectId')?.trim() ?? '';

    const denied = await requireAccessibleProject(auth, projectId);
    if (denied) return denied;
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

    const informes = await findInformesDiariosEnRango(projectId, rango.desde, rango.hasta);

    const registros = await prisma.registroBitacoraObra.findMany({
      where: {
        projectId,
        fecha: { gte: rango.desde, lte: rango.hasta },
      },
      include: { user: { select: { name: true } } },
    });
    const registrosByYmd = new Map(registros.map((r) => [toYmdUtc(r.fecha), r] as const));
    const informeYmds = new Set(informes.map((inf) => toYmdUtc(inf.date)));

    const tipos = await prisma.tipoCondicionCatalog.findMany({
      where: { isActive: true },
      select: { codigo: true, nombre: true },
    });
    const catalog = new Map(tipos.map((t) => [t.codigo, t.nombre]));

    const obra = await buildObraPdfBase(origin, project);
    const paginas: { ymd: string; dia: RegistroBitacoraPdfDia }[] = [];

    for (const informe of informes) {
      const ymd = toYmdUtc(informe.date);
      const reg = registrosByYmd.get(ymd) ?? null;
      const informeConDatos = informeDiarioTieneDatosParaPdf(informe);
      const registroConDatos = reg != null && registroBitacoraTieneDatosParaPdf(reg);
      if (!informeConDatos && !registroConDatos) continue;

      const dia = buildInformeDiarioPdfPage(origin, project, informe, reg, catalog);
      if (!paginaRegistroBitacoraPdfTieneDatos(dia)) continue;
      paginas.push({ ymd, dia });
    }

    for (const reg of registros) {
      const ymd = toYmdUtc(reg.fecha);
      if (informeYmds.has(ymd)) continue;
      if (!registroBitacoraTieneDatosParaPdf(reg)) continue;

      const dia = buildRegistroSinInformePdfPage(origin, project, reg.fecha, reg, catalog);
      if (!paginaRegistroBitacoraPdfTieneDatos(dia)) continue;
      paginas.push({ ymd, dia });
    }

    paginas.sort((a, b) => a.ymd.localeCompare(b.ymd));

    await syncRegistroBitacoraConsecutivos(projectId);
    const folioPorFecha = await fetchFolioPorFechaMap(projectId);
    const dias = paginas.map((p) => {
      const folio = folioPorFecha.get(p.ymd);
      if (folio == null || p.dia.consecutivo <= 0) return p.dia;
      return { ...p.dia, consecutivo: folio };
    });

    if (dias.length === 0) {
      return NextResponse.json(
        {
          error:
            'No hay días con datos en ese rango. Registre bitácora o datos del día antes de imprimir.',
        },
        { status: 404 },
      );
    }

    const periodoTexto =
      fechaDesdeStr === fechaHastaStr
        ? formatFechaEsPdf(parseYmdUtc(fechaDesdeStr)!)
        : `${formatFechaEsPdf(rango.desde)} — ${formatFechaEsPdf(rango.hasta)}`;

    const foliosBitacora = dias.map((d) => d.consecutivo).filter((c) => c > 0);
    const toolbarDetalle = (() => {
      if (dias.length === 1) {
        const folio = foliosBitacora[0];
        return folio != null ? `1 hoja · folio ${folio}` : '1 hoja';
      }
      const foliosTxt =
        foliosBitacora.length === 0
          ? ''
          : foliosBitacora.length === 1
            ? ` · folio ${foliosBitacora[0]}`
            : ` · folios ${Math.min(...foliosBitacora)} a ${Math.max(...foliosBitacora)}`;
      return `${dias.length} hojas${foliosTxt}`;
    })();

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
