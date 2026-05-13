import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import { resolveJornadaCatalogoId } from '../../../../src/lib/informeDailyScope';
import { syncBitacoraFromInforme } from '../../../../src/lib/bitacora';

function normalizeDate(date: string): Date | null {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);

    const { searchParams, origin } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const dateStr = searchParams.get('date');
    const jornadaId = searchParams.get('jornadaId');
    if (!projectId || !dateStr) {
      return NextResponse.json({ error: 'projectId y date son requeridos' }, { status: 400 });
    }
    const date = normalizeDate(dateStr);
    if (!date) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });
    const jr = await resolveJornadaCatalogoId(jornadaId);
    if (jr.valid === false) return NextResponse.json({ error: jr.error }, { status: jr.status });

    const informe = await prisma.informeDiario.findFirst({
      where: { projectId, date, jornadaCatalogoId: jr.id },
      include: { project: true, jornadaCatalogo: true, bitacoraClimas: true },
    });
    if (!informe) return NextResponse.json({ error: 'No existe informe para generar bitácora' }, { status: 404 });

    await syncBitacoraFromInforme({
      informeId: informe.id,
      req,
      userId: payload.sub as string,
      userRole: payload.role,
    });

    const eventos = await prisma.bitacoraEvento.findMany({
      where: { informeId: informe.id, deletedAt: null },
      include: { evidencias: true, firmas: true },
      orderBy: [{ hora: 'asc' }, { timestampUtc: 'asc' }],
    });
    const hash = eventos.length ? eventos[eventos.length - 1].hashIntegridad : 'SIN-EVENTOS';
    const validationUrl = `${origin}/api/bitacora/eventos?projectId=${encodeURIComponent(projectId)}&date=${encodeURIComponent(dateStr)}${jornadaId ? `&jornadaId=${encodeURIComponent(jornadaId)}` : ''}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(validationUrl)}`;
    const clima = informe.bitacoraClimas[0];

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Bitácora Digital de Obra - ${esc(informe.project.name)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 28px; }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 3px solid #edd501; padding-bottom: 16px; }
    h1 { margin: 0; font-size: 22px; text-transform: uppercase; }
    h2 { margin-top: 26px; font-size: 16px; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; }
    .meta { font-size: 12px; line-height: 1.6; }
    .qr { text-align: right; font-size: 11px; max-width: 190px; }
    .timeline { margin-top: 18px; border-left: 3px solid #edd501; padding-left: 18px; }
    .event { margin: 0 0 14px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px; page-break-inside: avoid; }
    .event strong { color: #111485; }
    .muted { color: #6b7280; font-size: 12px; }
    .photos img { width: 110px; height: 80px; object-fit: cover; border: 1px solid #d1d5db; border-radius: 8px; margin: 6px 6px 0 0; }
    .hash { font-family: monospace; word-break: break-all; background: #f3f4f6; padding: 8px; border-radius: 8px; }
    @media print { button { display: none; } body { margin: 14mm; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Guardar / imprimir como PDF oficial</button>
  <header>
    <div>
      <h1>Bitácora Digital de Obra</h1>
      <div class="meta">
        <div><strong>Proyecto:</strong> ${esc(informe.project.code)} - ${esc(informe.project.name)}</div>
        <div><strong>Fecha:</strong> ${esc(dateStr)}</div>
        <div><strong>Jornada:</strong> ${esc(informe.jornadaCatalogo?.nombre ?? 'Sin jornada')}</div>
        <div><strong>Contratista:</strong> ${esc(informe.contratista ?? 'N/A')}</div>
        <div><strong>Frente de obra:</strong> ${esc(informe.frenteObra ?? 'N/A')}</div>
      </div>
    </div>
    <div class="qr">
      <img src="${qrUrl}" alt="QR de validación" width="140" height="140" />
      <div>QR de validación</div>
    </div>
  </header>
  <h2>Clima</h2>
  <p>${esc(clima?.tipo ?? informe.tipoClima ?? 'No registrado')} · Temp: ${esc(clima?.temperatura ?? 'N/A')} · Humedad: ${esc(clima?.humedad ?? 'N/A')}</p>
  <h2>Timeline oficial</h2>
  <div class="timeline">
    ${eventos
      .map(
        (e) => `<div class="event">
          <div><strong>${esc(e.hora)} · ${esc(e.moduloOrigen)}</strong> <span class="muted">${esc(e.tipoEvento)} · ${esc(e.estado)}</span></div>
          <p>${esc(e.descripcion)}</p>
          <div class="muted">Usuario: ${esc(e.usuario)} · Rol: ${esc(e.rolUsuario)} · IP: ${esc(e.ip)} · GPS: ${esc(e.latitud)}, ${esc(e.longitud)}</div>
          ${e.observaciones ? `<p><strong>Observaciones:</strong> ${esc(e.observaciones)}</p>` : ''}
          ${
            e.evidencias.length
              ? `<div class="photos">${e.evidencias
                  .map((foto) => `<a href="${esc(foto.url)}"><img src="${esc(foto.url)}" alt="Evidencia" /></a>`)
                  .join('')}</div>`
              : ''
          }
        </div>`,
      )
      .join('')}
  </div>
  <h2>Hash de integridad</h2>
  <div class="hash">${esc(hash)}</div>
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
    console.error(error);
    return NextResponse.json({ error: 'Error al generar PDF oficial' }, { status: 500 });
  }
}
