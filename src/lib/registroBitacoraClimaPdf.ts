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
