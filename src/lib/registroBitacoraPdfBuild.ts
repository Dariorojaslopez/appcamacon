import fs from 'fs/promises';
import path from 'path';
import type { RegistroBitacoraObra, User } from '@prisma/client';
import { storedMediaImgSrc } from './evidenciasUrlPayload';
import { diffInclusiveCalendarDaysUtc } from './registroBitacoraFecha';
import { isSharePointOrOneDriveShareUrl } from './obraCarpetaNube';
import {
  buildClimaFilasDeUnInforme,
  buildClimaFilasFromInformes,
  type InformeDiarioPdfRow,
} from './registroBitacoraClimaPdf';
import { parseEquiposManualJson, parsePersonalManualJson } from './registroBitacoraDiaInforme';
import { mapEquiposMaterialesParaPdf } from './registroBitacoraEquiposPdf';
import { agruparPersonalPorCargo } from './registroBitacoraPersonalPdf';
import type { RegistroBitacoraPdfDia, RegistroBitacoraPdfObra, RegistroBitacoraPdfSlot } from './registroBitacoraPdfHtml';
import { REGISTRO_BITACORA_SLOT_LABELS } from '../shared/registroBitacoraPermissions';
import { mergeLegacyFirmaUrl, parseFirmaDocsJson } from '../shared/registroBitacoraFirmaDocs';
import { resolveMediaParaPdfEmbed } from './registroBitacoraPdfMedia';

type ProjectPdf = {
  name: string;
  code: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  logoUrl: string | null;
};

type RegistroWithUser = RegistroBitacoraObra & { user: Pick<User, 'name'> };

function formatGuardadoEnPdf(iso: Date | string | null | undefined): string | null {
  if (!iso) return null;
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('es-CO', { timeZone: 'America/Bogota' });
}

/** Identificación de quien guardó cada sección (contratista, interventoría, IDU). */
export function registradoPorDesdeRegistro(reg: RegistroBitacoraObra): string {
  const partes: string[] = [];
  const c = reg.contratistaGuardadoPor?.trim();
  const i = reg.interventoriaGuardadoPor?.trim();
  const d = reg.iduGuardadoPor?.trim();
  if (c) partes.push(`${REGISTRO_BITACORA_SLOT_LABELS.contratista}: ${c}`);
  if (i) partes.push(`${REGISTRO_BITACORA_SLOT_LABELS.interventor}: ${i}`);
  if (d) partes.push(`${REGISTRO_BITACORA_SLOT_LABELS.idu}: ${d}`);
  return partes.length > 0 ? partes.join(' · ') : '—';
}

function actualizadoTextoDesdeRegistro(reg: RegistroBitacoraObra): string {
  const fechas = [
    formatGuardadoEnPdf(reg.contratistaGuardadoEn),
    formatGuardadoEnPdf(reg.interventoriaGuardadoEn),
    formatGuardadoEnPdf(reg.iduGuardadoEn),
    formatGuardadoEnPdf(reg.updatedAt),
  ].filter((v): v is string => Boolean(v));
  if (fechas.length === 0) return '—';
  return fechas.sort().at(-1) ?? '—';
}

export function absMediaPdf(origin: string, stored: string | null | undefined): string {
  const rel = storedMediaImgSrc(stored) ?? (typeof stored === 'string' && stored.trim() ? stored.trim() : '');
  if (!rel) return '';
  if (rel.startsWith('http')) return rel;
  return `${origin}${rel.startsWith('/') ? '' : '/'}${rel}`;
}

/** Logo embebible en HTML/PDF: local en base64, proxy Drive o vacío si no es cargable. */
export async function resolveObraLogoParaPdfHtml(
  origin: string,
  logoUrl: string | null | undefined,
): Promise<string> {
  const rel = storedMediaImgSrc(logoUrl);
  if (!rel) return '';

  if (rel.startsWith('/uploads/')) {
    try {
      const filePath = path.join(process.cwd(), 'public', rel.replace(/^\//, ''));
      const buf = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime =
        ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } catch {
      return `${origin}${rel}`;
    }
  }

  if (rel.startsWith('/api/') || rel.startsWith('http')) {
    const embedded = await resolveMediaParaPdfEmbed(origin, logoUrl);
    if (embedded) return embedded;
    if (rel.startsWith('/api/')) return `${origin}${rel}`;
    if (isSharePointOrOneDriveShareUrl(rel)) return '';
    return '';
  }

  return absMediaPdf(origin, logoUrl);
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

export async function buildObraPdfBase(origin: string, project: ProjectPdf): Promise<RegistroBitacoraPdfObra> {
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
    obraLogoUrl: await resolveObraLogoParaPdfHtml(origin, project.logoUrl),
    rangoObraTexto: rangoTxt,
    plazoContractualDias: plazoDias,
    contratoTexto: project.description?.trim() || project.code,
  };
}

function transcurridoDiasObra(project: ProjectPdf, fecha: Date): number | null {
  if (!project.startDate) return null;
  return diffInclusiveCalendarDaysUtc(project.startDate, fecha);
}

async function mapFirmaDocsPdf(
  origin: string,
  firmaUrl: string | null,
  rawDocs: unknown,
): Promise<{ firmaUrl: string; firmaDocs: RegistroBitacoraPdfSlot['firmaDocs'] }> {
  const merged = mergeLegacyFirmaUrl(firmaUrl, parseFirmaDocsJson(rawDocs));
  const drawn = await resolveMediaParaPdfEmbed(origin, firmaUrl);
  const docs = (
    await Promise.all(
      merged.map(async (d) => ({
        ...d,
        url: await resolveMediaParaPdfEmbed(origin, d.url),
      })),
    )
  ).filter((d) => d.url.trim().length > 0);
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

async function seccionesDesdeRegistro(origin: string, reg: RegistroWithUser): Promise<RegistroBitacoraPdfSlot[]> {
  const [c, i, d, fotoC, fotoI, fotoU] = await Promise.all([
    mapFirmaDocsPdf(origin, reg.contratistaFirmaUrl, reg.contratistaFirmaDocs),
    mapFirmaDocsPdf(origin, reg.interventoriaFirmaUrl, reg.interventoriaFirmaDocs),
    mapFirmaDocsPdf(origin, reg.iduFirmaUrl, reg.iduFirmaDocs),
    resolveMediaParaPdfEmbed(origin, reg.contratistaFotoUrl),
    resolveMediaParaPdfEmbed(origin, reg.interventoriaFotoUrl),
    resolveMediaParaPdfEmbed(origin, reg.iduFotoUrl),
  ]);
  return [
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.contratista,
      observaciones: reg.contratistaObservaciones,
      fotoUrl: fotoC,
      firmaUrl: c.firmaUrl,
      firmaDocs: c.firmaDocs,
    },
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.interventor,
      observaciones: reg.interventoriaObservaciones,
      fotoUrl: fotoI,
      firmaUrl: i.firmaUrl,
      firmaDocs: i.firmaDocs,
    },
    {
      titulo: REGISTRO_BITACORA_SLOT_LABELS.idu,
      observaciones: reg.iduObservaciones,
      fotoUrl: fotoU,
      firmaUrl: d.firmaUrl,
      firmaDocs: d.firmaDocs,
    },
  ];
}

type RegistroManualPdfSource = RegistroBitacoraObra & {
  user: Pick<User, 'name'>;
};

/** Hoja PDF cuando no hay informe diario pero sí registro con datos manuales del contratista. */
export async function buildRegistroSinInformePdfPage(
  origin: string,
  project: ProjectPdf,
  fecha: Date,
  reg: RegistroManualPdfSource,
  catalog: Map<string, string>,
): Promise<RegistroBitacoraPdfDia> {
  const climaFilas = buildClimaFilasFromInformes([], catalog, {
    franjaClimaMananaCodigo: reg.franjaClimaMananaCodigo,
    franjaClimaTardeCodigo: reg.franjaClimaTardeCodigo,
    franjaClimaNocheCodigo: reg.franjaClimaNocheCodigo,
  });

  return {
    consecutivo: reg.consecutivo,
    hoja: 0,
    totalHojas: 0,
    informeNo: '—',
    fechaTexto: formatFechaEsPdf(fecha),
    diaSemana: weekdayEsPdf(fecha),
    tiempoTranscurridoDias: transcurridoDiasObra(project, fecha),
    climaFilas,
    personalPorCargo: parsePersonalManualJson(reg.contratistaPersonalManual),
    equiposMateriales: parseEquiposManualJson(reg.contratistaEquiposManual),
    secciones: await seccionesDesdeRegistro(origin, reg),
    registradoPor: registradoPorDesdeRegistro(reg),
    actualizadoTexto: actualizadoTextoDesdeRegistro(reg),
  };
}

/** Una hoja del PDF = un informe diario (obra + fecha + jornada) + bitácora del mismo día si existe. */
export async function buildInformeDiarioPdfPage(
  origin: string,
  project: ProjectPdf,
  informe: InformeDiarioPdfRow,
  reg: RegistroWithUser | null,
  catalog: Map<string, string>,
): Promise<RegistroBitacoraPdfDia> {
  const fecha = informe.date;
  const informeNo =
    informe.informeNo?.trim() ||
    (informe.informeConsecutivo != null ? String(informe.informeConsecutivo) : '—');

  return {
    consecutivo: reg?.consecutivo ?? 0,
    hoja: 0,
    totalHojas: 0,
    informeNo,
    fechaTexto: formatFechaEsPdf(fecha),
    diaSemana: weekdayEsPdf(fecha),
    tiempoTranscurridoDias: transcurridoDiasObra(project, fecha),
    climaFilas: buildClimaFilasDeUnInforme(informe, catalog),
    personalPorCargo: agruparPersonalPorCargo(informe.personal ?? []),
    equiposMateriales: mapEquiposMaterialesParaPdf(informe.equipos ?? []),
    secciones: reg ? await seccionesDesdeRegistro(origin, reg) : seccionesVaciasBitacora(),
    registradoPor: reg ? registradoPorDesdeRegistro(reg) : '—',
    actualizadoTexto: reg ? actualizadoTextoDesdeRegistro(reg) : '—',
  };
}
