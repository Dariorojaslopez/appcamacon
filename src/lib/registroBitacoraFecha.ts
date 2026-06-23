/** Zona horaria del registro de bitácora (día civil operativo en Colombia). */
export const ZONA_REGISTRO_BITACORA = 'America/Bogota';

/** YYYY-MM-DD del instante en la zona de la bitácora. */
export function ymdEnZonaRegistroBitacora(
  date = new Date(),
  timeZone = ZONA_REGISTRO_BITACORA,
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Solo se permite crear o editar el registro del día actual (zona Colombia). */
export function fechaRegistroBitacoraEsHoy(fechaYmd: string): boolean {
  return fechaYmd.trim() === ymdEnZonaRegistroBitacora();
}

/** Día editable: hoy siempre; pasado solo si la obra lo permite; futuro nunca. */
export function puedeEditarRegistroBitacoraEnFecha(
  fechaYmd: string,
  permitirDiasAnteriores: boolean,
): boolean {
  const ymd = fechaYmd.trim();
  const hoy = ymdEnZonaRegistroBitacora();
  if (ymd > hoy) return false;
  if (ymd === hoy) return true;
  return permitirDiasAnteriores;
}

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

/** Fecha de informe diario: YYYY-MM-DD en UTC o normaliza un instante al día UTC. */
export function parseInformeDayUtc(dateInput: string): Date | null {
  const trimmed = dateInput.trim();
  const ymd = parseYmdUtc(trimmed);
  if (ymd) return ymd;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return dayOnlyUtc(d);
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
  return { ok: true, desde, hasta };
}
