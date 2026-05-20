/** Interpreta YYYY-MM-DD como día civil en UTC (coincide con @db.Date). */
export function parseYmdUtc(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = Date.UTC(y, m - 1, d);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

export function toYmdUtc(d: Date): string {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function dayOnlyUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function fechaRegistroEnRangoObra(
  fechaDay: Date,
  startDate: Date | null,
  endDate: Date | null,
): { ok: true } | { ok: false; error: string } {
  const f = dayOnlyUtc(fechaDay);
  if (startDate) {
    const s = dayOnlyUtc(startDate);
    if (f < s) return { ok: false as const, error: 'La fecha no puede ser anterior al inicio de la obra.' };
  }
  if (endDate) {
    const e = dayOnlyUtc(endDate);
    if (f > e) return { ok: false as const, error: 'La fecha no puede ser posterior al fin de la obra.' };
  }
  return { ok: true as const };
}

/** Días inclusivos entre dos fechas (solo componente calendario UTC). */
export function diffInclusiveCalendarDaysUtc(a: Date, b: Date): number {
  const ua = dayOnlyUtc(a).getTime();
  const ub = dayOnlyUtc(b).getTime();
  return Math.floor((ub - ua) / 86400000) + 1;
}

export const MAX_REGISTRO_BITACORA_RANGO_DIAS = 93;

/** Lista cada día civil UTC entre desde y hasta (inclusivo). */
export function eachYmdInRangeUtc(desde: Date, hasta: Date): Date[] {
  const start = dayOnlyUtc(desde);
  const end = dayOnlyUtc(hasta);
  if (start > end) return [];
  const out: Date[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(new Date(cur));
    cur = new Date(cur.getTime() + 86400000);
  }
  return out;
}

/** Rango [gte, lt) UTC que cubre desde..hasta inclusive (días civiles). */
export function buildUtcDateRangeInclusive(desde: Date, hasta: Date): { gte: Date; lt: Date } {
  const gte = dayOnlyUtc(desde);
  const lt = new Date(dayOnlyUtc(hasta).getTime() + 86400000);
  return { gte, lt };
}

export function parseRangoRegistroBitacora(
  desdeStr: string,
  hastaStr: string,
): { ok: true; desde: Date; hasta: Date } | { ok: false; error: string } {
  const desde = parseYmdUtc(desdeStr);
  const hasta = parseYmdUtc(hastaStr);
  if (!desde || !hasta) return { ok: false, error: 'Fechas no válidas (use YYYY-MM-DD).' };
  if (desde > hasta) return { ok: false, error: 'La fecha inicial no puede ser posterior a la final.' };
  const dias = diffInclusiveCalendarDaysUtc(desde, hasta);
  if (dias > MAX_REGISTRO_BITACORA_RANGO_DIAS) {
    return {
      ok: false,
      error: `El rango no puede superar ${MAX_REGISTRO_BITACORA_RANGO_DIAS} días.`,
    };
  }
  return { ok: true, desde, hasta };
}
