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
