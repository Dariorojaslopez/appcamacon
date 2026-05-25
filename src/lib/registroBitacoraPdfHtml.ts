/** HTML imprimible del registro de bitácora (vista previa / PDF). */

import type { RegistroBitacoraFirmaDoc } from '../shared/registroBitacoraFirmaDocs';
import { isImageContentType } from '../shared/registroBitacoraFirmaDocs';

export type RegistroBitacoraPdfSlot = {
  titulo: string;
  observaciones: string;
  fotoUrl: string;
  firmaUrl: string;
  firmaDocs: RegistroBitacoraFirmaDoc[];
};

export type RegistroBitacoraPdfClimaFranja = {
  franja: string;
  tiempoHtml: string;
};

export type RegistroBitacoraPdfPersonalCargo = {
  cargo: string;
  total: number;
};

export type RegistroBitacoraPdfEquipoMaterial = {
  descripcion: string;
  estado: string;
};

export type RegistroBitacoraPdfObra = {
  obraNombre: string;
  obraCodigo: string;
  obraLogoUrl: string;
  rangoObraTexto: string;
  plazoContractualDias: number | null;
  contratoTexto: string;
};

export type RegistroBitacoraPdfDia = {
  /** Consecutivo de bitácora del día (si existe). */
  consecutivo: number;
  /** Número del informe diario (ej. IDO-2026-006). */
  informeNo: string;
  fechaTexto: string;
  diaSemana: string;
  tiempoTranscurridoDias: number | null;
  climaFilas: RegistroBitacoraPdfClimaFranja[];
  personalPorCargo: RegistroBitacoraPdfPersonalCargo[];
  equiposMateriales: RegistroBitacoraPdfEquipoMaterial[];
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
  /** Nonce CSP (header x-nonce) para que el navegador aplique los estilos de la tabla. */
  styleNonce?: string;
};

const TABLE_ATTRS = 'class="informe-grid" border="1" cellpadding="0" cellspacing="0" width="100%"';
const NESTED_TABLE_ATTRS = 'class="informe-nested" border="1" cellpadding="0" cellspacing="0" width="100%"';
const SECCION_TABLE_ATTRS = 'class="seccion-grid" border="1" cellpadding="0" cellspacing="0" width="100%"';
const CLIMA_TABLE_ATTRS =
  'class="informe-grid informe-grid-clima" border="1" cellpadding="0" cellspacing="0" width="100%"';
const PERSONAL_TABLE_ATTRS =
  'class="informe-grid informe-grid-personal" border="1" cellpadding="0" cellspacing="0" width="100%"';
const EQUIPOS_TABLE_ATTRS =
  'class="informe-grid informe-grid-equipos" border="1" cellpadding="0" cellspacing="0" width="100%"';

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
    font-family: Arial, Helvetica, "Segoe UI", sans-serif;
    color: #000;
    margin: 0;
    padding: 0;
    font-size: 10.5pt;
    line-height: 1.3;
    background: #d1d5db;
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
  }
  .print-toolbar p { margin: 0; font-size: 12px; max-width: 72%; }
  .print-toolbar button {
    background: #edd501;
    color: #111485;
    border: none;
    border-radius: 6px;
    padding: 9px 16px;
    font-weight: 700;
    cursor: pointer;
  }
  .sheet {
    max-width: 210mm;
    margin: 14px auto 28px;
    padding: 8mm 10mm 10mm;
    background: #fff;
    box-shadow: 0 2px 12px rgba(0,0,0,.12);
  }
  .sheet-cover {
    text-align: center;
    padding: 12mm 8mm;
  }
  .sheet-cover h2 {
    margin: 12px 0 6px;
    font-size: 14pt;
    text-transform: uppercase;
    color: #111485;
  }
  table.informe-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1px solid #000;
  }
  table.informe-grid-clima {
    margin-top: -1px;
    border-top: none;
  }
  table.informe-grid th,
  table.informe-grid td {
    border: 1px solid #000;
    padding: 5px 7px;
    vertical-align: middle;
  }
  table.informe-grid th.hdr {
    background: #e8e8e8;
    font-weight: 700;
    text-align: left;
    width: 22%;
    white-space: nowrap;
  }
  table.informe-grid td.val {
    font-weight: 600;
    background: #fff;
  }
  table.informe-grid td.cell-logos {
    background: #fff;
    vertical-align: middle;
    text-align: center;
    width: 36%;
    min-height: 72px;
    padding: 8px;
  }
  .logos-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    min-height: 58px;
  }
  .logo-obra { max-height: 64px; max-width: 220px; object-fit: contain; display: block; }
  .logo-fallback {
    font-size: 9pt;
    color: #6b7280;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  td.title-main {
    text-align: center;
    font-weight: 800;
    font-size: 11.5pt;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    background: #f5f5f5;
    padding: 9px 8px;
  }
  td.cell-proyecto {
    vertical-align: top;
    background: #fff;
  }
  th.hdr-proyecto {
    background: #e8e8e8;
    font-weight: 700;
    text-align: left;
    vertical-align: top;
    width: 12%;
  }
  .proyecto-nombre {
    font-weight: 800;
    font-size: 10.5pt;
    text-transform: uppercase;
    margin: 0 0 3px;
    line-height: 1.25;
  }
  .proyecto-rango {
    margin: 0;
    font-size: 9pt;
    font-weight: 400;
    color: #333;
  }
  td.cell-meta-side {
    padding: 0 !important;
    vertical-align: top;
    width: 28%;
  }
  table.informe-nested {
    width: 100%;
    height: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  table.informe-nested th,
  table.informe-nested td {
    border: 1px solid #000;
    padding: 4px 6px;
    font-size: 10pt;
  }
  table.informe-nested th {
    background: #e8e8e8;
    font-weight: 700;
    width: 48%;
    text-align: left;
  }
  table.informe-nested td {
    font-weight: 600;
    background: #fff;
  }
  th.clima-hdr {
    background: #e8e8e8;
    font-weight: 700;
    text-align: center;
  }
  th.clima-franja {
    background: #e8e8e8;
    font-weight: 700;
    text-align: left;
    width: 22%;
  }
  td.clima-data { text-align: center; background: #fff; }
  .clima-tiempo { display: inline-flex; align-items: center; gap: 4px; justify-content: center; }
  table.informe-grid-personal {
    margin-top: 10px;
    page-break-inside: avoid;
  }
  th.personal-hdr {
    background: #e8e8e8;
    font-weight: 700;
    text-align: center;
  }
  th.personal-cargo {
    background: #e8e8e8;
    font-weight: 700;
    text-align: left;
    width: 72%;
  }
  td.personal-total {
    text-align: center;
    font-weight: 600;
    background: #fff;
  }
  table.informe-grid-equipos {
    margin-top: 10px;
    page-break-inside: avoid;
  }
  th.equipos-hdr {
    background: #e8e8e8;
    font-weight: 700;
    text-align: center;
  }
  th.equipos-col-hdr {
    background: #e8e8e8;
    font-weight: 700;
    text-align: left;
  }
  td.equipos-data {
    background: #fff;
    text-align: left;
  }
  td.equipos-estado {
    background: #fff;
    text-align: center;
  }
  table.seccion-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1px solid #000 !important;
    margin-top: 10px;
    page-break-inside: avoid;
  }
  table.seccion-grid th,
  table.seccion-grid td {
    border: 1px solid #000 !important;
    padding: 6px 8px;
    vertical-align: top;
  }
  table.informe-grid,
  table.informe-nested,
  table.seccion-grid {
    border-collapse: collapse !important;
  }
  th.seccion-titulo {
    text-align: center;
    text-transform: uppercase;
    font-weight: 800;
    font-size: 11pt;
    background: #dde3f0;
    color: #111485;
    padding: 7px;
  }
  th.seccion-label {
    background: #e8e8e8;
    font-weight: 700;
    width: 18%;
    text-align: left;
  }
  td.obs-cell { white-space: pre-wrap; min-height: 44px; background: #fff; }
  .evidencia-img {
    display: block;
    max-width: 100%;
    max-height: 180px;
    width: auto;
    height: auto;
    object-fit: contain;
    margin: 0 auto;
  }
  .firma-img {
    display: block;
    max-height: 80px;
    max-width: 240px;
    object-fit: contain;
  }
  td.cell-foto {
    text-align: center;
    background: #fff;
  }
  td.cell-firma {
    background: #fff;
  }
  .muted { color: #9ca3af; font-style: italic; }
  .footer-note {
    margin-top: 12px;
    font-size: 8.5pt;
    color: #6b7280;
    text-align: right;
  }
  .day-break { page-break-before: always; }
  @media print {
    body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-toolbar { display: none !important; }
    .sheet {
      margin: 0 auto;
      max-width: none;
      box-shadow: none;
      padding: 0;
      page-break-after: always;
    }
    .sheet:last-child { page-break-after: auto; }
    .sheet-cover { page-break-after: always; }
    @page { size: A4 portrait; margin: 10mm; }
  }
`;

function logosContentHtml(obra: RegistroBitacoraPdfObra): string {
  if (obra.obraLogoUrl) {
    return `<img class="logo-obra" src="${esc(obra.obraLogoUrl)}" alt="${esc(obra.obraNombre)}" />`;
  }
  return `<span class="logo-fallback">${esc(obra.obraCodigo)}</span>`;
}

function logosHtml(obra: RegistroBitacoraPdfObra): string {
  return `<div class="logos-inner">${logosContentHtml(obra)}</div>`;
}

function buildHeaderHtml(obra: RegistroBitacoraPdfObra, dia: RegistroBitacoraPdfDia): string {
  const plazoTxt = obra.plazoContractualDias != null ? `${obra.plazoContractualDias} días` : '—';
  const transcurridoTxt =
    dia.tiempoTranscurridoDias != null ? `${dia.tiempoTranscurridoDias} días` : '—';

  return `
    <table ${TABLE_ATTRS}>
      <colgroup>
        <col width="36%" />
        <col width="18%" />
        <col width="18%" />
        <col width="28%" />
      </colgroup>
      <tr>
        <td rowspan="4" class="cell-logos">${logosHtml(obra)}</td>
        <th class="hdr">Informe No.</th>
        <td class="val" colspan="2">${esc(dia.informeNo)}</td>
      </tr>
      <tr>
        <th class="hdr">Fecha</th>
        <td class="val" colspan="2">${esc(dia.fechaTexto)}</td>
      </tr>
      <tr>
        <th class="hdr">Día de la semana</th>
        <td class="val" colspan="2">${esc(dia.diaSemana)}</td>
      </tr>
      <tr>
        <th class="hdr">Bitácora No.</th>
        <td class="val" colspan="2">${dia.consecutivo > 0 ? esc(dia.consecutivo) : '—'}</td>
      </tr>
      <tr>
        <td colspan="4" class="title-main">Informe diario de trabajo</td>
      </tr>
      <tr>
        <th class="hdr-proyecto">Proyecto</th>
        <td colspan="2" class="cell-proyecto">
          <p class="proyecto-nombre">${esc(obra.obraCodigo)} — ${esc(obra.obraNombre)}</p>
          <p class="proyecto-rango">${esc(obra.rangoObraTexto)}</p>
        </td>
        <td class="cell-meta-side">
          <table ${NESTED_TABLE_ATTRS}>
            <tr>
              <th>Contrato</th>
              <td>${esc(obra.contratoTexto)}</td>
            </tr>
            <tr>
              <th>Plazo contractual</th>
              <td>${esc(plazoTxt)}</td>
            </tr>
            <tr>
              <th>Tiempo transcurrido</th>
              <td>${esc(transcurridoTxt)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildClimaHtml(dia: RegistroBitacoraPdfDia): string {
  const climaBody = dia.climaFilas
    .map(
      (f) => `<tr>
        <th class="clima-franja">${esc(f.franja)}</th>
        <td class="clima-data">${f.tiempoHtml}</td>
      </tr>`,
    )
    .join('');

  return `
    <table ${CLIMA_TABLE_ATTRS}>
      <colgroup>
        <col width="28%" />
        <col width="72%" />
      </colgroup>
      <tr>
        <th class="clima-hdr" colspan="2">Condición climática por franja</th>
      </tr>
      <tr>
        <th class="clima-hdr">Franja del día</th>
        <th class="clima-hdr">Condición climática</th>
      </tr>
      ${climaBody}
    </table>`;
}

function buildPersonalHtml(dia: RegistroBitacoraPdfDia): string {
  const filas = dia.personalPorCargo ?? [];
  const body =
    filas.length > 0
      ? filas
          .map(
            (f) => `<tr>
        <th class="personal-cargo">${esc(f.cargo)}</th>
        <td class="personal-total">${esc(f.total)}</td>
      </tr>`,
          )
          .join('')
      : `<tr>
        <td colspan="2" class="muted" style="text-align:center;padding:8px;">Sin personal registrado en este informe</td>
      </tr>`;

  return `
    <table ${PERSONAL_TABLE_ATTRS}>
      <colgroup>
        <col width="72%" />
        <col width="28%" />
      </colgroup>
      <tr>
        <th class="personal-hdr" colspan="2">Personal</th>
      </tr>
      <tr>
        <th class="personal-cargo">Cargo</th>
        <th class="personal-hdr">Total</th>
      </tr>
      ${body}
    </table>`;
}

function buildEquiposMaterialesHtml(dia: RegistroBitacoraPdfDia): string {
  const filas = dia.equiposMateriales ?? [];
  const body =
    filas.length > 0
      ? filas
          .map(
            (e) => `<tr>
        <td class="equipos-data">${esc(e.descripcion)}</td>
        <td class="equipos-estado">${esc(e.estado)}</td>
      </tr>`,
          )
          .join('')
      : `<tr>
        <td colspan="2" class="muted" style="text-align:center;padding:8px;">Sin equipos registrados en este informe</td>
      </tr>`;

  return `
    <table ${EQUIPOS_TABLE_ATTRS}>
      <colgroup>
        <col width="68%" />
        <col width="32%" />
      </colgroup>
      <tr>
        <th class="equipos-hdr" colspan="2">Equipos y materiales</th>
      </tr>
      <tr>
        <th class="equipos-col-hdr">Descripción</th>
        <th class="equipos-col-hdr" style="text-align:center;">Estado</th>
      </tr>
      ${body}
    </table>`;
}

function buildSeccionesHtml(secciones: RegistroBitacoraPdfSlot[]): string {
  return secciones
    .map((s) => {
      const obs = esc(s.observaciones || '—');
      const foto = s.fotoUrl
        ? `<img class="evidencia-img" src="${esc(s.fotoUrl)}" alt="" />`
        : '<span class="muted">Sin foto</span>';
      const firmaParts: string[] = [];
      if (s.firmaUrl) {
        firmaParts.push(`<img class="firma-img" src="${esc(s.firmaUrl)}" alt="Firma dibujada" />`);
      }
      for (const doc of s.firmaDocs ?? []) {
        const abs = doc.url.startsWith('http') ? doc.url : doc.url;
        if (isImageContentType(doc.contentType) || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(doc.url)) {
          firmaParts.push(
            `<div class="firma-doc-block"><div class="firma-doc-name">${esc(doc.name)}</div><img class="firma-img" src="${esc(abs)}" alt="" /></div>`,
          );
        } else {
          firmaParts.push(
            `<div class="firma-doc-block"><a class="firma-doc-link" href="${esc(abs)}" target="_blank" rel="noopener">${esc(doc.name)}</a></div>`,
          );
        }
      }
      const firma =
        firmaParts.length > 0
          ? `<div class="firma-docs-wrap">${firmaParts.join('')}</div>`
          : '<span class="muted">Sin firma ni documentos</span>';
      return `<table ${SECCION_TABLE_ATTRS}>
        <tr><th class="seccion-titulo" colspan="2">${esc(s.titulo)}</th></tr>
        <tr>
          <th class="seccion-label">Observaciones</th>
          <td class="obs-cell">${obs}</td>
        </tr>
        <tr>
          <th class="seccion-label">Foto</th>
          <td class="cell-foto">${foto}</td>
        </tr>
        <tr>
          <th class="seccion-label">Firma</th>
          <td class="cell-firma">${firma}</td>
        </tr>
      </table>`;
    })
    .join('');
}

function buildDaySheetHtml(obra: RegistroBitacoraPdfObra, dia: RegistroBitacoraPdfDia, extraClass = ''): string {
  return `<section class="sheet ${extraClass}">
    ${buildHeaderHtml(obra, dia)}
    ${buildClimaHtml(dia)}
    ${buildPersonalHtml(dia)}
    ${buildEquiposMaterialesHtml(dia)}
    ${buildSeccionesHtml(dia.secciones)}
    <p class="footer-note">
      Registrado por: ${esc(dia.registradoPor)} · ${esc(dia.actualizadoTexto)}
    </p>
  </section>`;
}

export function buildRegistroBitacoraPdfDocumentHtml(doc: RegistroBitacoraPdfDocument): string {
  const { obra, periodoTexto, toolbarDetalle, dias, styleNonce } = doc;
  const multi = dias.length > 1;
  const styleNonceAttr = styleNonce ? ` nonce="${esc(styleNonce)}"` : '';
  const scriptNonceAttr = styleNonce ? ` nonce="${esc(styleNonce)}"` : '';

  const coverHtml = multi
    ? `<section class="sheet sheet-cover">
        <div class="logos-inner" style="margin-bottom:14px;">${logosContentHtml(obra)}</div>
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
  <style${styleNonceAttr}>${PDF_STYLES}</style>
</head>
<body>
  <div class="print-toolbar">
    <p>Vista previa · ${esc(periodoTexto)} · ${esc(toolbarDetalle)}</p>
    <button type="button" id="btn-print-pdf">Imprimir / guardar PDF</button>
  </div>
  ${coverHtml}
  ${sheetsHtml}
  <script${scriptNonceAttr}>
    (function () {
      function doPrint() {
        try { window.print(); } catch (e) { console.error(e); }
      }
      var btn = document.getElementById('btn-print-pdf');
      if (btn) btn.addEventListener('click', doPrint);
      document.addEventListener('keydown', function (ev) {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === 'p') {
          ev.preventDefault();
          doPrint();
        }
      });
    })();
  </script>
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
    rangoObraTexto: rest.rangoObraTexto,
    plazoContractualDias: rest.plazoContractualDias,
    contratoTexto: rest.contratoTexto,
  };
  const dia: RegistroBitacoraPdfDia = {
    consecutivo: rest.consecutivo,
    informeNo: (rest as RegistroBitacoraPdfDia).informeNo ?? String(rest.consecutivo),
    fechaTexto: rest.fechaTexto,
    diaSemana: rest.diaSemana,
    tiempoTranscurridoDias: rest.tiempoTranscurridoDias,
    climaFilas: rest.climaFilas,
    personalPorCargo: rest.personalPorCargo ?? [],
    equiposMateriales: rest.equiposMateriales ?? [],
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
