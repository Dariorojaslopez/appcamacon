import ExcelJS from 'exceljs';

const RUBRO_DEFAULT = '1. OBRA';
const CALIFICACION_DEFAULT = 1;
const AIU_FACTOR = 1.35;
const AMORTIZACION_RATE = 0.2;
const RETENCION_6_RATE = 0.06;
const RETE_ICA_RATE = 0.0076;
const RETENCION_RENTA_RATE = 0.0254;
const CONTRIBUCION_RATE = 0.05;
const ESTAMPILLA_UD_RATE = 0.011;
const ESTAMPILLA_CULTURA_RATE = 0.005;
const ESTAMPILLA_MAYORES_RATE = 0.02;
const ESTAMPILLA_PEDAGOGICA_RATE = 0.005;

export type TabulacionItemRow = {
  codigo: string;
  descripcion: string;
  unidad: string | null;
  cantidad: number | null;
  precioUnitario: number | null;
};

export type TabulacionActividadRow = {
  pk: string;
  abscisado: string | null;
  itemContractual: string;
  descripcion: string;
  unidadMedida: string | null;
  observacionTexto: string | null;
  cantidadTotal: number | null;
};

function precioMap(items: TabulacionItemRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const code = String(it.codigo ?? '').trim();
    const p = it.precioUnitario != null ? Number(it.precioUnitario) : 0;
    m.set(code, Number.isFinite(p) ? p : 0);
  }
  return m;
}

function actividadCantidadMap(actividades: TabulacionActividadRow[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const a of actividades) {
    const code = String(a.itemContractual ?? '').trim();
    if (!code) continue;
    const qty = a.cantidadTotal != null && Number.isFinite(Number(a.cantidadTotal)) ? Number(a.cantidadTotal) : 0;
    m.set(code, (m.get(code) ?? 0) + qty);
  }
  return m;
}

function itemMetaMap(items: TabulacionItemRow[]): Map<string, { descripcion: string; precio: number }> {
  const m = new Map<string, { descripcion: string; precio: number }>();
  for (const it of items) {
    const code = String(it.codigo ?? '').trim();
    if (!code) continue;
    m.set(code, {
      descripcion: String(it.descripcion ?? '').trim(),
      precio: it.precioUnitario != null && Number.isFinite(Number(it.precioUnitario)) ? Number(it.precioUnitario) : 0,
    });
  }
  return m;
}

function sortCodigoNumFirst(a: TabulacionItemRow, b: TabulacionItemRow): number {
  const na = /^\d+$/.test(String(a.codigo).trim()) ? Number(a.codigo) : NaN;
  const nb = /^\d+$/.test(String(b.codigo).trim()) ? Number(b.codigo) : NaN;
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  if (!Number.isNaN(na)) return -1;
  if (!Number.isNaN(nb)) return 1;
  return String(a.codigo).localeCompare(String(b.codigo));
}

function columnLetter(col: number): string {
  let n = col;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function applyBorders(ws: ExcelJS.Worksheet, fromRow: number, toRow: number, fromCol: number, toCol: number): void {
  for (let r = fromRow; r <= toRow; r++) {
    for (let c = fromCol; c <= toCol; c++) {
      ws.getCell(r, c).border = {
        top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
        right: { style: 'thin', color: { argb: 'FFBFBFBF' } },
      };
    }
  }
}

function autoFitColumns(ws: ExcelJS.Worksheet, colCount: number, min = 10, max = 42): void {
  for (let c = 1; c <= colCount; c++) {
    let longest = 0;
    ws.getColumn(c).eachCell({ includeEmpty: true }, (cell) => {
      const text = cell.value == null ? '' : String((cell as { text?: string }).text ?? cell.value);
      longest = Math.max(longest, text.length);
    });
    ws.getColumn(c).width = Math.max(min, Math.min(max, longest + 2));
  }
}

export async function buildFormatoTabulacionWorkbookBuffer(opts: {
  obraCode: string;
  obraNombre: string;
  fechaReporte: string;
  jornadaNombre: string;
  informeNo: string | null;
  items: TabulacionItemRow[];
  actividades: TabulacionActividadRow[];
  responsable?: string | null;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIGOCC';
  wb.created = new Date();

  const byPrecio = precioMap(opts.items);
  const byItemMeta = itemMetaMap(opts.items);
  const byActividadQty = actividadCantidadMap(opts.actividades);

  // RESUMEN (solo detalle de ítems en hoja 1)
  const wsR = wb.addWorksheet('RESUMEN');
  wsR.mergeCells('A1:G1');
  wsR.getCell('A1').value = 'INFORME DIARIO DE PRODUCCION';
  wsR.getCell('A1').font = { bold: true, size: 14 };
  wsR.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  wsR.getRow(1).height = 30;

  // Detalle de ítems en la primera hoja (solicitado por operación)
  const itemsHeaderRow = 3;
  wsR.getCell(`A${itemsHeaderRow}`).value = 'DETALLE DE ITEMS DE LA OBRA';
  wsR.getCell(`A${itemsHeaderRow}`).font = { bold: true, size: 12 };
  wsR.mergeCells(`A${itemsHeaderRow}:G${itemsHeaderRow}`);

  const itemColsRow = itemsHeaderRow + 1;
  const itemHeaders = ['OBRA', 'ITEM', 'DESCRIPCION DEL ITEM', 'UNIDAD', 'CANTIDAD', 'VALOR UNITARIO', 'TOTAL'];
  wsR.getRow(itemColsRow).values = itemHeaders;
  wsR.getRow(itemColsRow).font = { bold: true };
  wsR.getRow(itemColsRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EEF7' } };
  wsR.getRow(itemColsRow).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  const actividadItemCodes = new Set(
    opts.actividades
      .map((a) => String(a.itemContractual ?? '').trim())
      .filter((code) => code.length > 0),
  );
  const sortedItems = [...opts.items]
    .filter((it) => actividadItemCodes.has(String(it.codigo ?? '').trim()))
    .sort(sortCodigoNumFirst);
  let itemDataRow = itemColsRow + 1;
  for (const it of sortedItems) {
    const codStr = String(it.codigo ?? '').trim();
    const codCell = /^\d+$/.test(codStr) ? Number(codStr) : codStr;
    const qtyCatalogo = it.cantidad != null && Number.isFinite(Number(it.cantidad)) ? Number(it.cantidad) : null;
    const qtyActividad = byActividadQty.get(codStr);
    const qty = qtyCatalogo != null ? qtyCatalogo : qtyActividad != null ? qtyActividad : null;
    const vu = it.precioUnitario != null && Number.isFinite(Number(it.precioUnitario)) ? Number(it.precioUnitario) : null;
    const total = qty != null && vu != null ? qty * vu : null;
    const row = wsR.addRow([opts.obraNombre, codCell, it.descripcion, String(it.unidad ?? '').toUpperCase(), qty, vu, total]);
    row.getCell(5).numFmt = '#,##0.000';
    row.getCell(6).numFmt = '"$"#,##0.00';
    row.getCell(7).numFmt = '"$"#,##0.00';
    itemDataRow += 1;
  }
  if (sortedItems.length === 0) {
    wsR.addRow(['', '', 'No hay ítems relacionados en actividades para este informe.', '', '', '', '']);
    itemDataRow += 1;
  }
  const itemLastRow = Math.max(itemColsRow + 1, itemDataRow - 1);
  applyBorders(wsR, itemColsRow, itemLastRow, 1, 7);
  autoFitColumns(wsR, 7, 12, 52);

  // BASE
  const baseHeaders = [
    'FECHA',
    'INFORMACION',
    'TIPO DE PAVIMENTO',
    'SEMANA',
    'TRAMO',
    'CIV',
    'PK ID',
    'N° PMT',
    'ITEM CONTRACTUAL',
    'RUBRO',
    'DESCRIPCIÓN',
    'OBSERVACIONES',
    'CANTIDAD ACTA DE COBRO ENTIDAD',
    'COSTO TOTAL DIRECTO',
    'COSTO TOTAL CON AIU ENTIDAD',
    'CALIFICACION',
    'COSTO TOTAL CON AIU ENTIDAD INC CALIFICACION',
    'AMORTIZACION',
    'RETENCION DEL 6%',
    'TOTAL A PAGAR',
    'RETE ICA 0,76%',
    'RETENCION RENTA 2,54%',
    'CONTRIBUCION ESPECIAL 5%',
    'ESTAMPILLA UNIVERSIDAD DISTRITAL 1,1%',
    'ESTAMPILLA PRO CULTURA 0,5%',
    'ESTAMPILLA PRO PERSONAS MAYORES 2%',
    'ESTAMPILLA UNIVERSIDAD PEDAGOGICA NACIONAL 0,5%',
    'DESCUENTO IMPUESTOS & ESTAMPILLAS',
    'TOTAL INGRESO AL BANCO',
    'COSTO EJECUCION CON COBRO ENTIDAD',
    'UTILI/PERDIDA ACTA DE COBRO',
  ];

  const wsB = wb.addWorksheet('BASE', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsB.addRow(baseHeaders);
  wsB.getRow(1).font = { bold: true };
  wsB.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EEF7' } };
  wsB.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  wsB.getRow(1).height = 34;

  let dataRow = 2;
  for (const a of opts.actividades) {
    const code = String(a.itemContractual ?? '').trim();
    const qty = a.cantidadTotal != null && Number.isFinite(Number(a.cantidadTotal)) ? Number(a.cantidadTotal) : 0;
    const precio = byPrecio.get(code) ?? 0;
    const itemMeta = byItemMeta.get(code);
    const directCost = qty * precio;
    const tramo = a.abscisado ? String(a.abscisado) : '';
    const civ = a.pk ? String(a.pk) : '';
    const pmt = a.pk ? String(a.pk) : '';

    const row = wsB.addRow([
      opts.fechaReporte,
      opts.informeNo ?? '',
      '',
      '',
      tramo,
      civ,
      a.pk ?? '',
      pmt,
      code,
      RUBRO_DEFAULT,
      itemMeta?.descripcion || a.descripcion || '',
      a.observacionTexto ?? '',
      qty,
      directCost,
      directCost * AIU_FACTOR,
      CALIFICACION_DEFAULT,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      directCost,
      null,
    ]);

    row.getCell(17).value = { formula: `O${dataRow}*P${dataRow}` };
    row.getCell(18).value = { formula: `Q${dataRow}*${AMORTIZACION_RATE}` };
    row.getCell(19).value = { formula: `Q${dataRow}*${RETENCION_6_RATE}` };
    row.getCell(20).value = { formula: `Q${dataRow}-R${dataRow}-S${dataRow}` };
    row.getCell(21).value = { formula: `T${dataRow}*${RETE_ICA_RATE}` };
    row.getCell(22).value = { formula: `T${dataRow}*${RETENCION_RENTA_RATE}` };
    row.getCell(23).value = { formula: `T${dataRow}*${CONTRIBUCION_RATE}` };
    row.getCell(24).value = { formula: `T${dataRow}*${ESTAMPILLA_UD_RATE}` };
    row.getCell(25).value = { formula: `T${dataRow}*${ESTAMPILLA_CULTURA_RATE}` };
    row.getCell(26).value = { formula: `T${dataRow}*${ESTAMPILLA_MAYORES_RATE}` };
    row.getCell(27).value = { formula: `T${dataRow}*${ESTAMPILLA_PEDAGOGICA_RATE}` };
    row.getCell(28).value = { formula: `SUM(U${dataRow}:AA${dataRow})` };
    row.getCell(29).value = { formula: `T${dataRow}-AB${dataRow}` };
    row.getCell(31).value = { formula: `AC${dataRow}-AD${dataRow}` };

    dataRow += 1;
  }

  const baseLastRow = Math.max(2, wsB.rowCount);
  const currencyCols = [14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];
  for (let r = 2; r <= baseLastRow; r++) {
    wsB.getCell(r, 13).numFmt = '#,##0.000';
    wsB.getCell(r, 16).numFmt = '0.00';
    for (const c of currencyCols) wsB.getCell(r, c).numFmt = '"$"#,##0.00';
  }
  applyBorders(wsB, 1, baseLastRow, 1, baseHeaders.length);
  autoFitColumns(wsB, baseHeaders.length);

  // PRODUCCION (agrupada por rubro + item contractual)
  type ProdAgg = { rubro: string; item: string; qty: number; direct: number; aiu: number };
  const prodMap = new Map<string, ProdAgg>();
  for (let r = 2; r <= baseLastRow; r++) {
    const rubro = String(wsB.getCell(r, 10).value ?? '').trim();
    const item = String(wsB.getCell(r, 9).value ?? '').trim();
    if (!item) continue;
    const qty = Number(wsB.getCell(r, 13).value ?? 0) || 0;
    const direct = Number(wsB.getCell(r, 14).value ?? 0) || 0;
    const aiu = Number(wsB.getCell(r, 15).value ?? 0) || 0;
    const key = `${rubro}||${item}`;
    const cur = prodMap.get(key) ?? { rubro, item, qty: 0, direct: 0, aiu: 0 };
    cur.qty += qty;
    cur.direct += direct;
    cur.aiu += aiu;
    prodMap.set(key, cur);
  }

  const wsP = wb.addWorksheet('PRODUCCION', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsP.addRow(['RUBRO', 'ITEM CONTRACTUAL', 'Suma de CANTIDAD TOTAL', 'Suma de COSTO TOTAL DIRECTO', 'Suma de COSTO TOTAL CON AIU']);
  wsP.getRow(1).font = { bold: true };
  wsP.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE9D9' } };
  wsP.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  const grouped = Array.from(prodMap.values()).sort((a, b) => {
    const cmpR = a.rubro.localeCompare(b.rubro);
    if (cmpR !== 0) return cmpR;
    return a.item.localeCompare(b.item);
  });

  let currentRubro = '';
  let subtotalStart = 2;
  let pRow = 2;
  for (const g of grouped) {
    if (currentRubro && currentRubro !== g.rubro) {
      const subtotal = wsP.addRow([
        `SUBTOTAL ${currentRubro}`,
        '',
        { formula: `SUM(C${subtotalStart}:C${pRow - 1})` },
        { formula: `SUM(D${subtotalStart}:D${pRow - 1})` },
        { formula: `SUM(E${subtotalStart}:E${pRow - 1})` },
      ]);
      subtotal.font = { bold: true };
      subtotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } };
      pRow += 1;
      subtotalStart = pRow;
    }
    wsP.addRow([g.rubro, g.item, g.qty, g.direct, g.aiu]);
    currentRubro = g.rubro;
    pRow += 1;
  }
  if (currentRubro && pRow > subtotalStart) {
    const subtotal = wsP.addRow([
      `SUBTOTAL ${currentRubro}`,
      '',
      { formula: `SUM(C${subtotalStart}:C${pRow - 1})` },
      { formula: `SUM(D${subtotalStart}:D${pRow - 1})` },
      { formula: `SUM(E${subtotalStart}:E${pRow - 1})` },
    ]);
    subtotal.font = { bold: true };
    subtotal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } };
    pRow += 1;
  }

  const totalRow = wsP.addRow([
    'TOTAL GENERAL',
    '',
    { formula: `SUM(C2:C${pRow - 1})` },
    { formula: `SUM(D2:D${pRow - 1})` },
    { formula: `SUM(E2:E${pRow - 1})` },
  ]);
  totalRow.font = { bold: true, size: 11 };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } };

  for (let r = 2; r <= wsP.rowCount; r++) {
    wsP.getCell(r, 3).numFmt = '#,##0.000';
    wsP.getCell(r, 4).numFmt = '"$"#,##0.00';
    wsP.getCell(r, 5).numFmt = '"$"#,##0.00';
  }
  applyBorders(wsP, 1, wsP.rowCount, 1, 5);
  autoFitColumns(wsP, 5);

  const lastBaseCol = columnLetter(baseHeaders.length);
  wsB.autoFilter = `A1:${lastBaseCol}1`;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
