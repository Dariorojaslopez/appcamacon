import type { RegistroBitacoraObra, User } from '@prisma/client';
import { storedMediaImgSrc } from './evidenciasUrlPayload';
import { diffInclusiveCalendarDaysUtc } from './registroBitacoraFecha';
import { buildClimaFilasDeUnInforme, type InformeDiarioPdfRow } from './registroBitacoraClimaPdf';
import { mapEquiposMaterialesParaPdf } from './registroBitacoraEquiposPdf';
import { agruparPersonalPorCargo } from './registroBitacoraPersonalPdf';
import type { RegistroBitacoraPdfDia, RegistroBitacoraPdfObra, RegistroBitacoraPdfSlot } from './registroBitacoraPdfHtml';
import { REGISTRO_BITACORA_SLOT_LABELS } from '../shared/registroBitacoraPermissions';
import { mergeLegacyFirmaUrl, parseFirmaDocsJson } from '../shared/registroBitacoraFirmaDocs';

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

function mapFirmaDocsPdf(
  origin: string,
  firmaUrl: string | null,
  rawDocs: unknown,
): { firmaUrl: string; firmaDocs: RegistroBitacoraPdfSlot['firmaDocs'] } {
  const merged = mergeLegacyFirmaUrl(firmaUrl, parseFirmaDocsJson(rawDocs));
  const drawn = absMediaPdf(origin, firmaUrl);
  const docs = merged.map((d) => ({
    ...d,
    url: absMediaPdf(origin, d.url),
  }));
  return {
    firmaUrl: drawn && !docs.some((d) => d.url === drawn) ? drawn : '',
    firmaDocs: docs,
  };
}

function seccionesVaciasBitacora(): RegistroBitacoraPdfSlot[] {
  return [
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.contratista,
      observaciones: '',
      fotoUrl: '',
      firmaUrl: '',
      firmaDocs: [],
    },
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.interventor,
      observaciones: '',
      fotoUrl: '',
      firmaUrl: '',
      firmaDocs: [],
    },
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.idu,
      observaciones: '',
      fotoUrl: '',
      firmaUrl: '',
      firmaDocs: [],
    },
  ];
}

function seccionesDesdeRegistro(origin: string, reg: RegistroWithUser): RegistroBitacoraPdfSlot[] {
  const c = mapFirmaDocsPdf(origin, reg.contratistaFirmaUrl, reg.contratistaFirmaDocs);
  const i = mapFirmaDocsPdf(origin, reg.interventoriaFirmaUrl, reg.interventoriaFirmaDocs);
  const d = mapFirmaDocsPdf(origin, reg.iduFirmaUrl, reg.iduFirmaDocs);
  return [
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.contratista,
      observaciones: reg.contratistaObservaciones,
      fotoUrl: absMediaPdf(origin, reg.contratistaFotoUrl),
      firmaUrl: c.firmaUrl,
      firmaDocs: c.firmaDocs,
    },
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.interventor,
      observaciones: reg.interventoriaObservaciones,
      fotoUrl: absMediaPdf(origin, reg.interventoriaFotoUrl),
      firmaUrl: i.firmaUrl,
      firmaDocs: i.firmaDocs,
    },
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.idu,
      observaciones: reg.iduObservaciones,
      fotoUrl: absMediaPdf(origin, reg.iduFotoUrl),
      firmaUrl: d.firmaUrl,
      firmaDocs: d.firmaDocs,
    },
  ];
}

/** Una hoja del PDF = un informe diario (obra + fecha + jornada) + bitácora del mismo día si existe. */
export function buildInformeDiarioPdfPage(
  origin: string,
  project: ProjectPdf,
  informe: InformeDiarioPdfRow,
  reg: RegistroWithUser | null,
  catalog: Map<string, string>,
): RegistroBitacoraPdfDia {
  const fecha = informe.date;
  const informeNo =
    informe.informeNo?.trim() ||
    (informe.informeConsecutivo != null ? String(informe.informeConsecutivo) : '—');

  return {
    consecutivo: reg?.consecutivo ?? 0,
    folio: 0,
    totalFolios: 0,
    informeNo,
    fechaTexto: formatFechaEsPdf(fecha),
    diaSemana: weekdayEsPdf(fecha),
    tiempoTranscurridoDias: transcurridoDiasObra(project, fecha),
    climaFilas: buildClimaFilasDeUnInforme(informe, catalog),
    personalPorCargo: agruparPersonalPorCargo(informe.personal ?? []),
    equiposMateriales: mapEquiposMaterialesParaPdf(informe.equipos ?? []),
    secciones: reg ? seccionesDesdeRegistro(origin, reg) : seccionesVaciasBitacora(),
    registradoPor: reg?.user.name ?? '—',
    actualizadoTexto: reg
      ? reg.updatedAt.toLocaleString('es-CO', { timeZone: 'America/Bogota' })
      : '—',
  };
}
