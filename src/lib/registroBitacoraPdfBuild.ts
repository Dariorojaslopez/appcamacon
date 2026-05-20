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

  let transcurridoDias: number | null = null;
  if (project.startDate) {
    transcurridoDias = diffInclusiveCalendarDaysUtc(project.startDate, fecha);
  }

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
    tiempoTranscurridoDias: transcurridoDias,
    climaFilas,
    secciones,
    registradoPor: reg.user.name,
    actualizadoTexto: reg.updatedAt.toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
  };
}
