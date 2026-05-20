import prisma from './prisma';
import { eachYmdInRangeUtc, parseYmdUtc, toYmdUtc } from './registroBitacoraFecha';
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

export const INFORME_DIARIO_PDF_SELECT = {
  date: true,
  informeNo: true,
  informeConsecutivo: true,
  franjaClimaMananaCodigo: true,
  franjaClimaTardeCodigo: true,
  franjaClimaNocheCodigo: true,
  jornadaCatalogo: {
    select: { nombre: true, horaInicio: true, horaFin: true, orden: true },
  },
} as const;

export type InformeDiarioPdfRow = InformeClimaPorJornadaRow & {
  informeNo: string | null;
  informeConsecutivo: number | null;
};

/** Todos los informes diarios de la obra en el rango (uno por obra + fecha + jornada). */
export async function findInformesDiariosEnRango(
  projectId: string,
  desde: Date,
  hasta: Date,
): Promise<InformeDiarioPdfRow[]> {
  const days = eachYmdInRangeUtc(desde, hasta);
  if (days.length === 0) return [];
  const batches = await Promise.all(
    days.map((day) =>
      prisma.informeDiario.findMany({
        where: {
          projectId,
          date: { gte: day, lt: new Date(day.getTime() + 86400000) },
        },
        select: INFORME_DIARIO_PDF_SELECT,
        orderBy: [{ date: 'asc' }, { jornadaCatalogo: { orden: 'asc' } }],
      }),
    ),
  );
  return batches.flat();
}

/** @deprecated Use findInformesDiariosEnRango */
export async function findInformesClimaEnRango(
  projectId: string,
  desde: Date,
  hasta: Date,
): Promise<InformeClimaPorJornadaRow[]> {
  return findInformesDiariosEnRango(projectId, desde, hasta);
}

export function informeTieneFranjaClima(inf: InformeClimaPorJornada): boolean {
  return Boolean(
    inf.franjaClimaMananaCodigo?.trim() ||
      inf.franjaClimaTardeCodigo?.trim() ||
      inf.franjaClimaNocheCodigo?.trim(),
  );
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
  for (const [k, list] of Array.from(informesPorFecha.entries())) {
    if (k >= minYmd && k <= maxYmd && list.some(informeTieneFranjaClima)) keys.add(k);
  }
  return Array.from(keys).sort();
}

const FRANJAS_DIA = [
  { key: 'franjaClimaMananaCodigo' as const, label: 'Mañana' },
  { key: 'franjaClimaTardeCodigo' as const, label: 'Tarde' },
  { key: 'franjaClimaNocheCodigo' as const, label: 'Noche' },
];

/** Texto plano de franjas para PDF de bitácora digital u otros resúmenes. */
export function formatFranjasClimaTexto(
  inf: InformeClimaPorJornada,
  catalog: Map<string, string>,
): string {
  const partes: string[] = [];
  for (const f of FRANJAS_DIA) {
    const c = (inf[f.key] ?? '').trim();
    if (!c) continue;
    const nombre = catalog.get(c) ?? c;
    partes.push(`${f.label}: ${nombre}`);
  }
  return partes.length > 0 ? partes.join(' · ') : '';
}

export function labelJornadaInforme(
  jornada: InformeClimaPorJornada['jornadaCatalogo'],
): string {
  if (!jornada) return 'Sin jornada';
  return `${jornada.nombre} (${jornada.horaInicio} – ${jornada.horaFin})`;
}

/** Tres filas (mañana, tarde, noche) de un solo informe diario. */
export function buildClimaFilasDeUnInforme(
  informe: InformeClimaPorJornada,
  catalog: Map<string, string>,
): RegistroBitacoraPdfClimaFranja[] {
  return buildClimaFilasFromInformes([informe], catalog);
}

/** Una fila por franja y por cada informe del arreglo (en PDF: un informe → 3 filas). */
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
      for (const f of FRANJAS_DIA) {
        const resolved = resolveClimaFranja(inf[f.key], catalog);
        rows.push({
          franja: f.label,
          tiempoHtml: resolved.tiempoHtml,
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
      };
    });
  }

  return FRANJAS_DIA.map((f) => ({
    franja: f.label,
    tiempoHtml: '—',
  }));
}
