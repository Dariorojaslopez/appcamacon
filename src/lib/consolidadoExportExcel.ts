import ExcelJS from 'exceljs';

export type ConsolidadoExportExcelRow = {
  informeCerrado: boolean;
  cerradoEn: string | null;
  datosGenerales: string;
  jornadaCondiciones: string;
  personal: string;
  equiposMateriales: string;
  actividades: string;
  calidad: string;
  evidencias: string;
};

function estadoCelda(row: ConsolidadoExportExcelRow): string {
  if (!row.informeCerrado) return 'Abierto';
  if (row.cerradoEn) {
    try {
      const d = new Date(row.cerradoEn);
      if (!Number.isNaN(d.getTime())) {
        return `Cerrado (${d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })})`;
      }
    } catch {
      // ignore
    }
  }
  return 'Cerrado';
}

export async function buildConsolidadoExportWorkbookBuffer(rows: ConsolidadoExportExcelRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SIGOCC';
  wb.created = new Date();

  const ws = wb.addWorksheet('Informes diarios', { views: [{ state: 'frozen', ySplit: 1 }] });
  const headers = [
    'Estado',
    'Datos generales',
    'Jornada y condiciones',
    'Personal en obra',
    'Equipos y materiales',
    'Actividades desarrolladas',
    'Calidad y afectaciones',
    'Evidencias y cierre',
  ];
  const headerRow = ws.addRow(headers);
  headerRow.height = 22;
  headerRow.font = { bold: true, size: 11, color: { argb: 'FF1E293B' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7EEF7' } };
  headerRow.alignment = { vertical: 'middle', wrapText: true, horizontal: 'center' };

  for (const row of rows) {
    const r = ws.addRow([
      estadoCelda(row),
      row.datosGenerales,
      row.jornadaCondiciones,
      row.personal,
      row.equiposMateriales,
      row.actividades,
      row.calidad,
      row.evidencias,
    ]);
    r.alignment = { wrapText: true, vertical: 'top' };
  }

  ws.getColumn(1).width = 28;
  for (let c = 2; c <= 8; c++) {
    ws.getColumn(c).width = 48;
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
