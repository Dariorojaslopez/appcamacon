/** HTML imprimible del registro de bitácora (vista previa / PDF). */

export type RegistroBitacoraPdfSlot = {
  titulo: string;
  observaciones: string;
  fotoUrl: string;
  firmaUrl: string;
};

export type RegistroBitacoraPdfClimaFranja = {
  franja: string;
  tiempoHtml: string;
  condicion: string;
};

export type RegistroBitacoraPdfObra = {
  obraNombre: string;
  obraCodigo: string;
  obraLogoUrl: string;
  camaconLogoUrl: string;
  rangoObraTexto: string;
  plazoContractualDias: number | null;
  contratoTexto: string;
};

export type RegistroBitacoraPdfDia = {
  consecutivo: number;
  fechaTexto: string;
  diaSemana: string;
  tiempoTranscurridoDias: number | null;
  climaFilas: RegistroBitacoraPdfClimaFranja[];
  secciones: RegistroBitacoraPdfSlot[];
  registradoPor: string;
  actualizadoTexto: string;
};

/** @deprecated Usar RegistroBitacoraPdfObra + RegistroBitacoraPdfDia */
export type RegistroBitacoraPdfData = RegistroBitacoraPdfObra &
  RegistroBitacoraPdfDia & { origin: string };

export type RegistroBitacoraPdfDocument = {
  obra: RegistroBitacoraPdfObra;
  periodoTexto: string;
  toolbarDetalle: string;
  dias: RegistroBitacoraPdfDia[];
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function climaIconFromLabel(label: string, codigo: string): string {
  const s = `${codigo} ${label}`.toLowerCase();
  if (/soleado|despejado|clear/.test(s)) return '☀';
  if (/nublado|cloud/.test(s)) return '☁';
  if (/lluvia|rain/.test(s)) return '🌧';
  if (/tormenta|storm/.test(s)) return '⛈';
  if (/viento|wind/.test(s)) return '💨';
  return '◌';
}

export function resolveClimaFranja(
  codigo: string | null | undefined,
  catalog: Map<string, string>,
): { tiempo: string; condicion: string; tiempoHtml: string } {
  const c = (codigo ?? '').trim();
  if (!c) {
    return { tiempo: '—', condicion: '—', tiempoHtml: '—' };
  }
  const nombre = catalog.get(c) ?? c;
  const icon = climaIconFromLabel(nombre, c);
  const condicion = /lluvia|tormenta|rain|storm/i.test(`${c} ${nombre}`)
    ? 'Impracticable'
    : 'Practicable';
  return {
    tiempo: nombre,
    condicion,
    tiempoHtml: `<span class="clima-tiempo">${icon} ${esc(nombre)}</span>`,
  };
}

const PDF_STYLES = `
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, Helvetica, sans-serif;
      color: #111;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.35;
      background: #e5e7eb;
    }
    .print-toolbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 16px;
      background: #111485;
      color: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,.15);
    }
    .print-toolbar p { margin: 0; font-size: 12px; opacity: .9; max-width: 70%; }
    .print-toolbar button {
      background: #edd501;
      color: #111485;
      border: none;
      border-radius: 8px;
      padding: 10px 18px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      white-space: nowrap;
    }
    .print-toolbar button:hover { filter: brightness(1.05); }
    .sheet {
      max-width: 210mm;
      margin: 16px auto 32px;
      padding: 10mm 12mm 14mm;
      background: #fff;
      box-shadow: 0 4px 24px rgba(0,0,0,.12);
    }
    .sheet-cover {
      text-align: center;
      padding-top: 8mm;
      padding-bottom: 8mm;
    }
    .sheet-cover h2 {
      margin: 0 0 8px;
      font-size: 16px;
      color: #111485;
      text-transform: uppercase;
    }
    .sheet-cover p { margin: 4px 0; color: #374151; }
    table.grid {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.grid th,
    table.grid td {
      border: 1px solid #222;
      padding: 6px 8px;
      vertical-align: middle;
    }
    table.grid th {
      background: #ececec;
      font-weight: 700;
      text-align: left;
    }
    .header-logos td { vertical-align: middle; height: 72px; }
    .logos-wrap {
      display: flex;
      align-items: center;
      gap: 16px;
      min-height: 64px;
    }
    .logo-obra { max-height: 56px; max-width: 180px; object-fit: contain; }
    .logo-camacon { max-height: 52px; max-width: 140px; object-fit: contain; }
    .meta-table { width: 100%; border-collapse: collapse; }
    .meta-table th, .meta-table td {
      border: 1px solid #222;
      padding: 5px 8px;
      font-size: 11px;
    }
    .meta-table th { background: #ececec; width: 42%; font-weight: 700; }
    .title-row td {
      text-align: center;
      font-weight: 800;
      font-size: 13px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: #f8f8f8;
      padding: 10px;
    }
    .proyecto-nombre {
      font-weight: 800;
      font-size: 12px;
      text-transform: uppercase;
      margin: 0 0 4px;
    }
    .proyecto-rango { margin: 0; color: #374151; font-size: 10px; }
    .cell-label { width: 22%; font-weight: 700; background: #ececec; }
    .clima-tiempo { display: inline-flex; align-items: center; gap: 6px; }
    .section-block { margin-top: 10px; page-break-inside: avoid; }
    .section-title {
      text-align: center;
      text-transform: uppercase;
      font-size: 12px;
      background: #e8ecf4 !important;
      color: #111485;
    }
    .obs-cell { white-space: pre-wrap; min-height: 48px; }
    .evidencia-img {
      max-width: 100%;
      max-height: 220px;
      object-fit: contain;
      border: 1px solid #d1d5db;
      border-radius: 4px;
    }
    .firma-img { max-height: 90px; max-width: 280px; object-fit: contain; }
    .muted { color: #6b7280; }
    .footer-note {
      margin-top: 14px;
      font-size: 9px;
      color: #6b7280;
      text-align: right;
    }
    .day-break { page-break-before: always; }
    @media print {
      body { background: #fff; }
      .print-toolbar { display: none !important; }
      .sheet {
        margin: 0 auto;
        max-width: none;
        box-shadow: none;
        padding: 0;
        page-break-after: always;
      }
      .sheet:last-child { page-break-after: auto; }
      .day-break { page-break-before: always; }
      @page { size: A4 portrait; margin: 12mm; }
    }
`;

function buildSeccionesHtml(secciones: RegistroBitacoraPdfSlot[]): string {
  return secciones
    .map((s) => {
      const obs = esc(s.observaciones || '—');
      const foto = s.fotoUrl
        ? `<img class="evidencia-img" src="${esc(s.fotoUrl)}" alt="Foto ${esc(s.titulo)}" />`
        : '<span class="muted">—</span>';
      const firma = s.firmaUrl
        ? `<img class="firma-img" src="${esc(s.firmaUrl)}" alt="Firma ${esc(s.titulo)}" />`
        : '<span class="muted">—</span>';
      return `<table class="grid section-block">
        <tr><th class="section-title" colspan="2">${esc(s.titulo)}</th></tr>
        <tr>
          <th class="cell-label">Observaciones</th>
          <td class="obs-cell">${obs}</td>
        </tr>
        <tr>
          <th class="cell-label">Foto</th>
          <td>${foto}</td>
        </tr>
        <tr>
          <th class="cell-label">Firma</th>
          <td>${firma}</td>
        </tr>
      </table>`;
    })
    .join('');
}

function logosHtml(obra: RegistroBitacoraPdfObra): string {
  const logoObra = obra.obraLogoUrl
    ? `<img class="logo-obra" src="${esc(obra.obraLogoUrl)}" alt="Logo obra" />`
    : '';
  const logoCamacon = obra.camaconLogoUrl
    ? `<img class="logo-camacon" src="${esc(obra.camaconLogoUrl)}" alt="Camacón" />`
    : '';
  return `${logoObra}${logoCamacon}`;
}

function buildDaySheetHtml(obra: RegistroBitacoraPdfObra, dia: RegistroBitacoraPdfDia, extraClass = ''): string {
  const climaRows = dia.climaFilas
    .map(
      (f) => `<tr>
        <td class="cell-label">${esc(f.franja)}</td>
        <td>${f.tiempoHtml}</td>
        <td>${esc(f.condicion)}</td>
      </tr>`,
    )
    .join('');

  return `<section class="sheet ${extraClass}">
    <table class="grid">
      <tr class="header-logos">
        <td colspan="2" style="width:58%">
          <div class="logos-wrap">${logosHtml(obra)}</div>
        </td>
        <td style="width:42%; padding:0; vertical-align:top;">
          <table class="meta-table">
            <tr><th>Número</th><td>${esc(dia.consecutivo)}</td></tr>
            <tr><th>Fecha</th><td>${esc(dia.fechaTexto)}</td></tr>
            <tr><th>Día de la semana</th><td>${esc(dia.diaSemana)}</td></tr>
          </table>
        </td>
      </tr>
      <tr class="title-row"><td colspan="3">Informe diario de trabajo</td></tr>
      <tr>
        <td colspan="2" style="vertical-align:top;">
          <p class="proyecto-nombre">${esc(obra.obraCodigo)} — ${esc(obra.obraNombre)}</p>
          <p class="proyecto-rango">${esc(obra.rangoObraTexto)}</p>
        </td>
        <td style="padding:0; vertical-align:top;">
          <table class="meta-table">
            <tr><th>Contrato</th><td>${esc(obra.contratoTexto)}</td></tr>
            <tr><th>Plazo contractual</th><td>${obra.plazoContractualDias != null ? esc(`${obra.plazoContractualDias} días`) : '—'}</td></tr>
            <tr><th>Tiempo transcurrido</th><td>${dia.tiempoTranscurridoDias != null ? esc(`${dia.tiempoTranscurridoDias} días`) : '—'}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <table class="grid" style="margin-top:10px;">
      <tr>
        <th class="cell-label">Condición climática</th>
        <th style="width:38%">Tiempo</th>
        <th style="width:28%">Condición</th>
      </tr>
      ${climaRows}
    </table>

    ${buildSeccionesHtml(dia.secciones)}

    <p class="footer-note">
      Registrado por: ${esc(dia.registradoPor)} · ${esc(dia.actualizadoTexto)}
    </p>
  </section>`;
}

export function buildRegistroBitacoraPdfDocumentHtml(doc: RegistroBitacoraPdfDocument): string {
  const { obra, periodoTexto, toolbarDetalle, dias } = doc;
  const multi = dias.length > 1;

  const coverHtml = multi
    ? `<section class="sheet sheet-cover">
        <div class="logos-wrap" style="justify-content:center;margin-bottom:16px;">${logosHtml(obra)}</div>
        <h2>Registro de bitácora</h2>
        <p><strong>${esc(obra.obraCodigo)}</strong> — ${esc(obra.obraNombre)}</p>
        <p>Período: <strong>${esc(periodoTexto)}</strong></p>
        <p>${esc(toolbarDetalle)}</p>
      </section>`
    : '';

  const sheetsHtml = dias
    .map((dia, i) => buildDaySheetHtml(obra, dia, multi && i > 0 ? 'day-break' : ''))
    .join('\n');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bitácora — ${esc(obra.obraCodigo)} — ${esc(periodoTexto)}</title>
  <style>${PDF_STYLES}</style>
</head>
<body>
  <div class="print-toolbar">
    <p>Vista previa · ${esc(periodoTexto)} · ${esc(toolbarDetalle)}</p>
    <button type="button" onclick="window.print()">Imprimir / guardar PDF</button>
  </div>
  ${coverHtml}
  ${sheetsHtml}
</body>
</html>`;
}

/** Un solo día (compatibilidad). */
export function buildRegistroBitacoraPdfHtml(data: RegistroBitacoraPdfData): string {
  const { origin: _o, ...rest } = data;
  const obra: RegistroBitacoraPdfObra = {
    obraNombre: rest.obraNombre,
    obraCodigo: rest.obraCodigo,
    obraLogoUrl: rest.obraLogoUrl,
    camaconLogoUrl: rest.camaconLogoUrl,
    rangoObraTexto: rest.rangoObraTexto,
    plazoContractualDias: rest.plazoContractualDias,
    contratoTexto: rest.contratoTexto,
  };
  const dia: RegistroBitacoraPdfDia = {
    consecutivo: rest.consecutivo,
    fechaTexto: rest.fechaTexto,
    diaSemana: rest.diaSemana,
    tiempoTranscurridoDias: rest.tiempoTranscurridoDias,
    climaFilas: rest.climaFilas,
    secciones: rest.secciones,
    registradoPor: rest.registradoPor,
    actualizadoTexto: rest.actualizadoTexto,
  };
  return buildRegistroBitacoraPdfDocumentHtml({
    obra,
    periodoTexto: dia.fechaTexto,
    toolbarDetalle: '1 registro',
    dias: [dia],
  });
}
