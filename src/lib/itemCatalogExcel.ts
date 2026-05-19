import ExcelJS from 'exceljs';
import { ITEM_CATALOG_UNIT_VALUES, normalizeItemCatalogUnit } from './itemCatalogUnits';

export const ITEM_CATALOG_EXCEL_HEADERS = [
  'codigo_item',
  'descripcion',
  'unidad',
  'precio_unitario',
  'cantidad',
] as const;

const HEADER_LABELS: Record<(typeof ITEM_CATALOG_EXCEL_HEADERS)[number], string> = {
  codigo_item: 'Código ítem',
  descripcion: 'Descripción',
  unidad: 'Unidad',
  precio_unitario: 'Precio unitario',
  cantidad: 'Cantidad',
};

export type ItemCatalogExcelRow = {
  rowNumber: number;
  codigo: string;
  descripcion: string;
  unidad: string;
  precioUnitario: number | null;
  cantidad: number | null;
};

function parseNumberCell(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw)
    .trim()
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function cellText(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'object' && raw !== null && 'text' in raw) {
    return String((raw as { text?: string }).text ?? '').trim();
  }
  return String(raw).trim();
}

function normalizeHeaderKey(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const HEADER_ALIASES: Record<string, (typeof ITEM_CATALOG_EXCEL_HEADERS)[number]> = {
  codigo_item: 'codigo_item',
  codigo: 'codigo_item',
  codigo_del_item: 'codigo_item',
  descripcion: 'descripcion',
  unidad: 'unidad',
  precio_unitario: 'precio_unitario',
  precio: 'precio_unitario',
  cantidad: 'cantidad',
};

function findHeaderMap(row: ExcelJS.Row): Map<(typeof ITEM_CATALOG_EXCEL_HEADERS)[number], number> | null {
  const map = new Map<(typeof ITEM_CATALOG_EXCEL_HEADERS)[number], number>();
  row.eachCell({ includeEmpty: true }, (cell, col) => {
    const key = normalizeHeaderKey(cellText(cell.value));
    const field = HEADER_ALIASES[key];
    if (field) map.set(field, col);
  });
  const required: (typeof ITEM_CATALOG_EXCEL_HEADERS)[number][] = [
    'codigo_item',
    'descripcion',
    'unidad',
  ];
  if (!required.every((f) => map.has(f))) return null;
  return map;
}

/** Plantilla .xlsx con una sola hoja (Items). */
export async function buildItemCatalogTemplateBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Informe Diario Camacon';
  wb.created = new Date();

  const ws = wb.addWorksheet('Items', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = ITEM_CATALOG_EXCEL_HEADERS.map((key) => ({
    key,
    width: key === 'descripcion' ? 42 : 18,
  }));

  const headerRow = ws.addRow(ITEM_CATALOG_EXCEL_HEADERS.map((k) => HEADER_LABELS[k]));
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEDD501' },
  };

  ws.addRow({
    codigo_item: '1.01.001',
    descripcion: 'Ejemplo: excavación manual',
    unidad: 'm3',
    precio_unitario: 15000,
    cantidad: 10,
  });

  for (let i = 0; i < 20; i++) {
    ws.addRow({});
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export type ParseItemCatalogExcelResult = {
  rows: ItemCatalogExcelRow[];
  errors: Array<{ fila: number; mensaje: string }>;
};

export async function parseItemCatalogExcelBuffer(buffer: Buffer): Promise<ParseItemCatalogExcelResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const ws =
    wb.getWorksheet('Items') ??
    wb.worksheets.find((s) => /items/i.test(s.name)) ??
    wb.worksheets[0];

  if (!ws) {
    return { rows: [], errors: [{ fila: 0, mensaje: 'El archivo no tiene hojas.' }] };
  }

  let headerMap: Map<(typeof ITEM_CATALOG_EXCEL_HEADERS)[number], number> | null = null;
  let headerRowNum = 0;
  for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const map = findHeaderMap(row);
    if (map) {
      headerMap = map;
      headerRowNum = r;
      break;
    }
  }

  if (!headerMap) {
    return {
      rows: [],
      errors: [
        {
          fila: 1,
          mensaje:
            'No se encontró la fila de encabezados. Use la plantilla: Código ítem, Descripción, Unidad, Precio unitario, Cantidad.',
        },
      ],
    };
  }

  const rows: ItemCatalogExcelRow[] = [];
  const errors: Array<{ fila: number; mensaje: string }> = [];

  for (let r = headerRowNum + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (field: (typeof ITEM_CATALOG_EXCEL_HEADERS)[number]) => {
      const col = headerMap!.get(field);
      return col != null ? cellText(row.getCell(col).value) : '';
    };

    const codigo = get('codigo_item');
    const descripcion = get('descripcion');
    const unidadRaw = get('unidad');

    if (!codigo && !descripcion && !unidadRaw) {
      continue;
    }

    if (!codigo) {
      errors.push({ fila: r, mensaje: 'Falta código ítem.' });
      continue;
    }
    if (!descripcion) {
      errors.push({ fila: r, mensaje: 'Falta descripción.' });
      continue;
    }
    const unidad = normalizeItemCatalogUnit(unidadRaw);
    if (!unidad) {
      errors.push({
        fila: r,
        mensaje: `Unidad "${unidadRaw}" no válida. Use: ${ITEM_CATALOG_UNIT_VALUES.join(', ')}`,
      });
      continue;
    }

    const precioUnitario = parseNumberCell(
      headerMap.has('precio_unitario') ? row.getCell(headerMap.get('precio_unitario')!).value : null,
    );
    const cantidad = parseNumberCell(
      headerMap.has('cantidad') ? row.getCell(headerMap.get('cantidad')!).value : null,
    );

    if (precioUnitario != null && precioUnitario < 0) {
      errors.push({ fila: r, mensaje: 'Precio unitario no puede ser negativo.' });
      continue;
    }
    if (cantidad != null && cantidad < 0) {
      errors.push({ fila: r, mensaje: 'Cantidad no puede ser negativa.' });
      continue;
    }

    rows.push({
      rowNumber: r,
      codigo,
      descripcion,
      unidad,
      precioUnitario,
      cantidad,
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push({ fila: 0, mensaje: 'No hay filas de datos debajo de los encabezados.' });
  }

  return { rows, errors };
}
