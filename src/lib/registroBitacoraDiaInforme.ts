import prisma from './prisma';
import { buildUtcDateRangeInclusive } from './registroBitacoraFecha';
import {
  INFORME_DIARIO_PDF_SELECT,
  type InformeDiarioPdfRow,
} from './registroBitacoraClimaPdf';
import { agruparPersonalPorCargo } from './registroBitacoraPersonalPdf';
import { mapEquiposMaterialesParaPdf } from './registroBitacoraEquiposPdf';
import {
  REGISTRO_MANUAL_EQUIPOS_MAX,
  REGISTRO_MANUAL_PERSONAL_MAX,
  type RegistroClimaFranjasForm,
  type RegistroEquipoManualRow,
  type RegistroPersonalManualRow,
} from '../shared/registroBitacoraDiaInforme';

export type RegistroBitacoraDiaInformeDto = {
  tieneInformeDiario: boolean;
  climaFranjas: RegistroClimaFranjasForm;
  personalPorCargo: RegistroPersonalManualRow[];
  equipos: RegistroEquipoManualRow[];
};

export function parsePersonalManualJson(raw: unknown): RegistroPersonalManualRow[] {
  if (!Array.isArray(raw)) return [];
  const out: RegistroPersonalManualRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const cargo = String((item as { cargo?: unknown }).cargo ?? '').trim();
    const totalRaw = (item as { total?: unknown }).total;
    const total =
      typeof totalRaw === 'number' && Number.isFinite(totalRaw)
        ? Math.max(0, Math.floor(totalRaw))
        : parseInt(String(totalRaw ?? '0'), 10);
    if (!cargo && (!total || total <= 0)) continue;
    out.push({ cargo: cargo || 'Sin cargo', total: Number.isFinite(total) && total > 0 ? total : 1 });
    if (out.length >= REGISTRO_MANUAL_PERSONAL_MAX) break;
  }
  return out;
}

export function parseEquiposManualJson(raw: unknown): RegistroEquipoManualRow[] {
  if (!Array.isArray(raw)) return [];
  const out: RegistroEquipoManualRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const descripcion = String((item as { descripcion?: unknown }).descripcion ?? '').trim();
    const estado = String((item as { estado?: unknown }).estado ?? '').trim();
    if (!descripcion && !estado) continue;
    out.push({
      descripcion: descripcion || '—',
      estado: estado || '—',
    });
    if (out.length >= REGISTRO_MANUAL_EQUIPOS_MAX) break;
  }
  return out;
}

export function parsePersonalManualFromBody(v: unknown): RegistroPersonalManualRow[] | undefined {
  if (v === undefined) return undefined;
  return parsePersonalManualJson(v);
}

export function parseEquiposManualFromBody(v: unknown): RegistroEquipoManualRow[] | undefined {
  if (v === undefined) return undefined;
  return parseEquiposManualJson(v);
}

export async function hayInformeDiarioEnDia(projectId: string, fecha: Date): Promise<boolean> {
  const { gte, lt } = buildUtcDateRangeInclusive(fecha, fecha);
  const count = await prisma.informeDiario.count({
    where: { projectId, date: { gte, lt } },
  });
  return count > 0;
}

export async function findInformesDiariosDelDia(
  projectId: string,
  fecha: Date,
): Promise<InformeDiarioPdfRow[]> {
  const { gte, lt } = buildUtcDateRangeInclusive(fecha, fecha);
  return prisma.informeDiario.findMany({
    where: { projectId, date: { gte, lt } },
    select: INFORME_DIARIO_PDF_SELECT,
    orderBy: [{ jornadaCatalogo: { orden: 'asc' } }],
  });
}

function mergeInformesDelDia(informes: InformeDiarioPdfRow[]): {
  personalPorCargo: RegistroPersonalManualRow[];
  equipos: RegistroEquipoManualRow[];
  climaFranjas: RegistroClimaFranjasForm;
} {
  const personalAll: { cargo: string }[] = [];
  const equiposAll: { descripcion: string; estado: string | null }[] = [];
  for (const inf of informes) {
    personalAll.push(...(inf.personal ?? []));
    equiposAll.push(...(inf.equipos ?? []));
  }
  const first = informes[0];
  return {
    personalPorCargo: agruparPersonalPorCargo(personalAll),
    equipos: mapEquiposMaterialesParaPdf(equiposAll),
    climaFranjas: {
      manana: first?.franjaClimaMananaCodigo?.trim() ?? '',
      tarde: first?.franjaClimaTardeCodigo?.trim() ?? '',
      noche: first?.franjaClimaNocheCodigo?.trim() ?? '',
    },
  };
}

type RegistroManualSource = {
  franjaClimaMananaCodigo: string | null;
  franjaClimaTardeCodigo: string | null;
  franjaClimaNocheCodigo: string | null;
  contratistaPersonalManual: unknown;
  contratistaEquiposManual: unknown;
};

export function diaInformeDesdeRegistro(reg: RegistroManualSource): RegistroBitacoraDiaInformeDto {
  return {
    tieneInformeDiario: false,
    climaFranjas: {
      manana: reg.franjaClimaMananaCodigo?.trim() ?? '',
      tarde: reg.franjaClimaTardeCodigo?.trim() ?? '',
      noche: reg.franjaClimaNocheCodigo?.trim() ?? '',
    },
    personalPorCargo: parsePersonalManualJson(reg.contratistaPersonalManual),
    equipos: parseEquiposManualJson(reg.contratistaEquiposManual),
  };
}

export async function loadRegistroBitacoraDiaInforme(
  projectId: string,
  fecha: Date,
  registro: RegistroManualSource | null,
): Promise<RegistroBitacoraDiaInformeDto> {
  const informes = await findInformesDiariosDelDia(projectId, fecha);
  if (informes.length > 0) {
    const merged = mergeInformesDelDia(informes);
    return {
      tieneInformeDiario: true,
      ...merged,
    };
  }
  if (registro) {
    return diaInformeDesdeRegistro(registro);
  }
  return {
    tieneInformeDiario: false,
    climaFranjas: { manana: '', tarde: '', noche: '' },
    personalPorCargo: [],
    equipos: [],
  };
}
