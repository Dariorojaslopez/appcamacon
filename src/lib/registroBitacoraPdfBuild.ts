import type { RegistroBitacoraObra, User } from '@prisma/client';
import { storedMediaImgSrc } from './evidenciasUrlPayload';
import { diffInclusiveCalendarDaysUtc } from './registroBitacoraFecha';
import {
  buildClimaFilasFromInformes,
  type InformeClimaPorJornada,
} from './registroBitacoraClimaPdf';
import type { RegistroBitacoraPdfDia, RegistroBitacoraPdfObra, RegistroBitacoraPdfSlot } from './registroBitacoraPdfHtml';
import { REGISTRO_BITACORA_SLOT_LABELS } from '../shared/registroBitacoraPermissions';

type ProjectPdf = {
  name: string;
  code: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  logoUrl: string | null;
};

type RegistroWithUser = RegistroBitacoraObra & { user: Pick<User, 'name'> };

export function absMediaPdf(origin: string, stored: string | null | undefined): string {
  const rel = storedMediaImgSrc(stored) ?? (typeof stored === 'string' && stored.trim() ? stored.trim() : '');
  if (!rel) return '';
  if (rel.startsWith('http')) return rel;
  return `${origin}${rel.startsWith('/') ? '' : '/'}${rel}`;
}

export function weekdayEsPdf(fecha: Date): string {
  const d = fecha.toLocaleDateString('es-CO', { weekday: 'long', timeZone: 'UTC' });
  return d.charAt(0).toUpperCase() + d.slice(1);
}

export function formatFechaEsPdf(fecha: Date): string {
  return fecha.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function buildObraPdfBase(origin: string, project: ProjectPdf): RegistroBitacoraPdfObra {
  const rangoTxt =
    project.startDate && project.endDate
      ? `${formatFechaEsPdf(project.startDate)} hasta ${formatFechaEsPdf(project.endDate)}`
      : project.startDate
        ? `Desde ${formatFechaEsPdf(project.startDate)}`
        : project.endDate
          ? `Hasta ${formatFechaEsPdf(project.endDate)}`
          : '—';

  let plazoDias: number | null = null;
  if (project.startDate && project.endDate) {
    plazoDias = diffInclusiveCalendarDaysUtc(project.startDate, project.endDate);
  }

  return {
    obraNombre: project.name,
    obraCodigo: project.code,
    obraLogoUrl: absMediaPdf(origin, project.logoUrl),
    rangoObraTexto: rangoTxt,
    plazoContractualDias: plazoDias,
    contratoTexto: project.description?.trim() || project.code,
  };
}

function transcurridoDiasObra(project: ProjectPdf, fecha: Date): number | null {
  if (!project.startDate) return null;
  return diffInclusiveCalendarDaysUtc(project.startDate, fecha);
}

/** Página del PDF con clima del informe diario (sin registro de bitácora guardado ese día). */
export function buildDiaPdfDataSoloInforme(
  project: ProjectPdf,
  fecha: Date,
  informesDelDia: InformeClimaPorJornada[],
  catalog: Map<string, string>,
): RegistroBitacoraPdfDia {
  const seccionesVacias: RegistroBitacoraPdfSlot[] = [
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.contratista,
      observaciones: '',
      fotoUrl: '',
      firmaUrl: '',
    },
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.interventor,
      observaciones: '',
      fotoUrl: '',
      firmaUrl: '',
    },
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.idu,
      observaciones: '',
      fotoUrl: '',
      firmaUrl: '',
    },
  ];

  return {
    consecutivo: 0,
    fechaTexto: formatFechaEsPdf(fecha),
    diaSemana: weekdayEsPdf(fecha),
    tiempoTranscurridoDias: transcurridoDiasObra(project, fecha),
    climaFilas: buildClimaFilasFromInformes(informesDelDia, catalog),
    secciones: seccionesVacias,
    registradoPor: '—',
    actualizadoTexto: '—',
  };
}

export function buildDiaPdfData(
  origin: string,
  project: ProjectPdf,
  reg: RegistroWithUser,
  fecha: Date,
  informesDelDia: InformeClimaPorJornada[],
  catalog: Map<string, string>,
): RegistroBitacoraPdfDia {
  const climaFilas = buildClimaFilasFromInformes(informesDelDia, catalog, {
    franjaClimaMananaCodigo: reg.franjaClimaMananaCodigo,
    franjaClimaTardeCodigo: reg.franjaClimaTardeCodigo,
    franjaClimaNocheCodigo: reg.franjaClimaNocheCodigo,
  });

  const secciones: RegistroBitacoraPdfSlot[] = [
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.contratista,
      observaciones: reg.contratistaObservaciones,
      fotoUrl: absMediaPdf(origin, reg.contratistaFotoUrl),
      firmaUrl: absMediaPdf(origin, reg.contratistaFirmaUrl),
    },
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.interventor,
      observaciones: reg.interventoriaObservaciones,
      fotoUrl: absMediaPdf(origin, reg.interventoriaFotoUrl),
      firmaUrl: absMediaPdf(origin, reg.interventoriaFirmaUrl),
    },
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.idu,
      observaciones: reg.iduObservaciones,
      fotoUrl: absMediaPdf(origin, reg.iduFotoUrl),
      firmaUrl: absMediaPdf(origin, reg.iduFirmaUrl),
    },
  ];

  return {
    consecutivo: reg.consecutivo,
    fechaTexto: formatFechaEsPdf(fecha),
    diaSemana: weekdayEsPdf(fecha),
    tiempoTranscurridoDias: transcurridoDiasObra(project, fecha),
    climaFilas,
    secciones,
    registradoPor: reg.user.name,
    actualizadoTexto: reg.updatedAt.toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
  };
}
