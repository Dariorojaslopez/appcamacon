import { parseYmdUtc, toYmdUtc } from './registroBitacoraFecha';
import {
  resolveClimaFranja,
  type RegistroBitacoraPdfClimaFranja,
} from './registroBitacoraPdfHtml';

export type InformeClimaPorJornada = {
  franjaClimaMananaCodigo: string | null;
  franjaClimaTardeCodigo: string | null;
  franjaClimaNocheCodigo: string | null;
  jornadaCatalogo: {
    nombre: string;
    horaInicio: string;
    horaFin: string;
    orden: number;
  } | null;
};

export type InformeClimaPorJornadaRow = InformeClimaPorJornada & { date: Date };

/** Claves YYYY-MM-DD (UTC) de los días con registro de bitácora. */
export function ymdKeysFromRegistros(registros: { fecha: Date }[]): Set<string> {
  return new Set(registros.map((r) => toYmdUtc(r.fecha)));
}

/**
 * Rango [gte, lt) en UTC que cubre todos los días indicados.
 * Evita fallos de `date IN (...)` entre @db.Date (bitácora) y TIMESTAMP (informe).
 */
export function buildUtcDateRangeForYmdKeys(ymdKeys: string[]): { gte: Date; lt: Date } | null {
  const days: Date[] = [];
  for (const ymd of ymdKeys) {
    const d = parseYmdUtc(ymd);
    if (d) days.push(d);
  }
  if (days.length === 0) return null;
  days.sort((a, b) => a.getTime() - b.getTime());
  return {
    gte: days[0],
    lt: new Date(days[days.length - 1].getTime() + 86400000),
  };
}

export function groupInformesClimaPorYmd(
  informes: InformeClimaPorJornadaRow[],
): Map<string, InformeClimaPorJornada[]> {
  const map = new Map<string, InformeClimaPorJornada[]>();
  for (const inf of informes) {
    const key = toYmdUtc(inf.date);
    const list = map.get(key) ?? [];
    list.push({
      franjaClimaMananaCodigo: inf.franjaClimaMananaCodigo,
      franjaClimaTardeCodigo: inf.franjaClimaTardeCodigo,
      franjaClimaNocheCodigo: inf.franjaClimaNocheCodigo,
      jornadaCatalogo: inf.jornadaCatalogo,
    });
    map.set(key, list);
  }
  return map;
}

/** Días del rango (UTC) que tienen registro de bitácora y/o informe diario. */
export function sortedYmdKeysConDatosEnRango(
  desde: Date,
  hasta: Date,
  registros: { fecha: Date }[],
  informesPorFecha: Map<string, InformeClimaPorJornada[]>,
): string[] {
  const minYmd = toYmdUtc(desde);
  const maxYmd = toYmdUtc(hasta);
  const keys = new Set<string>();
  for (const r of registros) {
    const k = toYmdUtc(r.fecha);
    if (k >= minYmd && k <= maxYmd) keys.add(k);
  }
  for (const k of Array.from(informesPorFecha.keys())) {
    if (k >= minYmd && k <= maxYmd) keys.add(k);
  }
  return Array.from(keys).sort();
}

const FRANJAS_DIA = [
  { key: 'franjaClimaMananaCodigo' as const, label: 'Mañana' },
  { key: 'franjaClimaTardeCodigo' as const, label: 'Tarde' },
  { key: 'franjaClimaNocheCodigo' as const, label: 'Noche' },
];

export function labelJornadaInforme(
  jornada: InformeClimaPorJornada['jornadaCatalogo'],
): string {
  if (!jornada) return 'Sin jornada';
  return `${jornada.nombre} (${jornada.horaInicio} – ${jornada.horaFin})`;
}

/** Una fila por franja y por cada informe/jornada del día (ej. 2 jornadas → 6 filas). */
export function buildClimaFilasFromInformes(
  informes: InformeClimaPorJornada[],
  catalog: Map<string, string>,
  fallback?: {
    franjaClimaMananaCodigo?: string | null;
    franjaClimaTardeCodigo?: string | null;
    franjaClimaNocheCodigo?: string | null;
  },
): RegistroBitacoraPdfClimaFranja[] {
  const sorted = [...informes].sort((a, b) => {
    const oa = a.jornadaCatalogo?.orden ?? 999;
    const ob = b.jornadaCatalogo?.orden ?? 999;
    if (oa !== ob) return oa - ob;
    const na = a.jornadaCatalogo?.nombre ?? '';
    const nb = b.jornadaCatalogo?.nombre ?? '';
    return na.localeCompare(nb, 'es');
  });

  if (sorted.length > 0) {
    const rows: RegistroBitacoraPdfClimaFranja[] = [];
    for (const inf of sorted) {
      const jornada = labelJornadaInforme(inf.jornadaCatalogo);
      for (const f of FRANJAS_DIA) {
        const resolved = resolveClimaFranja(inf[f.key], catalog);
        rows.push({
          franja: f.label,
          tiempoHtml: resolved.tiempoHtml,
          jornada,
        });
      }
    }
    return rows;
  }

  if (fallback) {
    return FRANJAS_DIA.map((f) => {
      const resolved = resolveClimaFranja(fallback[f.key], catalog);
      return {
        franja: f.label,
        tiempoHtml: resolved.tiempoHtml,
        jornada: '—',
      };
    });
  }

  return FRANJAS_DIA.map((f) => ({
    franja: f.label,
    tiempoHtml: '—',
    jornada: '—',
  }));
}
