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

export type RegistroBitacoraPdfData = {
  origin: string;
  obraNombre: string;
  obraCodigo: string;
  obraLogoUrl: string;
  camaconLogoUrl: string;
  consecutivo: number;
  fechaTexto: string;
  diaSemana: string;
  rangoObraTexto: string;
  plazoContractualDias: number | null;
  tiempoTranscurridoDias: number | null;
  contratoTexto: string;
  climaFilas: RegistroBitacoraPdfClimaFranja[];
  secciones: RegistroBitacoraPdfSlot[];
  registradoPor: string;
  actualizadoTexto: string;
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

/** Etiqueta legible y condición de obra a partir del código del catálogo. */
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

export function buildRegistroBitacoraPdfHtml(data: RegistroBitacoraPdfData): string {
  const climaRows = data.climaFilas
    .map(
      (f) => `<tr>
        <td class="cell-label">${esc(f.franja)}</td>
        <td>${f.tiempoHtml}</td>
        <td>${esc(f.condicion)}</td>
      </tr>`,
    )
    .join('');

  const seccionesHtml = data.secciones
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

  const logoObra = data.obraLogoUrl
    ? `<img class="logo-obra" src="${esc(data.obraLogoUrl)}" alt="Logo obra" />`
    : '';
  const logoCamacon = data.camaconLogoUrl
    ? `<img class="logo-camacon" src="${esc(data.camaconLogoUrl)}" alt="Camacón" />`
    : '';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Informe diario de trabajo — ${esc(data.obraCodigo)}</title>
  <style>
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
    .print-toolbar p { margin: 0; font-size: 12px; opacity: .9; }
    .print-toolbar button {
      background: #edd501;
      color: #111485;
      border: none;
      border-radius: 8px;
      padding: 10px 18px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
    }
    .print-toolbar button:hover { filter: brightness(1.05); }
    .sheet {
      max-width: 210mm;
      margin: 16px auto 32px;
      padding: 10mm 12mm 14mm;
      background: #fff;
      box-shadow: 0 4px 24px rgba(0,0,0,.12);
    }
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
    @media print {
      body { background: #fff; }
      .print-toolbar { display: none !important; }
      .sheet {
        margin: 0;
        max-width: none;
        box-shadow: none;
        padding: 0;
      }
      @page { size: A4 portrait; margin: 12mm; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <p>Vista previa del informe diario — use el botón para imprimir o guardar como PDF.</p>
    <button type="button" onclick="window.print()">Imprimir / guardar PDF</button>
  </div>

  <main class="sheet">
    <table class="grid">
      <tr class="header-logos">
        <td colspan="2" style="width:58%">
          <div class="logos-wrap">
            ${logoObra}
            ${logoCamacon}
          </div>
        </td>
        <td style="width:42%; padding:0; vertical-align:top;">
          <table class="meta-table">
            <tr><th>Número</th><td>${esc(data.consecutivo)}</td></tr>
            <tr><th>Fecha</th><td>${esc(data.fechaTexto)}</td></tr>
            <tr><th>Día de la semana</th><td>${esc(data.diaSemana)}</td></tr>
          </table>
        </td>
      </tr>
      <tr class="title-row"><td colspan="3">Informe diario de trabajo</td></tr>
      <tr>
        <td colspan="2" style="vertical-align:top;">
          <p class="proyecto-nombre">${esc(data.obraCodigo)} — ${esc(data.obraNombre)}</p>
          <p class="proyecto-rango">${esc(data.rangoObraTexto)}</p>
        </td>
        <td style="padding:0; vertical-align:top;">
          <table class="meta-table">
            <tr><th>Contrato</th><td>${esc(data.contratoTexto)}</td></tr>
            <tr><th>Plazo contractual</th><td>${data.plazoContractualDias != null ? esc(`${data.plazoContractualDias} días`) : '—'}</td></tr>
            <tr><th>Tiempo transcurrido</th><td>${data.tiempoTranscurridoDias != null ? esc(`${data.tiempoTranscurridoDias} días`) : '—'}</td></tr>
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

    ${seccionesHtml}

    <p class="footer-note">
      Registrado por: ${esc(data.registradoPor)} · ${esc(data.actualizadoTexto)}
    </p>
  </main>
</body>
</html>`;
}
