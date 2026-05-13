import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import {
  jsonRegistroBitacoraSchemaPendiente,
  prismaIndicaTablaRegistroBitacoraDesactualizada,
} from '../../../../src/lib/prismaRegistroBitacoraSchema';
import { storedMediaImgSrc } from '../../../../src/lib/evidenciasUrlPayload';
import { diffInclusiveCalendarDaysUtc, parseYmdUtc } from '../../../../src/lib/registroBitacoraFecha';

function absMedia(origin: string, stored: string | null | undefined): string {
  const rel = storedMediaImgSrc(stored) ?? (typeof stored === 'string' && stored.trim() ? stored.trim() : '');
  if (!rel) return '';
  if (rel.startsWith('http')) return rel;
  return `${origin}${rel.startsWith('/') ? '' : '/'}${rel}`;
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function weekdayEs(fecha: Date): string {
  return fecha.toLocaleDateString('es-CO', { weekday: 'long', timeZone: 'UTC' });
}

function formatFechaEs(fecha: Date): string {
  return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
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
      select: { name: true, code: true, startDate: true, endDate: true, logoUrl: true },
    });
    if (!project) return NextResponse.json({ error: 'Obra no encontrada' }, { status: 404 });

    const reg = await prisma.registroBitacoraObra.findUnique({
      where: { projectId_fecha: { projectId, fecha } },
      include: { user: { select: { name: true } } },
    });
    if (!reg) {
      return NextResponse.json({ error: 'No hay registro de bitácora para esa fecha. Guárdelo primero.' }, { status: 404 });
    }

    const codigos = [reg.franjaClimaMananaCodigo, reg.franjaClimaTardeCodigo, reg.franjaClimaNocheCodigo].filter(
      (c): c is string => !!c && c.trim().length > 0,
    );
    const tipos =
      codigos.length > 0
        ? await prisma.tipoCondicionCatalog.findMany({
            where: { codigo: { in: codigos }, isActive: true },
            select: { codigo: true, nombre: true },
          })
        : [];
    const nombreClima = (cod: string | null | undefined) => {
      if (!cod?.trim()) return '—';
      const t = tipos.find((x) => x.codigo === cod);
      return t?.nombre ?? cod;
    };

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

    const logoSrc = absMedia(origin, project.logoUrl);

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Registro de bitácora — ${esc(project.name)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 24px; font-size: 13px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #374151; padding: 8px 10px; vertical-align: top; }
    th { background: #f3f4f6; font-weight: 600; text-align: left; }
    .header-grid { display: grid; grid-template-columns: 1fr 100px 1fr; gap: 16px; align-items: start; margin-bottom: 20px; }
    .logo-box { min-height: 56px; display: flex; align-items: center; justify-content: center; }
    .logo-box img { max-height: 72px; max-width: 220px; object-fit: contain; }
    .meta-num { font-size: 13px; }
    .obra-row { display: grid; grid-template-columns: 32px 1fr 200px; gap: 0; border: 1px solid #374151; margin-bottom: 16px; }
    .obra-side { writing-mode: vertical-rl; transform: rotate(180deg); background: #f9fafb; text-align: center; padding: 8px 4px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; border-right: 1px solid #374151; }
    .obra-main { padding: 12px 14px; border-right: 1px solid #374151; }
    .obra-side2 { padding: 0; }
    .obra-side2 table { height: 100%; border: none; }
    .obra-side2 td, .obra-side2 th { border: 1px solid #374151; }
    h1 { margin: 0 0 6px; font-size: 15px; text-transform: uppercase; }
    .muted { color: #6b7280; font-size: 12px; }
    .clima-ico { font-size: 18px; margin-right: 6px; }
    @media print { button { display: none; } body { margin: 12mm; } }
  </style>
</head>
<body>
  <button type="button" onclick="window.print()">Imprimir / guardar como PDF</button>

  <div class="header-grid">
    <div class="logo-box">${logoSrc ? `<img src="${esc(logoSrc)}" alt="Logo obra" />` : '<span class="muted">Sin logo</span>'}</div>
    <div style="text-align:center;"><span style="display:inline-block;width:72px;height:72px;border-radius:50%;border:3px solid #edd501;line-height:66px;font-size:11px;">OBRA</span></div>
    <table class="meta-num" style="width:auto;margin-left:auto;max-width:280px;">
      <tr><th>Número</th><td>${esc(reg.consecutivo)}</td></tr>
      <tr><th>Fecha</th><td>${esc(formatFechaEs(fecha))}</td></tr>
      <tr><th>Día de la semana</th><td>${esc(weekdayEs(fecha))}</td></tr>
    </table>
  </div>

  <div class="obra-row">
    <div class="obra-side">Obra</div>
    <div class="obra-main">
      <h1>${esc(project.code)} — ${esc(project.name)}</h1>
      <p class="muted" style="margin:0;">${esc(rangoTxt)}</p>
    </div>
    <div class="obra-side2">
      <table>
        <tr><th>Plazo contractual</th></tr>
        <tr><td>${plazoDias != null ? esc(`${plazoDias} días`) : '—'}</td></tr>
        <tr><th>Tiempo transcurrido</th></tr>
        <tr><td>${transcurridoDias != null ? esc(`${transcurridoDias} días`) : '—'}</td></tr>
      </table>
    </div>
  </div>

  <table style="margin-bottom:16px;max-width:520px;">
    <tr><th colspan="2">Condición climática</th></tr>
    <tr><th>Tiempo</th><th>Estado</th></tr>
    <tr><td>Mañana</td><td><span class="clima-ico">☀</span>${esc(nombreClima(reg.franjaClimaMananaCodigo))}</td></tr>
    <tr><td>Tarde</td><td><span class="clima-ico">☀</span>${esc(nombreClima(reg.franjaClimaTardeCodigo))}</td></tr>
    <tr><td>Noche</td><td><span class="clima-ico">☁</span>${esc(nombreClima(reg.franjaClimaNocheCodigo))}</td></tr>
  </table>

  <h2 style="font-size:14px;border-bottom:1px solid #d1d5db;padding-bottom:4px;">Contratista</h2>
  <p style="white-space:pre-wrap;">${esc(reg.contratistaObservaciones || '—')}</p>
  ${reg.contratistaFotoUrl ? `<p><img src="${esc(absMedia(origin, reg.contratistaFotoUrl))}" alt="Foto" style="max-width:320px;border:1px solid #e5e7eb;" /></p>` : ''}
  ${reg.contratistaFirmaUrl ? `<p><strong>Firma</strong><br/><img src="${esc(absMedia(origin, reg.contratistaFirmaUrl))}" alt="Firma" style="max-height:100px;" /></p>` : ''}

  <h2 style="font-size:14px;border-bottom:1px solid #d1d5db;padding-bottom:4px;">Interventoría</h2>
  <p style="white-space:pre-wrap;">${esc(reg.interventoriaObservaciones || '—')}</p>
  ${reg.interventoriaFotoUrl ? `<p><img src="${esc(absMedia(origin, reg.interventoriaFotoUrl))}" alt="Foto" style="max-width:320px;border:1px solid #e5e7eb;" /></p>` : ''}
  ${reg.interventoriaFirmaUrl ? `<p><strong>Firma</strong><br/><img src="${esc(absMedia(origin, reg.interventoriaFirmaUrl))}" alt="Firma" style="max-height:100px;" /></p>` : ''}

  <h2 style="font-size:14px;border-bottom:1px solid #d1d5db;padding-bottom:4px;">IDU</h2>
  <p style="white-space:pre-wrap;">${esc(reg.iduObservaciones || '—')}</p>
  ${reg.iduFotoUrl ? `<p><img src="${esc(absMedia(origin, reg.iduFotoUrl))}" alt="Foto" style="max-width:320px;border:1px solid #e5e7eb;" /></p>` : ''}
  ${reg.iduFirmaUrl ? `<p><strong>Firma</strong><br/><img src="${esc(absMedia(origin, reg.iduFirmaUrl))}" alt="Firma" style="max-height:100px;" /></p>` : ''}

  <p class="muted" style="margin-top:24px;">Registrado por: ${esc(reg.user.name)} · Actualizado: ${esc(reg.updatedAt.toISOString())}</p>
</body>
</html>`;

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
