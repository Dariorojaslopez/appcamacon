import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import {
  jsonRegistroBitacoraSchemaPendiente,
  prismaIndicaTablaRegistroBitacoraDesactualizada,
} from '../../../../src/lib/prismaRegistroBitacoraSchema';
import { storedMediaImgSrc } from '../../../../src/lib/evidenciasUrlPayload';
import { diffInclusiveCalendarDaysUtc, parseYmdUtc } from '../../../../src/lib/registroBitacoraFecha';
import {
  buildRegistroBitacoraPdfHtml,
  resolveClimaFranja,
  type RegistroBitacoraPdfSlot,
} from '../../../../src/lib/registroBitacoraPdfHtml';
import { REGISTRO_BITACORA_SLOT_LABELS } from '../../../../src/shared/registroBitacoraPermissions';

function absMedia(origin: string, stored: string | null | undefined): string {
  const rel = storedMediaImgSrc(stored) ?? (typeof stored === 'string' && stored.trim() ? stored.trim() : '');
  if (!rel) return '';
  if (rel.startsWith('http')) return rel;
  return `${origin}${rel.startsWith('/') ? '' : '/'}${rel}`;
}

function weekdayEs(fecha: Date): string {
  const d = fecha.toLocaleDateString('es-CO', { weekday: 'long', timeZone: 'UTC' });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function formatFechaEs(fecha: Date): string {
  return fecha.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const { searchParams, origin } = new URL(req.url);
    const projectId = searchParams.get('projectId')?.trim() ?? '';
    const fechaStr = searchParams.get('fecha')?.trim() ?? '';
    if (!projectId || !fechaStr) {
      return NextResponse.json({ error: 'projectId y fecha (YYYY-MM-DD) son requeridos' }, { status: 400 });
    }
    const fecha = parseYmdUtc(fechaStr);
    if (!fecha) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { name: true, code: true, description: true, startDate: true, endDate: true, logoUrl: true },
    });
    if (!project) return NextResponse.json({ error: 'Obra no encontrada' }, { status: 404 });

    const reg = await prisma.registroBitacoraObra.findUnique({
      where: { projectId_fecha: { projectId, fecha } },
      include: { user: { select: { name: true } } },
    });
    if (!reg) {
      return NextResponse.json(
        { error: 'No hay registro de bitácora para esa fecha. Guárdelo primero.' },
        { status: 404 },
      );
    }

    const informeDia = await prisma.informeDiario.findFirst({
      where: { projectId, date: fecha },
      orderBy: { updatedAt: 'desc' },
      select: {
        franjaClimaMananaCodigo: true,
        franjaClimaTardeCodigo: true,
        franjaClimaNocheCodigo: true,
      },
    });

    const tipos = await prisma.tipoCondicionCatalog.findMany({
      where: { isActive: true },
      select: { codigo: true, nombre: true },
    });
    const catalog = new Map(tipos.map((t) => [t.codigo, t.nombre]));

    const codManana = reg.franjaClimaMananaCodigo ?? informeDia?.franjaClimaMananaCodigo;
    const codTarde = reg.franjaClimaTardeCodigo ?? informeDia?.franjaClimaTardeCodigo;
    const codNoche = reg.franjaClimaNocheCodigo ?? informeDia?.franjaClimaNocheCodigo;

    const manana = resolveClimaFranja(codManana, catalog);
    const tarde = resolveClimaFranja(codTarde, catalog);
    const noche = resolveClimaFranja(codNoche, catalog);

    let plazoDias: number | null = null;
    let transcurridoDias: number | null = null;
    if (project.startDate && project.endDate) {
      plazoDias = diffInclusiveCalendarDaysUtc(project.startDate, project.endDate);
    }
    if (project.startDate) {
      transcurridoDias = diffInclusiveCalendarDaysUtc(project.startDate, fecha);
    }

    const rangoTxt =
      project.startDate && project.endDate
        ? `${formatFechaEs(project.startDate)} hasta ${formatFechaEs(project.endDate)}`
        : project.startDate
          ? `Desde ${formatFechaEs(project.startDate)}`
          : project.endDate
            ? `Hasta ${formatFechaEs(project.endDate)}`
            : '—';

    const contratoTexto = project.description?.trim() || project.code;

    const secciones: RegistroBitacoraPdfSlot[] = [
      {
        titulo: REGISTRO_BITACORA_SLOT_LABELS.contratista,
        observaciones: reg.contratistaObservaciones,
        fotoUrl: absMedia(origin, reg.contratistaFotoUrl),
        firmaUrl: absMedia(origin, reg.contratistaFirmaUrl),
      },
      {
        titulo: REGISTRO_BITACORA_SLOT_LABELS.interventor,
        observaciones: reg.interventoriaObservaciones,
        fotoUrl: absMedia(origin, reg.interventoriaFotoUrl),
        firmaUrl: absMedia(origin, reg.interventoriaFirmaUrl),
      },
      {
        titulo: REGISTRO_BITACORA_SLOT_LABELS.idu,
        observaciones: reg.iduObservaciones,
        fotoUrl: absMedia(origin, reg.iduFotoUrl),
        firmaUrl: absMedia(origin, reg.iduFirmaUrl),
      },
    ];

    const html = buildRegistroBitacoraPdfHtml({
      origin,
      obraNombre: project.name,
      obraCodigo: project.code,
      obraLogoUrl: absMedia(origin, project.logoUrl),
      camaconLogoUrl: `${origin}/images/Logo_camacon.png`,
      consecutivo: reg.consecutivo,
      fechaTexto: formatFechaEs(fecha),
      diaSemana: weekdayEs(fecha),
      rangoObraTexto: rangoTxt,
      plazoContractualDias: plazoDias,
      tiempoTranscurridoDias: transcurridoDias,
      contratoTexto,
      climaFilas: [
        { franja: 'Mañana', tiempoHtml: manana.tiempoHtml, condicion: manana.condicion },
        { franja: 'Tarde', tiempoHtml: tarde.tiempoHtml, condicion: tarde.condicion },
        { franja: 'Noche', tiempoHtml: noche.tiempoHtml, condicion: noche.condicion },
      ],
      secciones,
      registradoPor: reg.user.name,
      actualizadoTexto: reg.updatedAt.toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
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
