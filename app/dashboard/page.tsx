'use client';

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  IconHome,
  IconClipboard,
  IconSun,
  IconHardHat,
  IconTruck,
  IconHammer,
  IconAlert,
  IconCamera,
  IconCog,
  IconUsers,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
  IconTrash,
  IconShield,
  IconUserPlus,
  IconBuilding,
  IconMic,
  IconCalendar,
  IconClock,
  IconTabulacion,
  IconLogout,
} from './icons';
import { InformeSearchableSelect } from './InformeSearchableSelect';
import {
  EVIDENCIA_FASES,
  emptyEvidenciaUrlsPorFase,
  evidenciaCarouselImgSrc,
  evidenciaItemUrl,
  normalizeEvidenciasBody,
  totalEvidenciasCount,
  type EvidenciaFase,
  type EvidenciaItem,
} from '../../src/lib/evidenciasUrlPayload';
import { MENU_KEYS, MENU_LABELS } from '../../src/shared/menuPermissions';
import { FIRMA_PERM_ADMIN_KEYS, FIRMA_PERM_LABELS } from '../../src/shared/firmaPolicies';

/**
 * Orígenes http extras (NEXT_PUBLIC_VOICE_INSECURE_DEV_ORIGINS).
 * En `next dev`, también se acepta automáticamente cualquier http:// con IP privada (192.168.x, 10.x, 172.16–31.x)
 * para no cortar el flujo en el celular; el micrófono igual exige flag en Chrome o usar https (ver npm run dev:https).
 */
const VOICE_INSECURE_DEV_ORIGINS = new Set(
  (process.env.NEXT_PUBLIC_VOICE_INSECURE_DEV_ORIGINS ?? '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

function isPrivateLanIPv4(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const m = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m) {
    const n = Number(m[1]);
    return n >= 16 && n <= 31;
  }
  return false;
}

function voiceInsecureDevOriginMatch(): boolean {
  if (typeof window === 'undefined') return false;
  const origin = window.location.origin.toLowerCase();
  if (VOICE_INSECURE_DEV_ORIGINS.has(origin)) return true;
  if (process.env.NODE_ENV !== 'development') return false;
  try {
    const u = new URL(window.location.href);
    if (u.protocol !== 'http:') return false;
    return isPrivateLanIPv4(u.hostname);
  } catch {
    return false;
  }
}

function browserPermissionPolicyAllows(feature: 'camera' | 'geolocation'): boolean {
  if (typeof document === 'undefined') return true;
  const doc = document as any;
  const policy = doc.permissionsPolicy ?? doc.featurePolicy;
  if (!policy?.allowsFeature) return true;
  try {
    return Boolean(policy.allowsFeature(feature));
  } catch {
    return true;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function formatItemCatalogSubtotal(
  precioUnitario: number | null | undefined,
  cantidad: number | null | undefined,
): string | null {
  const p = precioUnitario != null ? Number(precioUnitario) : NaN;
  const c = cantidad != null ? Number(cantidad) : NaN;
  if (!Number.isFinite(p) || !Number.isFinite(c)) return null;
  return (p * c).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Unidades del catálogo de ítems: captura y cálculo de cantidad según tabla operativa. */
const ITEM_CATALOG_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'm3', label: 'm³ — Volumen (L × A × H)' },
  { value: 'm2', label: 'm² — Área (L × A)' },
  { value: 'ml', label: 'ml — Longitud' },
  { value: 'm', label: 'm — Longitud simple' },
  { value: 'und', label: 'und — Conteo' },
  { value: 'kg', label: 'kg — Peso' },
  { value: 'ton', label: 'ton — Peso' },
  { value: 'l', label: 'l — Litros' },
];

function normalizeItemCatalogUnit(raw: string | null | undefined): string | null {
  const u0 = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!u0) return null;
  const map: Record<string, string> = {
    m3: 'm3',
    'm³': 'm3',
    m2: 'm2',
    'm²': 'm2',
    ml: 'ml',
    m: 'm',
    und: 'und',
    un: 'und',
    kg: 'kg',
    ton: 'ton',
    t: 'ton',
    l: 'l',
    lt: 'l',
    litro: 'l',
    litros: 'l',
    'l (litros)': 'l',
  };
  if (map[u0]) return map[u0];
  if (['m3', 'm2', 'ml', 'm', 'und', 'kg', 'ton', 'l'].includes(u0)) return u0;
  return null;
}

type ItemCatalogCaptureKind = 'm3' | 'm2' | 'length' | 'manual' | 'none';

function itemCatalogCaptureKind(rawUnidad: string): ItemCatalogCaptureKind {
  const u = normalizeItemCatalogUnit(rawUnidad);
  if (u === 'm3') return 'm3';
  if (u === 'm2') return 'm2';
  if (u === 'ml' || u === 'm') return 'length';
  if (u === 'und' || u === 'kg' || u === 'ton' || u === 'l') return 'manual';
  if (String(rawUnidad ?? '').trim()) return 'manual';
  return 'none';
}

function parseItemCatalogDim(s: string): number | null {
  const t = String(s ?? '').trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function computeItemCatalogCantidadFromInputs(
  rawUnidad: string,
  largo: string,
  ancho: string,
  altura: string,
  manualCantidad: string,
): number | null {
  const kind = itemCatalogCaptureKind(rawUnidad);
  if (kind === 'none') return null;
  if (kind === 'manual') return parseItemCatalogDim(manualCantidad);
  const L = parseItemCatalogDim(largo);
  const A = parseItemCatalogDim(ancho);
  const H = parseItemCatalogDim(altura);
  if (kind === 'm3') {
    if (L == null || A == null || H == null) return null;
    return L * A * H;
  }
  if (kind === 'm2') {
    if (L == null || A == null) return null;
    return L * A;
  }
  if (L == null) return null;
  return L;
}

function dimensionsForItemCatalogApi(
  rawUnidad: string,
  largo: string,
  ancho: string,
  altura: string,
): { largo: number | null; ancho: number | null; altura: number | null } {
  const kind = itemCatalogCaptureKind(rawUnidad);
  if (kind === 'manual' || kind === 'none') {
    return { largo: null, ancho: null, altura: null };
  }
  const L = parseItemCatalogDim(largo);
  const A = parseItemCatalogDim(ancho);
  const H = parseItemCatalogDim(altura);
  if (kind === 'm3') return { largo: L, ancho: A, altura: H };
  if (kind === 'm2') return { largo: L, ancho: A, altura: null };
  return { largo: L, ancho: null, altura: null };
}

function itemCatalogPayloadFromFormFields(
  rawUnidad: string,
  largo: string,
  ancho: string,
  altura: string,
  cantidad: string,
) {
  const unidad = rawUnidad.trim();
  const cantidadNum = computeItemCatalogCantidadFromInputs(unidad, largo, ancho, altura, cantidad);
  const dims = dimensionsForItemCatalogApi(unidad, largo, ancho, altura);
  return {
    unidad: unidad || null,
    cantidad: cantidadNum,
    largo: dims.largo,
    ancho: dims.ancho,
    altura: dims.altura,
  };
}

function getItemCatalogUnitChangePatch(
  nextUnit: string,
): Partial<Record<'largo' | 'ancho' | 'altura' | 'cantidad', string>> {
  const kind = itemCatalogCaptureKind(nextUnit);
  if (kind === 'none') return { largo: '', ancho: '', altura: '', cantidad: '' };
  if (kind === 'manual') return { largo: '', ancho: '', altura: '' };
  if (kind === 'm3') return { cantidad: '' };
  if (kind === 'm2') return { altura: '', cantidad: '' };
  return { ancho: '', altura: '', cantidad: '' };
}

function formatItemCatalogCantidadDisplay(
  rawUnidad: string,
  largo: string,
  ancho: string,
  altura: string,
  manualCantidad: string,
): string {
  const n = computeItemCatalogCantidadFromInputs(rawUnidad, largo, ancho, altura, manualCantidad);
  return n != null
    ? n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    : '—';
}

/** Siguiente código solo numérico (1, 2, 3…) según el máximo entre ítems de la obra. */
function nextAutonumericItemCatalogCodigo(items: { codigo: string }[]): string {
  let max = 0;
  for (const it of items) {
    const c = String(it.codigo ?? '').trim();
    if (/^\d+$/.test(c)) {
      const n = Number(c);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return String(max + 1);
}

/** Ítem del catálogo en árbol presupuesto (capítulo → subcapítulo → ítem). */
type ItemCatalogNode = {
  id: string;
  projectId: string;
  subchapterId: string;
  proveedorId?: string | null;
  proveedor?: {
    id: string;
    nombreRazonSocial: string;
    nombreComercial?: string | null;
    nitDocumento: string;
  } | null;
  codigo: string;
  descripcion: string;
  unidad?: string | null;
  precioUnitario?: number | null;
  cantidad?: number | null;
  largo?: number | null;
  ancho?: number | null;
  altura?: number | null;
  imagenUrl?: string | null;
  imagenLatitud?: number | null;
  imagenLongitud?: number | null;
  imagenPrecision?: number | null;
  imagenGeoEstado?: string | null;
  imagenTomadaEn?: string | null;
  orden: number;
  isActive: boolean;
};

type BudgetSubchapterTree = {
  id: string;
  chapterId: string;
  nombre: string;
  orden: number;
  isActive: boolean;
  items: ItemCatalogNode[];
};

type BudgetChapterTree = {
  id: string;
  projectId: string;
  codigo: string;
  nombre: string;
  orden: number;
  isActive: boolean;
  subchapters: BudgetSubchapterTree[];
};

type ProveedorCatalogAdmin = {
  id: string;
  projectId: string;
  tipoPersona: string;
  nombreRazonSocial: string;
  nombreComercial?: string | null;
  nitDocumento: string;
  dv?: string | null;
  email?: string | null;
  telefono?: string | null;
  celular?: string | null;
  direccion?: string | null;
  pais?: string | null;
  departamento?: string | null;
  ciudad?: string | null;
  codigoPostal?: string | null;
  isActive: boolean;
};

const emptyProveedorForm = () => ({
  tipoPersona: 'Natural',
  nombreRazonSocial: '',
  nombreComercial: '',
  nitDocumento: '',
  dv: '',
  email: '',
  telefono: '',
  celular: '',
  direccion: '',
  pais: 'Colombia',
  departamento: '',
  ciudad: '',
  codigoPostal: '',
  isActive: true,
});

function flattenItemCatalogTree(
  chapters: BudgetChapterTree[],
): Array<ItemCatalogNode & { chapterCodigo: string; chapterNombre: string; subchapterNombre: string; proveedorNombre: string | null }> {
  const rows: Array<
    ItemCatalogNode & { chapterCodigo: string; chapterNombre: string; subchapterNombre: string; proveedorNombre: string | null }
  > = [];
  for (const ch of chapters) {
    for (const sub of ch.subchapters) {
      for (const it of sub.items) {
        rows.push({
          ...it,
          chapterCodigo: ch.codigo,
          chapterNombre: ch.nombre,
          subchapterNombre: sub.nombre,
          proveedorNombre: it.proveedor?.nombreComercial || it.proveedor?.nombreRazonSocial || null,
        });
      }
    }
  }
  return rows;
}

function flattenBudgetSubchapters(
  chapters: BudgetChapterTree[],
): Array<BudgetSubchapterTree & { chapterCodigo: string; chapterNombre: string }> {
  const rows: Array<BudgetSubchapterTree & { chapterCodigo: string; chapterNombre: string }> = [];
  for (const ch of chapters) {
    for (const sub of ch.subchapters) {
      rows.push({
        ...sub,
        chapterCodigo: ch.codigo,
        chapterNombre: ch.nombre,
      });
    }
  }
  return rows;
}

type FotoGeoFields = {
  imagenLatitud?: number | null;
  imagenLongitud?: number | null;
  imagenPrecision?: number | null;
  imagenGeoEstado?: string | null;
  imagenTomadaEn?: string | null;
};

type UploadedRegistroFotografico = FotoGeoFields & {
  url: string;
};

function emptyFotoGeoFields(): FotoGeoFields {
  return {
    imagenLatitud: null,
    imagenLongitud: null,
    imagenPrecision: null,
    imagenGeoEstado: null,
    imagenTomadaEn: null,
  };
}

function fotoGeoFromSource(source: any): FotoGeoFields {
  return {
    imagenLatitud:
      typeof source?.imagenLatitud === 'number' && Number.isFinite(source.imagenLatitud)
        ? source.imagenLatitud
        : null,
    imagenLongitud:
      typeof source?.imagenLongitud === 'number' && Number.isFinite(source.imagenLongitud)
        ? source.imagenLongitud
        : null,
    imagenPrecision:
      typeof source?.imagenPrecision === 'number' && Number.isFinite(source.imagenPrecision)
        ? source.imagenPrecision
        : null,
    imagenGeoEstado: source?.imagenGeoEstado ? String(source.imagenGeoEstado) : null,
    imagenTomadaEn: source?.imagenTomadaEn ? String(source.imagenTomadaEn) : null,
  };
}

function fotoGeoPayload(source: FotoGeoFields) {
  return {
    imagenLatitud:
      typeof source.imagenLatitud === 'number' && Number.isFinite(source.imagenLatitud)
        ? source.imagenLatitud
        : null,
    imagenLongitud:
      typeof source.imagenLongitud === 'number' && Number.isFinite(source.imagenLongitud)
        ? source.imagenLongitud
        : null,
    imagenPrecision:
      typeof source.imagenPrecision === 'number' && Number.isFinite(source.imagenPrecision)
        ? source.imagenPrecision
        : null,
    imagenGeoEstado: source.imagenGeoEstado ?? null,
    imagenTomadaEn: source.imagenTomadaEn ?? null,
  };
}

function clearFotoGeoPayload() {
  return {
    imagenLatitud: null,
    imagenLongitud: null,
    imagenPrecision: null,
    imagenGeoEstado: null,
    imagenTomadaEn: null,
  };
}

function RegistroFotograficoInput({
  idBase,
  label = 'Registro fotográfico',
  imageUrl,
  disabled,
  onUploaded,
  onClear,
  onPreview,
  onFileSelected,
}: {
  idBase: string;
  label?: string;
  imageUrl?: string | null;
  disabled?: boolean;
  onUploaded: (foto: UploadedRegistroFotografico) => void;
  onClear: () => void;
  onPreview: (url: string) => void;
  onFileSelected: (file: File | null) => Promise<UploadedRegistroFotografico | null>;
}) {
  const selectRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const handleFile = async (file: File | null, input: HTMLInputElement | null) => {
    try {
      const uploaded = await onFileSelected(file);
      if (uploaded) onUploaded(uploaded);
    } finally {
      if (input) input.value = '';
    }
  };

  return (
    <div className="registro-foto-field">
      <label className="informe-label" htmlFor={`${idBase}-select`}>
        {label}
      </label>
      <div className="registro-foto-actions">
        <button
          type="button"
          className="registro-foto-btn registro-foto-btn-primary"
          disabled={disabled}
          onClick={() => selectRef.current?.click()}
        >
          Seleccionar archivo
        </button>
        <button
          type="button"
          className="registro-foto-btn"
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
        >
          Tomar registro fotográfico
        </button>
        {imageUrl ? (
          <button
            type="button"
            className="registro-foto-btn"
            disabled={disabled}
            onClick={() => onPreview(imageUrl)}
          >
            Ver imagen
          </button>
        ) : null}
      </div>
      <input
        ref={selectRef}
        id={`${idBase}-select`}
        className="sr-only"
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null, e.currentTarget)}
      />
      <input
        ref={cameraRef}
        id={`${idBase}-camera`}
        className="sr-only"
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null, e.currentTarget)}
      />
      {imageUrl ? (
        <div className="equipo-imagen-preview">
          <button type="button" className="registro-foto-preview-btn" onClick={() => onPreview(imageUrl)}>
            <img src={imageUrl} alt={label} className="calidad-mobile-thumb" />
          </button>
          <button type="button" className="equipo-imagen-remove-btn" disabled={disabled} onClick={onClear}>
            Quitar imagen
          </button>
        </div>
      ) : null}
    </div>
  );
}

const emptyPersonalDraft = () => ({
  nombre: '',
  cargo: '',
  subcontratista: '',
  horaEntrada: '',
  horaSalida: '',
});

const emptyEquipoDraft = () => ({
  descripcion: '',
  placaRef: '',
  propiedad: '',
  estado: '',
  observacion: '',
  imagenUrl: '',
  ...emptyFotoGeoFields(),
  horaIngreso: '',
  horaSalida: '',
  horasTrabajadas: 0,
  horarios: [] as EquipoHorarioDraft[],
});

type EquipoHorarioDraft = {
  horaIngreso: string;
  horaSalida: string;
  horasTrabajadas: number;
};

function computeEquipoHorasDecimal(entrada: string, salida: string): number {
  if (!entrada || !salida) return 0;
  const [eh, em] = entrada.split(':').map(Number);
  const [sh, sm] = salida.split(':').map(Number);
  if (![eh, em, sh, sm].every(Number.isFinite)) return 0;
  let min = sh * 60 + sm - (eh * 60 + em);
  if (min < 0) min += 24 * 60;
  return Math.round((min / 60) * 100) / 100;
}

function formatEquipoHoras(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0h 0m';
  const totalMin = Math.round(value * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

function sumEquipoHorarios(horarios: EquipoHorarioDraft[]): number {
  return Math.round(horarios.reduce((sum, h) => sum + (Number(h.horasTrabajadas) || 0), 0) * 100) / 100;
}

const emptyIngresoDraft = () => ({
  proveedor: '',
  tipoMaterial: '',
  noRemision: '',
  unidad: '',
  cantidad: 0,
  observacion: '',
  imagenUrl: '',
  ...emptyFotoGeoFields(),
});

const emptyEntregaDraft = () => ({
  tipoMaterial: '',
  unidad: '',
  cantidad: 0,
  contratista: '',
  firmaRecibido: false,
  observacion: '',
  imagenUrl: '',
  ...emptyFotoGeoFields(),
});

const emptyActividadDraft = () => ({
  pk: '',
  abscisado: '',
  itemContractual: '',
  descripcion: '',
  unidadMedida: '',
  observacion: '',
  imagenUrl: null as string | null,
  ...emptyFotoGeoFields(),
  largo: 0,
  ancho: 0,
  altura: 0,
  cantidadTotal: 0,
});

const emptyEnsayoDraft = () => ({
  materialActividad: '',
  tipoEnsayo: '',
  idMuestra: '',
  laboratorio: '',
  localizacion: '',
  resultado: '',
  observacion: '',
  imagenUrl: '',
  ...emptyFotoGeoFields(),
});

const emptyDanoDraft = () => ({
  horaReporte: '',
  direccion: '',
  tipoDano: '',
  entidad: '',
  noReporte: '',
  observacion: '',
  imagenUrl: '',
  ...emptyFotoGeoFields(),
});

const emptyNoConformidadDraft = () => ({
  noConformidad: '',
  detalle: '',
  estado: '',
  imagenUrl: '',
  ...emptyFotoGeoFields(),
});

function equipoPropiedadLabel(v: string) {
  if (v === 'PROPIO') return 'Propio';
  if (v === 'ALQUILADO') return 'Alquilado';
  return v.trim() || '—';
}

function equipoEstadoLabel(v: string) {
  const map: Record<string, string> = {
    OPERATIVO: 'Operativo',
    EN_MANTENIMIENTO: 'En mantenimiento',
    FUERA_DE_SERVICIO: 'Fuera de servicio',
  };
  return map[v] ?? (v.trim() || '—');
}

const INFORME_STEPS = [
  { id: 'datos' as const, label: 'Datos generales', Icon: IconClipboard },
  { id: 'jornada' as const, label: 'Jornada y condiciones', Icon: IconSun },
  { id: 'personal' as const, label: 'Personal en obra', Icon: IconHardHat },
  { id: 'equipos' as const, label: 'Equipos y materiales', Icon: IconTruck },
  { id: 'actividades' as const, label: 'Actividades desarrolladas', Icon: IconHammer },
  { id: 'calidad' as const, label: 'Calidad e incidentes', Icon: IconAlert },
  { id: 'evidencias' as const, label: 'Evidencias y cierre', Icon: IconCamera },
  { id: 'tabulacion' as const, label: 'Formato de tabulación', Icon: IconTabulacion },
] as const;

type FirmaEvidenciaState = {
  codigo: string;
  observacion: string;
  firmado: boolean;
  firmadoEn: string | null;
};

const emptyFirmaEvidencia = (): FirmaEvidenciaState => ({
  codigo: '',
  observacion: '',
  firmado: false,
  firmadoEn: null,
});

const FIRMAS_EVIDENCIAS_CONFIG = [
  { key: 'responsableDiligenciamiento', label: 'Responsable de diligenciamiento' },
  { key: 'residenteObra', label: 'Residente de obra' },
  { key: 'auxiliarIngenieria', label: 'Auxiliar de ingeniería' },
  { key: 'vistoBuenoDirectorObra', label: 'Visto bueno director de obra' },
] as const;

/** Campos de datos generales al cambiar a un informe que aún no existe (otra jornada / día). */
const DATOS_GENERALES_CAMPOS_VACIOS = {
  frenteObra: '',
  frenteObraCatalogoId: '',
  contratista: '',
  contratistaCatalogoId: '',
  encargadoReporte: '',
  encargadoReporteCatalogoId: '',
  cargo: '',
  cargoCatalogoId: '',
  horaEntrada: '',
  horaSalida: '',
} as const;

/** Valores enviados a la API (InformeDiario.tipoClima). */
const CLIMA_INFORME_OPTIONS = [
  { value: 'SOLEADO', label: 'Soleado' },
  { value: 'NUBLADO', label: 'Nublado' },
  { value: 'LLUVIA', label: 'Lluvia' },
  { value: 'TORMENTA', label: 'Tormenta' },
  { value: 'VIENTO', label: 'Viento' },
  { value: 'OTRO', label: 'Otro' },
] as const;

function climaInformeLabel(value: string): string {
  const v = (value ?? '').trim();
  if (!v) return '—';
  const hit = CLIMA_INFORME_OPTIONS.find((o) => o.value === v);
  return hit?.label ?? v;
}

type SuspensionRow = {
  id: string;
  motivoSuspension: string;
  horaSuspension: string;
  horaReinicio: string;
  tipoClima: string;
  horasClima: number;
  imagenUrl?: string | null;
  imagenLatitud?: number | null;
  imagenLongitud?: number | null;
  imagenPrecision?: number | null;
  imagenGeoEstado?: string | null;
  imagenTomadaEn?: string | null;
};

type FirmaEvidenciaKey = (typeof FIRMAS_EVIDENCIAS_CONFIG)[number]['key'];

function normalizeFirmaEvidenciaFromApi(raw: unknown): FirmaEvidenciaState {
  if (!raw || typeof raw !== 'object') return emptyFirmaEvidencia();
  const o = raw as Record<string, unknown>;
  return {
    codigo: String(o.codigo ?? ''),
    observacion: String(o.observacion ?? ''),
    firmado: Boolean(o.firmado),
    firmadoEn: o.firmadoEn != null && o.firmadoEn !== '' ? String(o.firmadoEn) : null,
  };
}

/** Valor de <input type="time"> → HH:mm para la API (sin segundos; algunos navegadores envían :ss). */
function normalizarHoraHHmm(value: string): string {
  const v = value.trim();
  const m = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return v;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) return v;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Horas entre suspensión y reinicio (mismo día o cruza medianoche si reinicio < suspensión).
 * Misma hora en ambos campos → 0. Resultado en pasos de 0,5 h.
 */
function horasEntreTiemposHHmm(horaSuspension: string, horaReinicio: string): number {
  const toMin = (t: string): number | null => {
    const n = normalizarHoraHHmm(t);
    const m = n.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (Number.isNaN(h) || Number.isNaN(min)) return null;
    return h * 60 + min;
  };
  const startM = toMin(horaSuspension);
  const end0 = toMin(horaReinicio);
  if (startM === null || end0 === null) return 0;
  let endM = end0;
  if (endM < startM) endM += 24 * 60;
  else if (endM === startM) return 0;
  const hours = (endM - startM) / 60;
  return Math.round(hours * 2) / 2;
}

function minutosDesdeMedianocheHHmm(t: string): number | null {
  const n = normalizarHoraHHmm(t);
  const m = n.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Si inicio ≤ fin: rango el mismo día [inicio, fin]. Si no: jornada nocturna (cruza medianoche). */
function estaHoraDentroDeJornada(hora: string, horaInicio: string, horaFin: string): boolean {
  const t = minutosDesdeMedianocheHHmm(hora);
  const a = minutosDesdeMedianocheHHmm(horaInicio);
  const b = minutosDesdeMedianocheHHmm(horaFin);
  if (t === null || a === null || b === null) return false;
  if (a <= b) return t >= a && t <= b;
  return t >= a || t <= b;
}

export default function DashboardPage() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [informeExpanded, setInformeExpanded] = useState(false);
  const [informeDropdownOpen, setInformeDropdownOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [canShowInstallCta, setCanShowInstallCta] = useState(false);
  const [activeSection, setActiveSection] = useState<
    | 'home'
    | 'settings'
    | 'users'
    | 'datos'
    | 'jornada'
    | 'personal'
    | 'equipos'
    | 'actividades'
    | 'calidad'
    | 'evidencias'
    | 'tabulacion'
  >('home');
  const isInformeSection = useMemo(
    () =>
      activeSection === 'datos' ||
      activeSection === 'jornada' ||
      activeSection === 'personal' ||
      activeSection === 'equipos' ||
      activeSection === 'actividades' ||
      activeSection === 'calidad' ||
      activeSection === 'evidencias' ||
      activeSection === 'tabulacion',
    [activeSection],
  );
  const [usersSubSection, setUsersSubSection] = useState<'crear' | 'administrar' | 'roles'>('crear');
  const [creatingUser, setCreatingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    identification: '',
    email: '',
    name: '',
    role: '',
    password: '',
  });
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<{ id: string; identification: string; email: string; name: string; role: string; isActive: boolean }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editUser, setEditUser] = useState<{ id: string; identification: string; email: string; name: string; role: string; isActive: boolean } | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: '', password: '' });
  const [savingUser, setSavingUser] = useState(false);
  const [roleLabels, setRoleLabels] = useState<{ role: string; label: string }[]>([]);
  const [loadingRoleLabels, setLoadingRoleLabels] = useState(false);
  const [editingRoleLabel, setEditingRoleLabel] = useState<Record<string, string>>({});
  const [savingRoleLabel, setSavingRoleLabel] = useState<string | null>(null);
  const [allowedMenus, setAllowedMenus] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = sessionStorage.getItem('sigocc_allowedMenus');
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // ignorar
    }
    return [];
  });
  const [rolePermissions, setRolePermissions] = useState<
    { role: string; label?: string; menuKeys: string[]; firmaPermKeys: string[] }[]
  >([]);
  const [permissionMenuKeys, setPermissionMenuKeys] = useState<string[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [availableRoles, setAvailableRoles] = useState<{ role: string; label: string }[]>([]);
  const [settingsSubSection, setSettingsSubSection] = useState<
    | 'obras'
    | 'jornadas'
    | 'frentesObra'
    | 'contratistas'
    | 'encargados'
    | 'cargos'
    | 'proveedores'
    | 'estructuraItems'
    | 'items'
  >('obras');
  const [obrasList, setObrasList] = useState<
    {
      id: string;
      consecutivo: number | null;
      name: string;
      code: string;
      startDate: string | null;
      endDate: string | null;
      evidenciasOnedriveShareUrl: string | null;
      evidenciasGoogleDriveFolderId: string | null;
      isActive: boolean;
    }[]
  >([]);
  const [loadingObras, setLoadingObras] = useState(false);
  const [obraForm, setObraForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    evidenciasGoogleDriveFolderId: '',
  });
  const [creatingObra, setCreatingObra] = useState(false);
  const [obraMessage, setObraMessage] = useState<string | null>(null);
  const [obraError, setObraError] = useState<string | null>(null);
  const [editObra, setEditObra] = useState<{
    id: string;
    consecutivo: number | null;
    name: string;
    code: string;
    startDate: string | null;
    endDate: string | null;
    evidenciasOnedriveShareUrl: string | null;
    evidenciasGoogleDriveFolderId: string | null;
  } | null>(null);
  const [editObraForm, setEditObraForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    evidenciasGoogleDriveFolderId: '',
  });
  const [savingObra, setSavingObra] = useState(false);
  const [deletingObraId, setDeletingObraId] = useState<string | null>(null);
  const [obrasForInforme, setObrasForInforme] = useState<{ id: string; name: string; code: string }[]>([]);
  const [loadingObrasForInforme, setLoadingObrasForInforme] = useState(false);

  // Catálogos para Datos generales
  const [contratistasOptions, setContratistasOptions] = useState<{ id: string; cedula: string; nombre: string }[]>([]);
  const [encargadosOptions, setEncargadosOptions] = useState<{ id: string; cedula: string; nombre: string }[]>([]);
  const [cargosOptions, setCargosOptions] = useState<
    { id: string; nombre: string; consecutivo?: number | null }[]
  >([]);
  const [frentesObraOptions, setFrentesObraOptions] = useState<{ id: string; nombre: string }[]>([]);
  const [itemsCatalogOptions, setItemsCatalogOptions] = useState<
    {
      id: string;
      codigo: string;
      descripcion: string;
      unidad?: string | null;
      precioUnitario?: number | null;
      cantidad?: number | null;
      largo?: number | null;
      ancho?: number | null;
      altura?: number | null;
      imagenUrl?: string | null;
      rubro?: string | null;
    }[]
  >([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(false);

  // Catálogos en Configuración (CRUD)
  const [contratistasAdmin, setContratistasAdmin] = useState<
    { id: string; projectId: string; cedula: string; nombre: string; isActive: boolean }[]
  >([]);
  const [contratistasNewCedula, setContratistasNewCedula] = useState('');
  const [contratistasNewNombre, setContratistasNewNombre] = useState('');
  const [contratistasSaving, setContratistasSaving] = useState(false);
  const [contratistasError, setContratistasError] = useState<string | null>(null);
  const [editingContratistaId, setEditingContratistaId] = useState<string | null>(null);
  const [editingContratistaNombre, setEditingContratistaNombre] = useState('');
  const [editingContratistaCedula, setEditingContratistaCedula] = useState('');
  const [deletingContratistaId, setDeletingContratistaId] = useState<string | null>(null);

  const [encargadosAdmin, setEncargadosAdmin] = useState<
    { id: string; projectId: string; cedula: string; nombre: string; isActive: boolean }[]
  >([]);
  const [encargadosNewCedula, setEncargadosNewCedula] = useState('');
  const [encargadosNewNombre, setEncargadosNewNombre] = useState('');
  const [encargadosSaving, setEncargadosSaving] = useState(false);
  const [encargadosError, setEncargadosError] = useState<string | null>(null);
  const [editingEncargadoId, setEditingEncargadoId] = useState<string | null>(null);
  const [editingEncargadoNombre, setEditingEncargadoNombre] = useState('');
  const [editingEncargadoCedula, setEditingEncargadoCedula] = useState('');
  const [deletingEncargadoId, setDeletingEncargadoId] = useState<string | null>(null);

  const [cargosAdmin, setCargosAdmin] = useState<
    { id: string; nombre: string; consecutivo?: number | null; isActive?: boolean; projectId?: string }[]
  >([]);
  const [cargosNewNombre, setCargosNewNombre] = useState('');
  const [cargosSaving, setCargosSaving] = useState(false);
  const [cargosError, setCargosError] = useState<string | null>(null);
  const [editingCargoId, setEditingCargoId] = useState<string | null>(null);
  const [editingCargoNombre, setEditingCargoNombre] = useState('');
  const [deletingCargoId, setDeletingCargoId] = useState<string | null>(null);
  const [proveedoresAdmin, setProveedoresAdmin] = useState<ProveedorCatalogAdmin[]>([]);
  const [proveedoresFilterProjectId, setProveedoresFilterProjectId] = useState('');
  const [proveedoresNewForm, setProveedoresNewForm] = useState(emptyProveedorForm);
  const [proveedoresSaving, setProveedoresSaving] = useState(false);
  const [proveedoresError, setProveedoresError] = useState<string | null>(null);
  const [editingProveedorId, setEditingProveedorId] = useState<string | null>(null);
  const [editingProveedorForm, setEditingProveedorForm] = useState(emptyProveedorForm);
  const [deletingProveedorId, setDeletingProveedorId] = useState<string | null>(null);
  const [itemsBudgetChapters, setItemsBudgetChapters] = useState<BudgetChapterTree[]>([]);
  const [itemsTargetSubchapterId, setItemsTargetSubchapterId] = useState('');
  const [budgetChapterCodigo, setBudgetChapterCodigo] = useState('');
  const [budgetChapterNombre, setBudgetChapterNombre] = useState('');
  const [budgetSubchapterChapterId, setBudgetSubchapterChapterId] = useState('');
  const [budgetSubchapterNombre, setBudgetSubchapterNombre] = useState('');
  const [itemsFilterProjectId, setItemsFilterProjectId] = useState('');
  const [itemProveedorOptions, setItemProveedorOptions] = useState<ProveedorCatalogAdmin[]>([]);
  const [itemsSaving, setItemsSaving] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [editingBudgetChapterId, setEditingBudgetChapterId] = useState<string | null>(null);
  const [editingBudgetChapterForm, setEditingBudgetChapterForm] = useState({
    codigo: '',
    nombre: '',
    orden: 0,
    isActive: true,
  });
  const [editingBudgetSubchapterId, setEditingBudgetSubchapterId] = useState<string | null>(null);
  const [editingBudgetSubchapterForm, setEditingBudgetSubchapterForm] = useState({
    chapterId: '',
    nombre: '',
    orden: 0,
    isActive: true,
  });
  const [itemNewDescripcion, setItemNewDescripcion] = useState('');
  const [itemNewUnidad, setItemNewUnidad] = useState('');
  const [itemNewPrecio, setItemNewPrecio] = useState('');
  const [itemNewCantidad, setItemNewCantidad] = useState('');
  const [itemNewLargo, setItemNewLargo] = useState('');
  const [itemNewAncho, setItemNewAncho] = useState('');
  const [itemNewAltura, setItemNewAltura] = useState('');
  const [itemNewImagenUrl, setItemNewImagenUrl] = useState('');
  const [itemNewFotoGeo, setItemNewFotoGeo] = useState<FotoGeoFields>(emptyFotoGeoFields);
  const [itemNewProveedorId, setItemNewProveedorId] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemForm, setEditingItemForm] = useState({
    codigo: '',
    descripcion: '',
    unidad: '',
    precioUnitario: '',
    cantidad: '',
    largo: '',
    ancho: '',
    altura: '',
    imagenUrl: '',
    ...emptyFotoGeoFields(),
    proveedorId: '',
    isActive: true,
    subchapterId: '',
  });
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const itemsAdminFlat = useMemo(() => flattenItemCatalogTree(itemsBudgetChapters), [itemsBudgetChapters]);
  const budgetSubchaptersFlat = useMemo(() => flattenBudgetSubchapters(itemsBudgetChapters), [itemsBudgetChapters]);

  const subchapterPickerOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [];
    for (const ch of itemsBudgetChapters) {
      for (const sub of ch.subchapters) {
        opts.push({ id: sub.id, label: `${ch.codigo} · ${ch.nombre} › ${sub.nombre}` });
      }
    }
    return opts;
  }, [itemsBudgetChapters]);

  const [frentesObraObrasOptions, setFrentesObraObrasOptions] = useState<
    { id: string; code: string; name: string }[]
  >([]);
  const [frentesObraFilterProjectId, setFrentesObraFilterProjectId] = useState('');
  const [frentesObraAdmin, setFrentesObraAdmin] = useState<
    {
      id: string;
      nombre: string;
      orden: number;
      isActive: boolean;
      projectId: string;
      project: { code: string; name: string };
    }[]
  >([]);
  const [frentesObraNewNombre, setFrentesObraNewNombre] = useState('');
  const [frentesObraNewOrden, setFrentesObraNewOrden] = useState(0);
  const [frentesObraSaving, setFrentesObraSaving] = useState(false);
  const [frentesObraError, setFrentesObraError] = useState<string | null>(null);
  const [frentesObraMessage, setFrentesObraMessage] = useState<string | null>(null);
  const [editingFrenteObraId, setEditingFrenteObraId] = useState<string | null>(null);
  const [editingFrenteObraForm, setEditingFrenteObraForm] = useState({
    nombre: '',
    orden: 0,
    isActive: true,
  });
  const [deletingFrenteObraId, setDeletingFrenteObraId] = useState<string | null>(null);

  const [catalogosPorObraObrasOptions, setCatalogosPorObraObrasOptions] = useState<
    { id: string; code: string; name: string }[]
  >([]);
  const [contratistasFilterProjectId, setContratistasFilterProjectId] = useState('');
  const [encargadosFilterProjectId, setEncargadosFilterProjectId] = useState('');
  const [cargosFilterProjectId, setCargosFilterProjectId] = useState('');

  const [jornadasAdmin, setJornadasAdmin] = useState<
    { id: string; nombre: string; horaInicio: string; horaFin: string; orden: number; isActive: boolean }[]
  >([]);
  const [jornadaNew, setJornadaNew] = useState({ nombre: '', horaInicio: '06:00', horaFin: '18:00', orden: 0 });
  const [jornadasAdminSaving, setJornadasAdminSaving] = useState(false);
  const [jornadasAdminError, setJornadasAdminError] = useState<string | null>(null);
  const [jornadasAdminMessage, setJornadasAdminMessage] = useState<string | null>(null);
  const [editingJornadaId, setEditingJornadaId] = useState<string | null>(null);
  const [editingJornadaForm, setEditingJornadaForm] = useState({
    nombre: '',
    horaInicio: '',
    horaFin: '',
    orden: 0,
    isActive: true,
  });

  const [selectedObraId, setSelectedObraIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return sessionStorage.getItem('sigocc_selectedObraId') ?? '';
    } catch {
      return '';
    }
  });
  const setSelectedObraId = (id: string) => {
    setSelectedObraIdState(id);
    try {
      if (id) sessionStorage.setItem('sigocc_selectedObraId', id);
      else sessionStorage.removeItem('sigocc_selectedObraId');
    } catch {
      // ignore
    }
  };

  const [jornadasCatalog, setJornadasCatalog] = useState<
    { id: string; nombre: string; horaInicio: string; horaFin: string; orden: number }[]
  >([]);
  const [loadingJornadasCatalog, setLoadingJornadasCatalog] = useState(false);
  const [selectedJornadaId, setSelectedJornadaIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      return sessionStorage.getItem('sigocc_selectedJornadaId') ?? '';
    } catch {
      return '';
    }
  });
  const setSelectedJornadaId = (id: string) => {
    setSelectedJornadaIdState(id);
    try {
      if (id) sessionStorage.setItem('sigocc_selectedJornadaId', id);
      else sessionStorage.removeItem('sigocc_selectedJornadaId');
    } catch {
      // ignore
    }
  };

  const jornadaQuery =
    selectedJornadaId !== '' ? `&jornadaId=${encodeURIComponent(selectedJornadaId)}` : '';

  const [datosGeneralesForm, setDatosGeneralesForm] = useState({
    informeNo: '',
    fechaReporte: '',
    centroTrabajo: '',
    frenteObra: '',
    frenteObraCatalogoId: '',
    contratista: '',
    contratistaCatalogoId: '',
    encargadoReporte: '',
    encargadoReporteCatalogoId: '',
    cargo: '',
    cargoCatalogoId: '',
    horaEntrada: '',
    horaSalida: '',
  });
  const [suspensionesRows, setSuspensionesRows] = useState<SuspensionRow[]>([]);
  const [suspensionDraft, setSuspensionDraft] = useState({
    motivoSuspension: '',
    horaSuspension: '',
    horaReinicio: '',
    tipoClima: '',
    imagenUrl: '',
    ...emptyFotoGeoFields(),
  });
  const [editingSuspensionId, setEditingSuspensionId] = useState<string | null>(null);
  const [editSuspensionDraft, setEditSuspensionDraft] = useState({
    motivoSuspension: '',
    horaSuspension: '',
    horaReinicio: '',
    tipoClima: '',
    imagenUrl: '',
    ...emptyFotoGeoFields(),
  });
  const horasDraftCalculadas = useMemo(
    () => horasEntreTiemposHHmm(suspensionDraft.horaSuspension, suspensionDraft.horaReinicio),
    [suspensionDraft.horaSuspension, suspensionDraft.horaReinicio],
  );
  const horasEditCalculadas = useMemo(
    () => horasEntreTiemposHHmm(editSuspensionDraft.horaSuspension, editSuspensionDraft.horaReinicio),
    [editSuspensionDraft.horaSuspension, editSuspensionDraft.horaReinicio],
  );
  const [loadingSuspensiones, setLoadingSuspensiones] = useState(false);
  const [savingSuspension, setSavingSuspension] = useState(false);
  const [jornadaMessage, setJornadaMessage] = useState<string | null>(null);
  const [jornadaError, setJornadaError] = useState<string | null>(null);
  const [jornadaRangoAlert, setJornadaRangoAlert] = useState<string | null>(null);
  useEffect(() => {
    if (!jornadaRangoAlert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setJornadaRangoAlert(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [jornadaRangoAlert]);
  const [personalRows, setPersonalRows] = useState<
    Array<{
      id?: string;
      nombre: string;
      cargo: string;
      subcontratista: string;
      horaEntrada: string;
      horaSalida: string;
    }>
  >([]);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalMessage, setPersonalMessage] = useState<string | null>(null);
  const [personalError, setPersonalError] = useState<string | null>(null);
  const [personalDraft, setPersonalDraft] = useState(emptyPersonalDraft);
  const [personalEditingIndex, setPersonalEditingIndex] = useState<number | null>(null);
  const [equiposTab, setEquiposTab] = useState<'maquinaria' | 'ingreso' | 'entregado'>('maquinaria');
  const [equiposRows, setEquiposRows] = useState<
    Array<{
      id?: string;
      descripcion: string;
      placaRef: string;
      propiedad: string;
      estado: string;
      observacion: string;
      imagenUrl: string;
      imagenLatitud?: number | null;
      imagenLongitud?: number | null;
      imagenPrecision?: number | null;
      imagenGeoEstado?: string | null;
      imagenTomadaEn?: string | null;
      horaIngreso: string;
      horaSalida: string;
      horasTrabajadas: number;
      horarios: EquipoHorarioDraft[];
    }>
  >([]);
  const [loadingEquipos, setLoadingEquipos] = useState(false);
  const [savingEquipos, setSavingEquipos] = useState(false);
  const [equiposMessage, setEquiposMessage] = useState<string | null>(null);
  const [equiposError, setEquiposError] = useState<string | null>(null);
  const [equipoDraft, setEquipoDraft] = useState(emptyEquipoDraft);
  const [equipoEditingIndex, setEquipoEditingIndex] = useState<number | null>(null);
  const [ingresoDraft, setIngresoDraft] = useState(emptyIngresoDraft);
  const [ingresoEditingIndex, setIngresoEditingIndex] = useState<number | null>(null);
  const [entregaDraft, setEntregaDraft] = useState(emptyEntregaDraft);
  const [entregaEditingIndex, setEntregaEditingIndex] = useState<number | null>(null);
  const [savingInforme, setSavingInforme] = useState(false);
  const [informeMessage, setInformeMessage] = useState<string | null>(null);
  const [informeError, setInformeError] = useState<string | null>(null);
  const informeDropdownRef = useRef<HTMLDivElement>(null);
  const speechRecognitionRef = useRef<{ abort: () => void } | null>(null);

  const evidenciaFileInputRefs = useRef<Record<EvidenciaFase, HTMLInputElement | null>>({
    antes: null,
    durante: null,
    despues: null,
  });

  const [ingresoRows, setIngresoRows] = useState<
    Array<{
      id?: string;
      proveedor: string;
      tipoMaterial: string;
      noRemision: string;
      unidad: string;
      cantidad: number;
      observacion: string;
      imagenUrl: string;
      imagenLatitud?: number | null;
      imagenLongitud?: number | null;
      imagenPrecision?: number | null;
      imagenGeoEstado?: string | null;
      imagenTomadaEn?: string | null;
    }>
  >([]);
  const [loadingIngreso, setLoadingIngreso] = useState(false);
  const [savingIngreso, setSavingIngreso] = useState(false);
  const [ingresoMessage, setIngresoMessage] = useState<string | null>(null);
  const [ingresoError, setIngresoError] = useState<string | null>(null);

  const [entregaRows, setEntregaRows] = useState<
    Array<{
      id?: string;
      tipoMaterial: string;
      unidad: string;
      cantidad: number;
      contratista: string;
      firmaRecibido: boolean;
      observacion: string;
      imagenUrl: string;
      imagenLatitud?: number | null;
      imagenLongitud?: number | null;
      imagenPrecision?: number | null;
      imagenGeoEstado?: string | null;
      imagenTomadaEn?: string | null;
    }>
  >([]);
  const [loadingEntrega, setLoadingEntrega] = useState(false);
  const [savingEntrega, setSavingEntrega] = useState(false);
  const [entregaMessage, setEntregaMessage] = useState<string | null>(null);
  const [entregaError, setEntregaError] = useState<string | null>(null);

  const [actividadRows, setActividadRows] = useState<
    Array<{
      id?: string;
      pk: string;
      abscisado: string;
      itemContractual: string;
      descripcion: string;
      unidadMedida: string;
      observacion: string;
      imagenUrl?: string | null;
      imagenLatitud?: number | null;
      imagenLongitud?: number | null;
      imagenPrecision?: number | null;
      imagenGeoEstado?: string | null;
      imagenTomadaEn?: string | null;
      largo: number;
      ancho: number;
      altura: number;
      cantidadTotal: number;
    }>
  >([]);
  const [loadingActividad, setLoadingActividad] = useState(false);
  const [savingActividad, setSavingActividad] = useState(false);
  const [actividadMessage, setActividadMessage] = useState<string | null>(null);
  const [actividadError, setActividadError] = useState<string | null>(null);
  const [actividadDraft, setActividadDraft] = useState(emptyActividadDraft);
  const [actividadEditingIndex, setActividadEditingIndex] = useState<number | null>(null);
  const [actividadDetalleModalIndex, setActividadDetalleModalIndex] = useState<number | null>(null);

  const [calidadTab, setCalidadTab] = useState<'ensayos' | 'danos' | 'noConformidades'>('ensayos');
  const [ensayosRows, setEnsayosRows] = useState<
    Array<{
      id?: string;
      materialActividad: string;
      tipoEnsayo: string;
      idMuestra: string;
      laboratorio: string;
      localizacion: string;
      resultado: string;
      observacion: string;
      imagenUrl?: string | null;
      imagenLatitud?: number | null;
      imagenLongitud?: number | null;
      imagenPrecision?: number | null;
      imagenGeoEstado?: string | null;
      imagenTomadaEn?: string | null;
    }>
  >([]);
  const [loadingEnsayos, setLoadingEnsayos] = useState(false);
  const [savingEnsayos, setSavingEnsayos] = useState(false);
  const [ensayosMessage, setEnsayosMessage] = useState<string | null>(null);
  const [ensayosError, setEnsayosError] = useState<string | null>(null);
  const [ensayoDraft, setEnsayoDraft] = useState(emptyEnsayoDraft);

  const [danosRows, setDanosRows] = useState<
    Array<{
      id?: string;
      horaReporte: string;
      direccion: string;
      tipoDano: string;
      entidad: string;
      noReporte: string;
      observacion: string;
      imagenUrl?: string | null;
      imagenLatitud?: number | null;
      imagenLongitud?: number | null;
      imagenPrecision?: number | null;
      imagenGeoEstado?: string | null;
      imagenTomadaEn?: string | null;
    }>
  >([]);
  const [loadingDanos, setLoadingDanos] = useState(false);
  const [savingDanos, setSavingDanos] = useState(false);
  const [danosMessage, setDanosMessage] = useState<string | null>(null);
  const [danosError, setDanosError] = useState<string | null>(null);
  const [danoDraft, setDanoDraft] = useState(emptyDanoDraft);

  const [noConformidadesRows, setNoConformidadesRows] = useState<
    Array<{
      id?: string;
      noConformidad: string;
      detalle: string;
      estado: string;
      imagenUrl?: string | null;
      imagenLatitud?: number | null;
      imagenLongitud?: number | null;
      imagenPrecision?: number | null;
      imagenGeoEstado?: string | null;
      imagenTomadaEn?: string | null;
    }>
  >([]);
  const [loadingNoConformidades, setLoadingNoConformidades] = useState(false);
  const [savingNoConformidades, setSavingNoConformidades] = useState(false);
  const [noConformidadesMessage, setNoConformidadesMessage] = useState<string | null>(null);
  const [noConformidadesError, setNoConformidadesError] = useState<string | null>(null);
  const [noConformidadDraft, setNoConformidadDraft] = useState(emptyNoConformidadDraft);

  // Evidencias y cierre
  const [registroFotografico, setRegistroFotografico] = useState(false);
  const [evidenciaUrlsPorFase, setEvidenciaUrlsPorFase] = useState(emptyEvidenciaUrlsPorFase);
  const [evidenciaCarouselIndex, setEvidenciaCarouselIndex] = useState<Record<EvidenciaFase, number>>({
    antes: 0,
    durante: 0,
    despues: 0,
  });
  const [observacionesGenerales, setObservacionesGenerales] = useState('');
  const [firmasEvidencias, setFirmasEvidencias] = useState<Record<FirmaEvidenciaKey, FirmaEvidenciaState>>({
    responsableDiligenciamiento: emptyFirmaEvidencia(),
    residenteObra: emptyFirmaEvidencia(),
    auxiliarIngenieria: emptyFirmaEvidencia(),
    vistoBuenoDirectorObra: emptyFirmaEvidencia(),
  });

  const [loadingEvidencias, setLoadingEvidencias] = useState(false);
  const [savingEvidencias, setSavingEvidencias] = useState(false);
  const [evidenciasMessage, setEvidenciasMessage] = useState<string | null>(null);
  const [evidenciasError, setEvidenciasError] = useState<string | null>(null);
  const [tabulacionExportError, setTabulacionExportError] = useState<string | null>(null);
  const [tabulacionExporting, setTabulacionExporting] = useState(false);
  const [uploadingEvidencia, setUploadingEvidencia] = useState(false);
  const [registroFotoPreviewUrl, setRegistroFotoPreviewUrl] = useState<string | null>(null);
  const [mediaPermissionState, setMediaPermissionState] = useState<{
    camera: string;
    geolocation: string;
  }>({ camera: 'pending', geolocation: 'pending' });
  const [firmaToken, setFirmaToken] = useState<string | null>(null);
  const [firmaTokenCopiado, setFirmaTokenCopiado] = useState(false);
  const [informeCerrado, setInformeCerrado] = useState(false);
  const [cerradoEn, setCerradoEn] = useState<string | null>(null);
  const [firmaSlotPermissions, setFirmaSlotPermissions] = useState<Record<FirmaEvidenciaKey, boolean> | null>(null);

  useEffect(() => {
    // Evitar validación automática de sesión para no disparar 401 en consola ni cierres forzados.
    setFirmaToken(null);
    setFirmaSlotPermissions({
      responsableDiligenciamiento: false,
      residenteObra: false,
      auxiliarIngenieria: false,
      vistoBuenoDirectorObra: false,
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const standaloneByMedia = window.matchMedia('(display-mode: standalone)').matches;
    const standaloneByIOS = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    const ua = window.navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isEdge = /edg\//.test(ua);
    const isChrome = /chrome/.test(ua) && !isEdge;
    const shouldShowInstallCta = isAndroid || isIOS || isChrome || isEdge;
    setCanShowInstallCta(shouldShowInstallCta);
    if (standaloneByMedia || standaloneByIOS) {
      setIsAppInstalled(true);
      setInstallPrompt(null);
      setInstallAvailable(false);
    }

    navigator.serviceWorker.register('/sw.js').catch(() => {});

    const handleBeforeInstallPrompt = (event: Event) => {
      const deferredEvent = event as BeforeInstallPromptEvent;
      deferredEvent.preventDefault();
      if (isAppInstalled) return;
      setInstallPrompt(deferredEvent);
      setInstallAvailable(true);
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setInstallPrompt(null);
      setInstallAvailable(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isAppInstalled]);

  const canSee = (menuKey: string) => allowedMenus.length === 0 || allowedMenus.includes(menuKey);

  useEffect(() => {
    if (activeSection === 'users' && usersSubSection === 'roles') {
      setLoadingPermissions(true);
      setPermissionsError(null);
      fetch('/api/admin/roles/permissions', { credentials: 'include' })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(typeof data?.error === 'string' ? data.error : 'Error al cargar permisos');
          }
          return data as {
            roles?: { role: string; label?: string; menuKeys: string[]; firmaPermKeys?: string[] }[];
            menuKeys?: string[];
          };
        })
        .then((data) => {
          setRolePermissions(
            (data.roles ?? []).map((r) => ({
              ...r,
              menuKeys: r.menuKeys ?? [],
              firmaPermKeys: r.firmaPermKeys ?? [],
            })),
          );
          setPermissionMenuKeys(data.menuKeys ?? [...MENU_KEYS]);
        })
        .catch((err: unknown) => {
          setPermissionsError(err instanceof Error ? err.message : 'No se pudieron cargar los permisos.');
          setRolePermissions([]);
          setPermissionMenuKeys([...MENU_KEYS]);
        })
        .finally(() => setLoadingPermissions(false));
    }
  }, [activeSection, usersSubSection]);

  useEffect(() => {
    if (activeSection === 'users') {
      fetch('/api/admin/roles', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data: { roles?: { role: string; label: string }[] }) =>
          setAvailableRoles(data.roles ?? []),
        )
        .catch(() => setAvailableRoles([]));
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'settings' && settingsSubSection === 'obras') {
      setLoadingObras(true);
      fetch('/api/admin/obras', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then(
          (data: {
            obras?: {
              id: string;
              consecutivo: number | null;
              name: string;
              code: string;
              startDate: string | null;
              endDate: string | null;
              evidenciasOnedriveShareUrl: string | null;
              evidenciasGoogleDriveFolderId: string | null;
              isActive: boolean;
            }[];
          }) => setObrasList(data.obras ?? []),
        )
        .catch(() => setObrasList([]))
        .finally(() => setLoadingObras(false));
    }
  }, [activeSection, settingsSubSection, selectedObraId]);

  useEffect(() => {
    if (activeSection !== 'settings') return;

    const load = async () => {
      if (settingsSubSection === 'contratistas') {
        setContratistasError(null);
        try {
          if (!contratistasFilterProjectId) {
            setContratistasAdmin([]);
            return;
          }
          const res = await fetch(
            `/api/admin/catalogos/contratistas?projectId=${encodeURIComponent(contratistasFilterProjectId)}`,
            { credentials: 'include' },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error ?? 'Error');
          setContratistasAdmin(Array.isArray(data.items) ? data.items : []);
        } catch (e) {
          setContratistasAdmin([]);
          setContratistasError('Error al cargar contratistas.');
        }
        return;
      }

      if (settingsSubSection === 'encargados') {
        setEncargadosError(null);
        try {
          if (!encargadosFilterProjectId) {
            setEncargadosAdmin([]);
            return;
          }
          const res = await fetch(
            `/api/admin/catalogos/encargados?projectId=${encodeURIComponent(encargadosFilterProjectId)}`,
            { credentials: 'include' },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error ?? 'Error');
          setEncargadosAdmin(Array.isArray(data.items) ? data.items : []);
        } catch {
          setEncargadosAdmin([]);
          setEncargadosError('Error al cargar encargados.');
        }
        return;
      }

      if (settingsSubSection === 'jornadas') {
        setJornadasAdminError(null);
        try {
          const res = await fetch('/api/admin/catalogos/jornadas', { credentials: 'include' });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error ?? 'Error');
          setJornadasAdmin(Array.isArray(data.items) ? data.items : []);
        } catch {
          setJornadasAdmin([]);
          setJornadasAdminError('Error al cargar jornadas.');
        }
      }

      if (settingsSubSection === 'proveedores') {
        setProveedoresError(null);
        try {
          if (!proveedoresFilterProjectId) {
            setProveedoresAdmin([]);
            return;
          }
          const res = await fetch(
            `/api/admin/catalogos/proveedores?projectId=${encodeURIComponent(proveedoresFilterProjectId)}`,
            { credentials: 'include' },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error ?? 'Error');
          setProveedoresAdmin(Array.isArray(data.items) ? (data.items as ProveedorCatalogAdmin[]) : []);
        } catch {
          setProveedoresAdmin([]);
          setProveedoresError('Error al cargar proveedores.');
        }
        return;
      }

      if (settingsSubSection === 'items' || settingsSubSection === 'estructuraItems') {
        setItemsError(null);
        try {
          if (!itemsFilterProjectId) {
            setItemsBudgetChapters([]);
            setItemsTargetSubchapterId('');
            setItemProveedorOptions([]);
            return;
          }
          const res = await fetch(
            `/api/admin/catalogos/items-tree?projectId=${encodeURIComponent(itemsFilterProjectId)}`,
            { credentials: 'include' },
          );
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error ?? 'Error');
          const chapters = Array.isArray(data.chapters) ? (data.chapters as BudgetChapterTree[]) : [];
          setItemsBudgetChapters(chapters);
          const subIds = new Set<string>();
          for (const ch of chapters) {
            for (const s of ch.subchapters) subIds.add(s.id);
          }
          setItemsTargetSubchapterId((prev) => {
            if (prev && subIds.has(prev)) return prev;
            return chapters[0]?.subchapters?.[0]?.id ?? '';
          });
          setBudgetSubchapterChapterId((prev) => {
            if (prev && chapters.some((c) => c.id === prev)) return prev;
            return chapters[0]?.id ?? '';
          });
          if (settingsSubSection === 'items') {
            const proveedoresRes = await fetch(
              `/api/admin/catalogos/proveedores?projectId=${encodeURIComponent(itemsFilterProjectId)}`,
              { credentials: 'include' },
            );
            const proveedoresData = await proveedoresRes.json();
            if (!proveedoresRes.ok) throw new Error(proveedoresData?.error ?? 'Error');
            const proveedores = Array.isArray(proveedoresData.items)
              ? (proveedoresData.items as ProveedorCatalogAdmin[])
              : [];
            setItemProveedorOptions(proveedores.filter((p) => p.isActive));
            setItemNewProveedorId((prev) => {
              if (prev && proveedores.some((p) => p.id === prev && p.isActive)) return prev;
              return proveedores.find((p) => p.isActive)?.id ?? '';
            });
          }
        } catch (e) {
          setItemsBudgetChapters([]);
          setItemsTargetSubchapterId('');
          setItemProveedorOptions([]);
          const fallback = 'Error al cargar estructura de presupuesto (ítems).';
          const msg = e instanceof Error ? e.message.trim() : '';
          setItemsError(msg && msg !== 'Error' ? msg : fallback);
        }
      }
    };

    load();
  }, [
    activeSection,
    settingsSubSection,
    contratistasFilterProjectId,
    encargadosFilterProjectId,
    proveedoresFilterProjectId,
    itemsFilterProjectId,
  ]);

  useEffect(() => {
    if (activeSection !== 'settings' || settingsSubSection !== 'cargos') return;
    if (!cargosFilterProjectId) {
      setCargosAdmin([]);
      setCargosError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setCargosError(null);
      try {
        const res = await fetch(
          `/api/admin/catalogos/cargos?projectId=${encodeURIComponent(cargosFilterProjectId)}`,
          { credentials: 'include' },
        );
        const text = await res.text();
        let data: { items?: unknown; error?: string } = {};
        try {
          data = text ? (JSON.parse(text) as { items?: unknown; error?: string }) : {};
        } catch {
          if (!cancelled) {
            setCargosAdmin([]);
            setCargosError(
              res.ok ? 'Respuesta inválida del servidor al cargar cargos.' : `Error ${res.status}: ${text.slice(0, 180)}`,
            );
          }
          return;
        }
        if (cancelled) return;
        if (!res.ok) {
          setCargosAdmin([]);
          setCargosError(data.error ?? `No se pudieron cargar los cargos (${res.status}). Sincronice la base con: npx prisma db push`);
          return;
        }
        setCargosAdmin(
          Array.isArray(data.items)
            ? (data.items as { id: string; nombre: string; consecutivo?: number | null }[])
            : [],
        );
      } catch (e) {
        if (!cancelled) {
          setCargosAdmin([]);
          setCargosError(e instanceof Error ? e.message : 'Error al cargar cargos.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSection, settingsSubSection, cargosFilterProjectId]);

  useEffect(() => {
    if (activeSection !== 'settings') return;
    if (
      settingsSubSection !== 'contratistas' &&
      settingsSubSection !== 'encargados' &&
      settingsSubSection !== 'cargos' &&
      settingsSubSection !== 'proveedores' &&
      settingsSubSection !== 'estructuraItems' &&
      settingsSubSection !== 'items'
    )
      return;
    let cancelled = false;
    (async () => {
      try {
        const or = await fetch('/api/admin/obras', { credentials: 'include' });
        const od = await or.json();
        if (!or.ok) throw new Error(od.error ?? 'Error');
        const obr = ((od.obras ?? []) as { id: string; name: string; code: string }[]).map((o) => ({
          id: o.id,
          code: o.code,
          name: o.name,
        }));
        if (cancelled) return;
        setCatalogosPorObraObrasOptions(obr);
        const syncFilter = (setter: Dispatch<SetStateAction<string>>) => {
          setter((prev) => {
            if (prev && obr.some((x) => x.id === prev)) return prev;
            return obr[0]?.id ?? '';
          });
        };
        if (settingsSubSection === 'contratistas') syncFilter(setContratistasFilterProjectId);
        else if (settingsSubSection === 'encargados') syncFilter(setEncargadosFilterProjectId);
        else if (settingsSubSection === 'cargos') syncFilter(setCargosFilterProjectId);
        else if (settingsSubSection === 'proveedores') syncFilter(setProveedoresFilterProjectId);
        else syncFilter(setItemsFilterProjectId);
      } catch {
        if (!cancelled) {
          setCatalogosPorObraObrasOptions([]);
          if (settingsSubSection === 'contratistas') {
            setContratistasFilterProjectId('');
            setContratistasError('Error al cargar obras.');
          } else if (settingsSubSection === 'encargados') {
            setEncargadosFilterProjectId('');
            setEncargadosError('Error al cargar obras.');
          } else if (settingsSubSection === 'cargos') {
            setCargosFilterProjectId('');
            setCargosError('Error al cargar obras.');
          } else if (settingsSubSection === 'proveedores') {
            setProveedoresFilterProjectId('');
            setProveedoresError('Error al cargar obras.');
          } else {
            setItemsFilterProjectId('');
            setItemsError('Error al cargar obras.');
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSection, settingsSubSection]);

  useEffect(() => {
    if (activeSection !== 'settings' || settingsSubSection !== 'frentesObra') return;
    let cancelled = false;
    setFrentesObraError(null);
    (async () => {
      try {
        const or = await fetch('/api/admin/obras', { credentials: 'include' });
        const od = await or.json();
        if (!or.ok) throw new Error(od.error ?? 'Error');
        const obr = ((od.obras ?? []) as { id: string; name: string; code: string }[]).map((o) => ({
          id: o.id,
          code: o.code,
          name: o.name,
        }));
        if (cancelled) return;
        setFrentesObraObrasOptions(obr);
        setFrentesObraFilterProjectId((prev) => {
          if (prev && obr.some((x) => x.id === prev)) return prev;
          return obr[0]?.id ?? '';
        });
      } catch {
        if (!cancelled) {
          setFrentesObraObrasOptions([]);
          setFrentesObraError('Error al cargar obras.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSection, settingsSubSection]);

  useEffect(() => {
    if (activeSection !== 'settings' || settingsSubSection !== 'frentesObra') return;
    if (!frentesObraFilterProjectId) {
      setFrentesObraAdmin([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/catalogos/frentes-obra?projectId=${encodeURIComponent(frentesObraFilterProjectId)}`,
          { credentials: 'include' },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Error');
        if (!cancelled) setFrentesObraAdmin(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (!cancelled) {
          setFrentesObraAdmin([]);
          setFrentesObraError('Error al cargar frentes de obra.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSection, settingsSubSection, frentesObraFilterProjectId]);

  useEffect(() => {
    if (
      activeSection === 'datos' ||
      activeSection === 'jornada' ||
      activeSection === 'personal' ||
      activeSection === 'equipos' ||
      activeSection === 'actividades' ||
      activeSection === 'calidad' ||
      activeSection === 'evidencias' ||
      activeSection === 'tabulacion'
    ) {
      setLoadingObrasForInforme(true);
      (async () => {
        try {
          const res = await fetch('/api/obras', { credentials: 'include' });
          if (res.ok) {
            const data = (await res.json()) as { obras?: { id: string; name: string; code: string }[] };
            const list = Array.isArray(data.obras) ? data.obras : [];
            setObrasForInforme(list);
            setSelectedObraIdState((current) => {
              if (!current) return current;
              const exists = list.some((o) => o.id === current);
              if (!exists) {
                try {
                  sessionStorage.removeItem('sigocc_selectedObraId');
                } catch {
                  // ignore
                }
                return '';
              }
              return current;
            });
            return;
          }

          // Fallback para cuentas SUPER_ADMIN si /api/obras falla por permisos/cookie.
          const fallback = await fetch('/api/admin/obras', { credentials: 'include' });
          if (!fallback.ok) throw new Error('No se pudieron cargar obras');
          const fd = (await fallback.json()) as {
            obras?: { id: string; name: string; code: string; isActive?: boolean }[];
          };
          const list = (Array.isArray(fd.obras) ? fd.obras : [])
            .filter((o) => o.isActive !== false)
            .map((o) => ({ id: o.id, name: o.name, code: o.code }));
          setObrasForInforme(list);
          setSelectedObraIdState((current) => {
            if (!current) return current;
            const exists = list.some((o) => o.id === current);
            if (!exists) {
              try {
                sessionStorage.removeItem('sigocc_selectedObraId');
              } catch {
                // ignore
              }
              return '';
            }
            return current;
          });
        } catch {
          setObrasForInforme([]);
        } finally {
          setLoadingObrasForInforme(false);
        }
      })();
    }
  }, [activeSection]);

  useEffect(() => {
    let cancelled = false;
    setLoadingJornadasCatalog(true);
    fetch('/api/catalogos/jornadas', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then(
        (data: {
          items?: { id: string; nombre: string; horaInicio: string; horaFin: string; orden: number }[];
        }) => {
          if (cancelled) return;
          const list = Array.isArray(data.items) ? data.items : [];
          setJornadasCatalog(list);
          setSelectedJornadaIdState((cur) => {
            if (cur && list.some((j) => j.id === cur)) return cur;
            const first = list[0]?.id;
            if (first) {
              try {
                sessionStorage.setItem('sigocc_selectedJornadaId', first);
              } catch {
                // ignore
              }
              return first;
            }
            return '';
          });
        },
      )
      .catch(() => {
        if (!cancelled) setJornadasCatalog([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingJornadasCatalog(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedObraId || !selectedJornadaId) {
      setInformeCerrado(false);
      setCerradoEn(null);
      return;
    }
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);
    const ac = new AbortController();
    fetch(
      `/api/informes/next?projectId=${encodeURIComponent(selectedObraId)}&date=${encodeURIComponent(date)}${jornadaQuery}`,
      { credentials: 'include', signal: ac.signal },
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { informeCerrado?: boolean; cerradoEn?: string | null }) => {
        setInformeCerrado(Boolean(data.informeCerrado));
        setCerradoEn(typeof data.cerradoEn === 'string' ? data.cerradoEn : null);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setInformeCerrado(false);
        setCerradoEn(null);
      });
    return () => ac.abort();
  }, [selectedObraId, selectedJornadaId, jornadaQuery, datosGeneralesForm.fechaReporte]);

  /** Cabecera del informe + jornada condiciones: misma clave obra+fecha+jornada en todas las pestañas del informe. */
  useEffect(() => {
    if (!isInformeSection || !selectedObraId || !selectedJornadaId) return;
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);
    const ac = new AbortController();
    fetch(
      `/api/informes/next?projectId=${encodeURIComponent(selectedObraId)}&date=${encodeURIComponent(date)}${jornadaQuery}`,
      { credentials: 'include', signal: ac.signal },
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { date?: string; informeNo?: string; centroTrabajo?: string; existing?: boolean; fields?: any }) => {
        if (activeSection === 'datos') {
          setDatosGeneralesForm((prev) => {
            const fechaReporte = prev.fechaReporte || data.date || prev.fechaReporte;
            const base = {
              ...prev,
              fechaReporte,
              informeNo: data.informeNo ?? '',
              centroTrabajo: data.centroTrabajo ?? '',
            };
            if (data.existing && data.fields) {
              return { ...base, ...data.fields };
            }
            return { ...base, ...DATOS_GENERALES_CAMPOS_VACIOS };
          });
        } else {
          setDatosGeneralesForm((prev) => ({
            ...prev,
            informeNo: data.informeNo ?? '',
            centroTrabajo: data.centroTrabajo ?? '',
          }));
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      });
    return () => ac.abort();
  }, [
    isInformeSection,
    activeSection,
    selectedObraId,
    selectedJornadaId,
    jornadaQuery,
    datosGeneralesForm.fechaReporte,
  ]);

  useEffect(() => {
    if (activeSection !== 'jornada' || !selectedObraId || !selectedJornadaId) {
      if (activeSection !== 'jornada') setSuspensionesRows([]);
      return;
    }
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);
    const ac = new AbortController();
    setLoadingSuspensiones(true);
    fetch(
      `/api/informes/suspensiones?projectId=${encodeURIComponent(selectedObraId)}&date=${encodeURIComponent(date)}&jornadaId=${encodeURIComponent(selectedJornadaId)}`,
      { credentials: 'include', signal: ac.signal },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: { items?: SuspensionRow[] }) => {
        setSuspensionesRows(Array.isArray(d.items) ? d.items : []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSuspensionesRows([]);
      })
      .finally(() => setLoadingSuspensiones(false));
    return () => ac.abort();
  }, [activeSection, selectedObraId, selectedJornadaId, datosGeneralesForm.fechaReporte]);

  useEffect(() => {
    if (!isInformeSection) return;
    if (!selectedObraId) {
      setContratistasOptions([]);
      setEncargadosOptions([]);
      setCargosOptions([]);
      setItemsCatalogOptions([]);
      return;
    }
    setLoadingCatalogos(true);
    Promise.all([
      fetch(`/api/catalogos/contratistas?projectId=${encodeURIComponent(selectedObraId)}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch(`/api/catalogos/encargados?projectId=${encodeURIComponent(selectedObraId)}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch(`/api/catalogos/cargos?projectId=${encodeURIComponent(selectedObraId)}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch(`/api/catalogos/items?projectId=${encodeURIComponent(selectedObraId)}`, { credentials: 'include' }).then((r) => (r.ok ? r.json() : Promise.reject(r))),
    ])
      .then(([cData, eData, carData, iData]: any[]) => {
        setContratistasOptions(Array.isArray(cData.items) ? cData.items : []);
        setEncargadosOptions(Array.isArray(eData.items) ? eData.items : []);
        setCargosOptions(Array.isArray(carData.items) ? carData.items : []);
        setItemsCatalogOptions(Array.isArray(iData.items) ? iData.items : []);
      })
      .catch(() => {
        setContratistasOptions([]);
        setEncargadosOptions([]);
        setCargosOptions([]);
        setItemsCatalogOptions([]);
      })
      .finally(() => setLoadingCatalogos(false));
  }, [isInformeSection, selectedObraId]);

  useEffect(() => {
    if (!datosGeneralesForm.contratista) return;
    if (contratistasOptions.some((x) => x.nombre === datosGeneralesForm.contratista)) return;
    setContratistasOptions((prev) => [
      { id: 'local', cedula: '', nombre: datosGeneralesForm.contratista },
      ...prev,
    ]);
  }, [datosGeneralesForm.contratista, contratistasOptions]);

  useEffect(() => {
    if (!datosGeneralesForm.encargadoReporte) return;
    if (encargadosOptions.some((x) => x.nombre === datosGeneralesForm.encargadoReporte)) return;
    setEncargadosOptions((prev) => [
      { id: 'local', cedula: '', nombre: datosGeneralesForm.encargadoReporte },
      ...prev,
    ]);
  }, [datosGeneralesForm.encargadoReporte, encargadosOptions]);

  useEffect(() => {
    if (!datosGeneralesForm.cargo) return;
    if (cargosOptions.some((x) => x.nombre === datosGeneralesForm.cargo)) return;
    setCargosOptions((prev) => [{ id: 'local', nombre: datosGeneralesForm.cargo }, ...prev]);
  }, [datosGeneralesForm.cargo, cargosOptions]);

  useEffect(() => {
    setDatosGeneralesForm((prev) => ({
      ...prev,
      frenteObra: '',
      frenteObraCatalogoId: '',
      contratista: '',
      contratistaCatalogoId: '',
      encargadoReporte: '',
      encargadoReporteCatalogoId: '',
      cargo: '',
      cargoCatalogoId: '',
    }));
  }, [selectedObraId]);

  useEffect(() => {
    if (!selectedObraId) {
      setFrentesObraOptions([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/catalogos/frentes-obra?projectId=${encodeURIComponent(selectedObraId)}`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { items?: { id: string; nombre: string }[] }) => {
        if (!cancelled) setFrentesObraOptions(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setFrentesObraOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedObraId]);

  useEffect(() => {
    const txt = (datosGeneralesForm.frenteObra ?? '').trim();
    if (!txt || (datosGeneralesForm.frenteObraCatalogoId ?? '').trim()) return;
    const hit = frentesObraOptions.find((o) => o.nombre === txt);
    if (!hit) return;
    setDatosGeneralesForm((f) => (f.frenteObraCatalogoId ? f : { ...f, frenteObraCatalogoId: hit.id }));
  }, [frentesObraOptions, datosGeneralesForm.frenteObra, datosGeneralesForm.frenteObraCatalogoId]);

  useEffect(() => {
    if (activeSection !== 'calidad' || !selectedObraId || !selectedJornadaId) return;
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);

    if (calidadTab === 'ensayos') {
      setLoadingEnsayos(true);
      fetch(
        `/api/informes/ensayos?projectId=${encodeURIComponent(selectedObraId)}&date=${encodeURIComponent(date)}${jornadaQuery}`,
        { credentials: 'include' },
      )
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data: { ensayos?: any[] }) => {
          const list = Array.isArray(data.ensayos) ? data.ensayos : [];
          if (list.length === 0) {
            setEnsayosRows([
              {
                materialActividad: '',
                tipoEnsayo: '',
                idMuestra: '',
                laboratorio: '',
                localizacion: '',
                resultado: '',
                observacion: '',
                imagenUrl: '',
                ...emptyFotoGeoFields(),
              },
            ]);
            return;
          }
          setEnsayosRows(
            list.map((e) => ({
              id: e.id,
              materialActividad: e.materialActividad ?? '',
              tipoEnsayo: e.tipoEnsayo ?? '',
              idMuestra: e.idMuestra ?? '',
              laboratorio: e.laboratorio ?? '',
              localizacion: e.localizacion ?? '',
              resultado: e.resultado ?? '',
              observacion: e.observacion ?? '',
              imagenUrl: e.imagenUrl ?? '',
              ...fotoGeoFromSource(e),
            })),
          );
        })
        .catch(() => setEnsayosRows([]))
        .finally(() => setLoadingEnsayos(false));
    }

    if (calidadTab === 'danos') {
      setLoadingDanos(true);
      fetch(
        `/api/informes/danos-redes?projectId=${encodeURIComponent(selectedObraId)}&date=${encodeURIComponent(date)}${jornadaQuery}`,
        { credentials: 'include' },
      )
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data: { danos?: any[] }) => {
          const list = Array.isArray(data.danos) ? data.danos : [];
          if (list.length === 0) {
            setDanosRows([
              {
                horaReporte: '',
                direccion: '',
                tipoDano: '',
                entidad: '',
                noReporte: '',
                observacion: '',
                imagenUrl: '',
                ...emptyFotoGeoFields(),
              },
            ]);
            return;
          }
          setDanosRows(
            list.map((d) => ({
              id: d.id,
              horaReporte: d.horaReporte ?? '',
              direccion: d.direccion ?? '',
              tipoDano: d.tipoDano ?? '',
              entidad: d.entidad ?? '',
              noReporte: d.noReporte ?? '',
              observacion: d.observacion ?? '',
              imagenUrl: d.imagenUrl ?? '',
              ...fotoGeoFromSource(d),
            })),
          );
        })
        .catch(() => setDanosRows([]))
        .finally(() => setLoadingDanos(false));
    }

    if (calidadTab === 'noConformidades') {
      setLoadingNoConformidades(true);
      fetch(
        `/api/informes/no-conformidades?projectId=${encodeURIComponent(selectedObraId)}&date=${encodeURIComponent(date)}${jornadaQuery}`,
        { credentials: 'include' },
      )
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data: { noConformidades?: any[] }) => {
          const list = Array.isArray(data.noConformidades) ? data.noConformidades : [];
          if (list.length === 0) {
            setNoConformidadesRows([
              {
                noConformidad: '',
                detalle: '',
                estado: '',
                imagenUrl: '',
                ...emptyFotoGeoFields(),
              },
            ]);
            return;
          }
          setNoConformidadesRows(
            list.map((n) => ({
              id: n.id,
              noConformidad: n.noConformidad ?? '',
              detalle: n.detalle ?? '',
              estado: n.estado ?? '',
              imagenUrl: n.imagenUrl ?? '',
              ...fotoGeoFromSource(n),
            })),
          );
        })
        .catch(() => setNoConformidadesRows([]))
        .finally(() => setLoadingNoConformidades(false));
    }
  }, [activeSection, selectedObraId, selectedJornadaId, jornadaQuery, datosGeneralesForm.fechaReporte, calidadTab]);

  useEffect(() => {
    if (activeSection !== 'evidencias' || !selectedObraId || !selectedJornadaId) return;
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);

    setLoadingEvidencias(true);
    fetch(
      `/api/informes/evidencias?projectId=${encodeURIComponent(selectedObraId)}&date=${encodeURIComponent(date)}${jornadaQuery}`,
      { credentials: 'include' },
    )
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: any) => {
        setRegistroFotografico(Boolean(data.registroFotografico));
        setEvidenciaUrlsPorFase(normalizeEvidenciasBody(data.evidenciaUrls));
        setEvidenciaCarouselIndex({ antes: 0, durante: 0, despues: 0 });
        setObservacionesGenerales(data.observacionesGenerales ?? '');
        setFirmasEvidencias({
          responsableDiligenciamiento: normalizeFirmaEvidenciaFromApi(data.responsableDiligenciamiento),
          residenteObra: normalizeFirmaEvidenciaFromApi(data.residenteObra),
          auxiliarIngenieria: normalizeFirmaEvidenciaFromApi(data.auxiliarIngenieria),
          vistoBuenoDirectorObra: normalizeFirmaEvidenciaFromApi(data.vistoBuenoDirectorObra),
        });
      })
      .catch(() => {
        // si no hay registro aún, cargamos defaults
        setRegistroFotografico(false);
        setEvidenciaUrlsPorFase(emptyEvidenciaUrlsPorFase());
        setEvidenciaCarouselIndex({ antes: 0, durante: 0, despues: 0 });
        setObservacionesGenerales('');
        setFirmasEvidencias({
          responsableDiligenciamiento: emptyFirmaEvidencia(),
          residenteObra: emptyFirmaEvidencia(),
          auxiliarIngenieria: emptyFirmaEvidencia(),
          vistoBuenoDirectorObra: emptyFirmaEvidencia(),
        });
      })
      .finally(() => setLoadingEvidencias(false));
  }, [activeSection, selectedObraId, selectedJornadaId, jornadaQuery, datosGeneralesForm.fechaReporte]);

  useEffect(() => {
    if (activeSection === 'personal' && selectedObraId && selectedJornadaId) {
      const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);
      setLoadingPersonal(true);
      fetch(
        `/api/informes/personal?projectId=${encodeURIComponent(selectedObraId)}&date=${encodeURIComponent(date)}${jornadaQuery}`,
        { credentials: 'include' },
      )
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data: { personal?: any[] }) => {
          const list = Array.isArray(data.personal) ? data.personal : [];
          setPersonalRows(
            list.map((p) => ({
              id: p.id,
              nombre: p.nombre ?? '',
              cargo: p.cargo ?? '',
              subcontratista: p.subcontratista ?? '',
              horaEntrada: p.horaEntrada ?? '',
              horaSalida: p.horaSalida ?? '',
            })),
          );
          setPersonalDraft(emptyPersonalDraft());
          setPersonalEditingIndex(null);
        })
        .catch(() => setPersonalRows([]))
        .finally(() => setLoadingPersonal(false));
    }
  }, [activeSection, selectedObraId, selectedJornadaId, jornadaQuery, datosGeneralesForm.fechaReporte]);

  useEffect(() => {
    if (activeSection === 'equipos' && selectedObraId && selectedJornadaId && equiposTab === 'maquinaria') {
      const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);
      setLoadingEquipos(true);
      fetch(
        `/api/informes/equipos?projectId=${encodeURIComponent(selectedObraId)}&date=${encodeURIComponent(date)}${jornadaQuery}`,
        { credentials: 'include' },
      )
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data: { equipos?: any[] }) => {
          const list = Array.isArray(data.equipos) ? data.equipos : [];
          setEquiposRows(
            list.map((e) => {
              const horarios = Array.isArray(e.horarios)
                ? e.horarios.map((h: any) => ({
                    horaIngreso: h.horaIngreso ?? '',
                    horaSalida: h.horaSalida ?? '',
                    horasTrabajadas: Number(h.horasTrabajadas ?? 0),
                  }))
                : [];
              const fallbackHorarios =
                horarios.length > 0
                  ? horarios
                  : e.horaIngreso || e.horaSalida
                    ? [
                        {
                          horaIngreso: e.horaIngreso ?? '',
                          horaSalida: e.horaSalida ?? '',
                          horasTrabajadas: Number(e.horasTrabajadas ?? 0),
                        },
                      ]
                    : [];
              return {
                id: e.id,
                descripcion: e.descripcion ?? '',
                placaRef: e.placaRef ?? '',
                propiedad: e.propiedad ?? '',
                estado: e.estado ?? '',
                observacion: e.observacion ?? '',
                imagenUrl: e.imagenUrl ?? '',
                ...fotoGeoFromSource(e),
                horaIngreso: fallbackHorarios[0]?.horaIngreso ?? '',
                horaSalida: fallbackHorarios[fallbackHorarios.length - 1]?.horaSalida ?? '',
                horasTrabajadas: sumEquipoHorarios(fallbackHorarios),
                horarios: fallbackHorarios,
              };
            }),
          );
          setEquipoDraft(emptyEquipoDraft());
          setEquipoEditingIndex(null);
        })
        .catch(() => setEquiposRows([]))
        .finally(() => setLoadingEquipos(false));
    }
  }, [activeSection, selectedObraId, selectedJornadaId, jornadaQuery, datosGeneralesForm.fechaReporte, equiposTab]);

  useEffect(() => {
    setEquipoDraft(emptyEquipoDraft());
    setEquipoEditingIndex(null);
    setIngresoDraft(emptyIngresoDraft());
    setIngresoEditingIndex(null);
    setEntregaDraft(emptyEntregaDraft());
    setEntregaEditingIndex(null);
  }, [equiposTab]);

  useEffect(() => {
    if (activeSection === 'equipos' && selectedObraId && selectedJornadaId && equiposTab === 'ingreso') {
      const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);
      setLoadingIngreso(true);
      fetch(
        `/api/informes/material-ingresos?projectId=${encodeURIComponent(selectedObraId)}&date=${encodeURIComponent(date)}${jornadaQuery}`,
        { credentials: 'include' },
      )
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data: { ingresos?: any[] }) => {
          const list = Array.isArray(data.ingresos) ? data.ingresos : [];
          setIngresoRows(
            list.map((m) => ({
              id: m.id,
              proveedor: m.proveedor ?? '',
              tipoMaterial: m.tipoMaterial ?? '',
              noRemision: m.noRemision ?? '',
              unidad: m.unidad ?? '',
              cantidad: Number(m.cantidad ?? 0),
              observacion: m.observacion ?? '',
              imagenUrl: m.imagenUrl ?? '',
              ...fotoGeoFromSource(m),
            })),
          );
          setIngresoDraft(emptyIngresoDraft());
          setIngresoEditingIndex(null);
        })
        .catch(() => setIngresoRows([]))
        .finally(() => setLoadingIngreso(false));
    }
  }, [activeSection, selectedObraId, selectedJornadaId, jornadaQuery, datosGeneralesForm.fechaReporte, equiposTab]);

  useEffect(() => {
    if (activeSection === 'equipos' && selectedObraId && selectedJornadaId && equiposTab === 'entregado') {
      const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);
      setLoadingEntrega(true);
      fetch(
        `/api/informes/material-entregas?projectId=${encodeURIComponent(selectedObraId)}&date=${encodeURIComponent(date)}${jornadaQuery}`,
        { credentials: 'include' },
      )
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data: { entregas?: any[] }) => {
          const list = Array.isArray(data.entregas) ? data.entregas : [];
          setEntregaRows(
            list.map((m) => ({
              id: m.id,
              tipoMaterial: m.tipoMaterial ?? '',
              unidad: m.unidad ?? '',
              cantidad: Number(m.cantidad ?? 0),
              contratista: m.contratista ?? '',
              firmaRecibido: Boolean(m.firmaRecibido),
              observacion: m.observacion ?? '',
              imagenUrl: m.imagenUrl ?? '',
              ...fotoGeoFromSource(m),
            })),
          );
          setEntregaDraft(emptyEntregaDraft());
          setEntregaEditingIndex(null);
        })
        .catch(() => setEntregaRows([]))
        .finally(() => setLoadingEntrega(false));
    }
  }, [activeSection, selectedObraId, selectedJornadaId, jornadaQuery, datosGeneralesForm.fechaReporte, equiposTab]);

  useEffect(() => {
    if (activeSection === 'actividades' && selectedObraId && selectedJornadaId) {
      const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);
      setLoadingActividad(true);
      fetch(
        `/api/informes/actividades?projectId=${encodeURIComponent(selectedObraId)}&date=${encodeURIComponent(date)}${jornadaQuery}`,
        { credentials: 'include' },
      )
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data: { actividades?: any[] }) => {
          const list = Array.isArray(data.actividades) ? data.actividades : [];
          setActividadRows(
            list.map((a) => ({
              id: a.id,
              pk: a.pk ?? '',
              abscisado: a.abscisado ?? '',
              itemContractual: a.itemContractual ?? '',
              descripcion: a.descripcion ?? '',
              unidadMedida: a.unidadMedida ?? '',
              observacion: String(a.observacionTexto ?? ''),
              imagenUrl: a.imagenUrl ?? null,
              ...fotoGeoFromSource(a),
              largo: Number(a.largo ?? 0),
              ancho: Number(a.ancho ?? 0),
              altura: Number(a.altura ?? 0),
              cantidadTotal: Number(a.cantidadTotal ?? 0),
            })),
          );
          setActividadDraft(emptyActividadDraft());
          setActividadEditingIndex(null);
        })
        .catch(() => {
          setActividadRows([]);
          setActividadDraft(emptyActividadDraft());
          setActividadEditingIndex(null);
        })
        .finally(() => setLoadingActividad(false));
    }
  }, [activeSection, selectedObraId, selectedJornadaId, jornadaQuery, datosGeneralesForm.fechaReporte]);

  useEffect(() => {
    if (availableRoles.length > 0 && !availableRoles.some((r) => r.role === userForm.role)) {
      setUserForm((prev) => ({ ...prev, role: availableRoles[0].role }));
    }
  }, [availableRoles]);

  useEffect(() => {
    if (
      activeSection === 'datos' ||
      activeSection === 'jornada' ||
      activeSection === 'personal' ||
      activeSection === 'equipos' ||
      activeSection === 'actividades' ||
      activeSection === 'calidad' ||
      activeSection === 'evidencias' ||
      activeSection === 'tabulacion'
    ) {
      setDatosGeneralesForm((prev) => {
        if (prev.fechaReporte) return prev;
        const today = new Date().toISOString().slice(0, 10);
        return { ...prev, fechaReporte: today };
      });
    }
  }, [activeSection]);

  useEffect(() => {
    if (activeSection === 'users' && usersSubSection === 'administrar') {
      setLoadingUsers(true);
      fetch('/api/admin/users', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data: { users?: { id: string; identification: string; email: string; name: string; role: string; isActive: boolean }[] }) =>
          setUsersList(data.users ?? []),
        )
        .catch(() => setUsersList([]))
        .finally(() => setLoadingUsers(false));
    }
  }, [activeSection, usersSubSection]);

  useEffect(() => {
    if (activeSection === 'users' && usersSubSection === 'roles') {
      setLoadingRoleLabels(true);
      fetch('/api/admin/roles', { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : Promise.reject(res)))
        .then((data: { roles?: { role: string; label: string }[] }) => {
          setRoleLabels(data.roles ?? []);
          setEditingRoleLabel(Object.fromEntries((data.roles ?? []).map((r) => [r.role, r.label])));
        })
        .catch(() => {
          setRoleLabels([]);
          setEditingRoleLabel({});
        })
        .finally(() => setLoadingRoleLabels(false));
    }
  }, [activeSection, usersSubSection]);

  const handlePermissionToggle = (role: string, menuKey: string, checked: boolean) => {
    const roleData = rolePermissions.find((r) => r.role === role);
    const current = roleData?.menuKeys ?? [];
    const next = checked ? [...current, menuKey] : current.filter((k) => k !== menuKey);
    setRolePermissions((prev) =>
      prev.map((r) => (r.role === role ? { ...r, menuKeys: next } : r)),
    );
    setSavingRole(role);
    fetch('/api/admin/roles/permissions', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, menuKeys: next }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .catch(() => {
        setRolePermissions((prev) =>
          prev.map((r) => (r.role === role ? { ...r, menuKeys: current } : r)),
        );
      })
      .finally(() => setSavingRole(null));
  };

  const handleFirmaPermissionToggle = (role: string, permKey: string, checked: boolean) => {
    const roleData = rolePermissions.find((r) => r.role === role);
    const current = roleData?.firmaPermKeys ?? [];
    const next = checked ? [...current, permKey] : current.filter((k) => k !== permKey);
    setRolePermissions((prev) =>
      prev.map((r) => (r.role === role ? { ...r, firmaPermKeys: next } : r)),
    );
    setSavingRole(role);
    fetch('/api/admin/roles/permissions', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        menuKeys: roleData?.menuKeys ?? [],
        firmaPermKeys: next,
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .catch(() => {
        setRolePermissions((prev) =>
          prev.map((r) => (r.role === role ? { ...r, firmaPermKeys: current } : r)),
        );
      })
      .finally(() => setSavingRole(null));
  };

  useEffect(() => {
    if (
      allowedMenus.length > 0 &&
      activeSection !== 'home' &&
      !allowedMenus.includes(activeSection)
    ) {
      setActiveSection('home');
    }
  }, [allowedMenus, activeSection]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (informeDropdownRef.current && !informeDropdownRef.current.contains(event.target as Node)) {
        setInformeDropdownOpen(false);
      }
    }
    if (informeDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [informeDropdownOpen]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* seguir con la salida aunque falle la red */
    }
    setMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setInstallAvailable(false);
      setInstallPrompt(null);
    }
  };

  const handleInstallHelpClick = () => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isEdge = /edg\//.test(ua);
    const isChrome = /chrome/.test(ua) && !isEdge;

    let message = 'Para instalar la app, abre el menu del navegador y usa "Instalar aplicacion".';
    if (isAndroid && isChrome) {
      message = 'Chrome Android: abre el menu (tres puntos) y toca "Instalar aplicacion" o "Agregar a pantalla principal".';
    } else if (isAndroid && isEdge) {
      message = 'Edge Android: abre el menu y selecciona "Instalar esta aplicacion".';
    } else if (isIOS) {
      message = 'iPhone/iPad: toca Compartir y luego "Agregar a pantalla de inicio".';
    } else if (isChrome || isEdge) {
      message = 'En escritorio: usa el icono de instalar en la barra de direcciones o el menu del navegador.';
    }
    window.alert(message);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setUserMessage(null);
    setUserError(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setUserError(data.error ?? 'No se pudo crear el usuario');
        return;
      }

      setUserMessage('Usuario creado correctamente.');
      setUserForm({
        identification: '',
        email: '',
        name: '',
        role: availableRoles[0]?.role ?? '',
        password: '',
      });
    } catch (err) {
      console.error(err);
      setUserError('Error de conexión al crear usuario.');
    } finally {
      setCreatingUser(false);
    }
  };

  const openEditUser = (u: { id: string; identification: string; email: string; name: string; role: string; isActive: boolean }) => {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role, password: '' });
  };

  const saveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSavingUser(true);
    try {
      const body: { name: string; email: string; role: string; password?: string } = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
      };
      if (editForm.password) body.password = editForm.password;
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setUserError(data.error ?? 'Error al guardar');
        return;
      }
      setUsersList((prev) => prev.map((x) => (x.id === editUser.id ? { ...x, ...data.user } : x)));
      setEditUser(null);
      setUserMessage('Usuario actualizado.');
      setTimeout(() => setUserMessage(null), 3000);
    } catch {
      setUserError('Error de conexión.');
    } finally {
      setSavingUser(false);
    }
  };

  const toggleUserActive = async (u: { id: string; isActive: boolean }) => {
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      if (!res.ok) return;
      setUsersList((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: !u.isActive } : x)));
    } catch {
      // ignore
    }
  };

  const deleteUser = async (u: { id: string; name: string }) => {
    if (!confirm(`¿Eliminar usuario "${u.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const data = await res.json();
        setUserError(data.error ?? 'No se pudo eliminar');
        return;
      }
      setUsersList((prev) => prev.filter((x) => x.id !== u.id));
      setUserMessage('Usuario eliminado.');
      setTimeout(() => setUserMessage(null), 3000);
    } catch {
      setUserError('Error de conexión.');
    }
  };

  const saveRoleLabel = async (role: string) => {
    const label = editingRoleLabel[role];
    if (label == null) return;
    setSavingRoleLabel(role);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, label }),
      });
      if (res.ok) {
        setRoleLabels((prev) => prev.map((r) => (r.role === role ? { ...r, label } : r)));
        setAvailableRoles((prev) => prev.map((r) => (r.role === role ? { ...r, label } : r)));
      }
    } finally {
      setSavingRoleLabel(null);
    }
  };

  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [deletingRole, setDeletingRole] = useState<string | null>(null);

  const createRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingRole(true);
    setRoleMessage(null);
    setRoleError(null);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRoleKey.trim(), label: newRoleLabel.trim() || newRoleKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRoleError(data.error ?? 'No se pudo crear el rol');
        return;
      }
      setRoleLabels((prev) => [...prev, { role: data.role, label: data.label }]);
      setAvailableRoles((prev) => [...prev, { role: data.role, label: data.label }]);
      setEditingRoleLabel((prev) => ({ ...prev, [data.role]: data.label }));
      setRolePermissions((prev) => [
        ...prev,
        { role: data.role, label: data.label, menuKeys: [], firmaPermKeys: [] },
      ]);
      setNewRoleKey('');
      setNewRoleLabel('');
      setRoleMessage('Rol creado. Asigna permisos en la tabla inferior.');
      setTimeout(() => setRoleMessage(null), 4000);
    } catch {
      setRoleError('Error de conexión.');
    } finally {
      setCreatingRole(false);
    }
  };

  const deleteRole = async (role: string) => {
    if (!confirm(`¿Eliminar el rol "${role}"? No se puede deshacer. Asegúrese de que ningún usuario tenga este rol.`)) return;
    setDeletingRole(role);
    setRoleError(null);
    try {
      const res = await fetch(`/api/admin/roles?role=${encodeURIComponent(role)}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setRoleError(data.error ?? 'No se pudo eliminar');
        return;
      }
      setRoleLabels((prev) => prev.filter((r) => r.role !== role));
      setAvailableRoles((prev) => prev.filter((r) => r.role !== role));
      setRolePermissions((prev) => prev.filter((r) => r.role !== role));
      setEditingRoleLabel((prev) => {
        const next = { ...prev };
        delete next[role];
        return next;
      });
      setRoleMessage('Rol eliminado.');
      setTimeout(() => setRoleMessage(null), 3000);
    } catch {
      setRoleError('Error de conexión.');
    } finally {
      setDeletingRole(null);
    }
  };

  const createObra = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingObra(true);
    setObraMessage(null);
    setObraError(null);
    try {
      const res = await fetch('/api/admin/obras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: obraForm.name.trim(),
          startDate: obraForm.startDate || undefined,
          endDate: obraForm.endDate || undefined,
          evidenciasGoogleDriveFolderId: obraForm.evidenciasGoogleDriveFolderId.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setObraError(data.error ?? 'No se pudo crear la obra');
        return;
      }
      setObrasList((prev) => [...prev, data.obra]);
      setObraForm({ name: '', startDate: '', endDate: '', evidenciasGoogleDriveFolderId: '' });
      setObraMessage('Obra creada. El consecutivo y código se asignaron automáticamente.');
      setTimeout(() => setObraMessage(null), 4000);
    } catch {
      setObraError('Error de conexión.');
    } finally {
      setCreatingObra(false);
    }
  };

  const openEditObra = (o: {
    id: string;
    consecutivo: number | null;
    name: string;
    code: string;
    startDate: string | null;
    endDate: string | null;
    evidenciasOnedriveShareUrl: string | null;
    evidenciasGoogleDriveFolderId: string | null;
  }) => {
    setEditObra(o);
    setEditObraForm({
      name: o.name,
      startDate: o.startDate ? o.startDate.slice(0, 10) : '',
      endDate: o.endDate ? o.endDate.slice(0, 10) : '',
      evidenciasGoogleDriveFolderId:
        (o.evidenciasGoogleDriveFolderId ?? o.evidenciasOnedriveShareUrl) ?? '',
    });
  };

  const saveEditObra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editObra) return;
    setSavingObra(true);
    setObraError(null);
    try {
      const res = await fetch(`/api/admin/obras/${editObra.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: editObraForm.name.trim(),
          startDate: editObraForm.startDate || null,
          endDate: editObraForm.endDate || null,
          evidenciasGoogleDriveFolderId: editObraForm.evidenciasGoogleDriveFolderId.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setObraError(data.error ?? 'Error al guardar');
        return;
      }
      setObrasList((prev) => prev.map((x) => (x.id === editObra.id ? { ...x, ...data.obra } : x)));
      setEditObra(null);
      setObraMessage('Obra actualizada.');
      setTimeout(() => setObraMessage(null), 3000);
    } catch {
      setObraError('Error de conexión.');
    } finally {
      setSavingObra(false);
    }
  };

  const deleteObra = async (o: { id: string; name: string }) => {
    if (!confirm(`¿Eliminar la obra "${o.name}"? No se puede deshacer. No debe tener informes asociados.`)) return;
    setDeletingObraId(o.id);
    setObraError(null);
    try {
      const res = await fetch(`/api/admin/obras/${o.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setObraError(data.error ?? 'No se pudo eliminar');
        return;
      }
      setObrasList((prev) => prev.filter((x) => x.id !== o.id));
      if (editObra?.id === o.id) setEditObra(null);
      setObraMessage('Obra eliminada.');
      setTimeout(() => setObraMessage(null), 3000);
    } catch {
      setObraError('Error de conexión.');
    } finally {
      setDeletingObraId(null);
    }
  };

  // CRUD Catálogos - Contratistas
  const createContratista = async (e: React.FormEvent) => {
    e.preventDefault();
    setContratistasSaving(true);
    setContratistasError(null);
    try {
      if (!contratistasFilterProjectId) {
        setContratistasError('Seleccione una obra.');
        return;
      }
      const cedula = contratistasNewCedula.trim();
      const nombre = contratistasNewNombre.trim();
      if (!cedula) {
        setContratistasError('La cédula es requerida.');
        return;
      }
      if (!nombre) {
        setContratistasError('El nombre es requerido.');
        return;
      }
      const res = await fetch('/api/admin/catalogos/contratistas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: contratistasFilterProjectId, cedula, nombre }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setContratistasError(data.error ?? 'No se pudo crear');
        return;
      }
      setContratistasAdmin((prev) => [...prev, data.item]);
      setContratistasNewNombre('');
      setContratistasNewCedula('');
    } catch {
      setContratistasError('Error de conexión.');
    } finally {
      setContratistasSaving(false);
    }
  };

  const saveEditContratista = async (id: string) => {
    setContratistasError(null);
    setContratistasSaving(true);
    try {
      const res = await fetch(`/api/admin/catalogos/contratistas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cedula: editingContratistaCedula.trim(),
          nombre: editingContratistaNombre.trim(),
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setContratistasError(data.error ?? 'No se pudo guardar');
        return;
      }
      setContratistasAdmin((prev) => prev.map((x) => (x.id === id ? data.item : x)));
      setEditingContratistaId(null);
      setEditingContratistaNombre('');
      setEditingContratistaCedula('');
    } catch {
      setContratistasError('Error de conexión.');
    } finally {
      setContratistasSaving(false);
    }
  };

  const deleteContratista = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar contratista "${nombre}"?`)) return;
    setDeletingContratistaId(id);
    setContratistasError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/contratistas/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setContratistasError(data.error ?? 'No se pudo eliminar');
        return;
      }
      setContratistasAdmin((prev) => prev.filter((x) => x.id !== id));
      if (editingContratistaId === id) {
        setEditingContratistaId(null);
        setEditingContratistaNombre('');
      }
    } catch {
      setContratistasError('Error de conexión.');
    } finally {
      setDeletingContratistaId(null);
    }
  };

  // CRUD Catálogos - Encargados
  const createEncargado = async (e: React.FormEvent) => {
    e.preventDefault();
    setEncargadosSaving(true);
    setEncargadosError(null);
    try {
      if (!encargadosFilterProjectId) {
        setEncargadosError('Seleccione una obra.');
        return;
      }
      const cedula = encargadosNewCedula.trim();
      const nombre = encargadosNewNombre.trim();
      if (!cedula) {
        setEncargadosError('La cédula es requerida.');
        return;
      }
      if (!nombre) {
        setEncargadosError('El nombre es requerido.');
        return;
      }
      const res = await fetch('/api/admin/catalogos/encargados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: encargadosFilterProjectId, cedula, nombre }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setEncargadosError(data.error ?? 'No se pudo crear');
        return;
      }
      setEncargadosAdmin((prev) => [...prev, data.item]);
      setEncargadosNewNombre('');
      setEncargadosNewCedula('');
    } catch {
      setEncargadosError('Error de conexión.');
    } finally {
      setEncargadosSaving(false);
    }
  };

  const saveEditEncargado = async (id: string) => {
    setEncargadosError(null);
    setEncargadosSaving(true);
    try {
      const res = await fetch(`/api/admin/catalogos/encargados/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cedula: editingEncargadoCedula.trim(),
          nombre: editingEncargadoNombre.trim(),
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setEncargadosError(data.error ?? 'No se pudo guardar');
        return;
      }
      setEncargadosAdmin((prev) => prev.map((x) => (x.id === id ? data.item : x)));
      setEditingEncargadoId(null);
      setEditingEncargadoNombre('');
      setEditingEncargadoCedula('');
    } catch {
      setEncargadosError('Error de conexión.');
    } finally {
      setEncargadosSaving(false);
    }
  };

  const deleteEncargado = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar encargado "${nombre}"?`)) return;
    setDeletingEncargadoId(id);
    setEncargadosError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/encargados/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setEncargadosError(data.error ?? 'No se pudo eliminar');
        return;
      }
      setEncargadosAdmin((prev) => prev.filter((x) => x.id !== id));
      if (editingEncargadoId === id) {
        setEditingEncargadoId(null);
        setEditingEncargadoNombre('');
        setEditingEncargadoCedula('');
      }
    } catch {
      setEncargadosError('Error de conexión.');
    } finally {
      setDeletingEncargadoId(null);
    }
  };

  // CRUD Catálogos - Cargos
  const createCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargosSaving(true);
    setCargosError(null);
    try {
      if (!cargosFilterProjectId) {
        setCargosError('Seleccione una obra.');
        return;
      }
      const res = await fetch('/api/admin/catalogos/cargos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: cargosFilterProjectId, nombre: cargosNewNombre.trim() }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setCargosError(data.error ?? 'No se pudo crear');
        return;
      }
      setCargosAdmin((prev) => [...prev, data.item]);
      setCargosNewNombre('');
    } catch {
      setCargosError('Error de conexión.');
    } finally {
      setCargosSaving(false);
    }
  };

  const saveEditCargo = async (id: string) => {
    setCargosError(null);
    setCargosSaving(true);
    try {
      const res = await fetch(`/api/admin/catalogos/cargos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: editingCargoNombre.trim() }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setCargosError(data.error ?? 'No se pudo guardar');
        return;
      }
      setCargosAdmin((prev) => prev.map((x) => (x.id === id ? data.item : x)));
      setEditingCargoId(null);
      setEditingCargoNombre('');
    } catch {
      setCargosError('Error de conexión.');
    } finally {
      setCargosSaving(false);
    }
  };

  const deleteCargo = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar cargo "${nombre}"?`)) return;
    setDeletingCargoId(id);
    setCargosError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/cargos/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setCargosError(data.error ?? 'No se pudo eliminar');
        return;
      }
      setCargosAdmin((prev) => prev.filter((x) => x.id !== id));
      if (editingCargoId === id) {
        setEditingCargoId(null);
        setEditingCargoNombre('');
      }
    } catch {
      setCargosError('Error de conexión.');
    } finally {
      setDeletingCargoId(null);
    }
  };

  const proveedorPayload = (form: ReturnType<typeof emptyProveedorForm>) => ({
    tipoPersona: form.tipoPersona,
    nombreRazonSocial: form.nombreRazonSocial.trim(),
    nombreComercial: form.nombreComercial.trim() || null,
    nitDocumento: form.nitDocumento.trim(),
    dv: form.dv.trim() || null,
    email: form.email.trim() || null,
    telefono: form.telefono.trim() || null,
    celular: form.celular.trim() || null,
    direccion: form.direccion.trim() || null,
    pais: form.pais.trim() || null,
    departamento: form.departamento.trim() || null,
    ciudad: form.ciudad.trim() || null,
    codigoPostal: form.codigoPostal.trim() || null,
    isActive: form.isActive,
  });

  const createProveedor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proveedoresFilterProjectId) {
      setProveedoresError('Seleccione una obra.');
      return;
    }
    setProveedoresSaving(true);
    setProveedoresError(null);
    try {
      const res = await fetch('/api/admin/catalogos/proveedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId: proveedoresFilterProjectId, ...proveedorPayload(proveedoresNewForm) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProveedoresError(data.error ?? 'No se pudo crear');
        return;
      }
      setProveedoresAdmin((prev) => [...prev, data.item]);
      setProveedoresNewForm(emptyProveedorForm());
    } catch {
      setProveedoresError('Error de conexión.');
    } finally {
      setProveedoresSaving(false);
    }
  };

  const saveEditProveedor = async (id: string) => {
    setProveedoresSaving(true);
    setProveedoresError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/proveedores/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(proveedorPayload(editingProveedorForm)),
      });
      const data = await res.json();
      if (!res.ok) {
        setProveedoresError(data.error ?? 'No se pudo guardar');
        return;
      }
      setProveedoresAdmin((prev) => prev.map((x) => (x.id === id ? data.item : x)));
      setEditingProveedorId(null);
      setEditingProveedorForm(emptyProveedorForm());
    } catch {
      setProveedoresError('Error de conexión.');
    } finally {
      setProveedoresSaving(false);
    }
  };

  const deleteProveedor = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar proveedor "${nombre}"? Los ítems asociados quedarán sin proveedor.`)) return;
    setDeletingProveedorId(id);
    setProveedoresError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/proveedores/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setProveedoresError(data.error ?? 'No se pudo eliminar');
        return;
      }
      setProveedoresAdmin((prev) => prev.filter((x) => x.id !== id));
      if (editingProveedorId === id) {
        setEditingProveedorId(null);
        setEditingProveedorForm(emptyProveedorForm());
      }
    } catch {
      setProveedoresError('Error de conexión.');
    } finally {
      setDeletingProveedorId(null);
    }
  };

  const reloadItemsBudgetTree = useCallback(async () => {
    if (!itemsFilterProjectId) return;
    try {
      const res = await fetch(
        `/api/admin/catalogos/items-tree?projectId=${encodeURIComponent(itemsFilterProjectId)}`,
        { credentials: 'include' },
      );
      const data = await res.json();
      if (!res.ok) {
        setItemsError(
          typeof data?.error === 'string' && data.error.trim()
            ? data.error.trim()
            : 'Error al cargar estructura de presupuesto (ítems).',
        );
        return;
      }
      const chapters = Array.isArray(data.chapters) ? (data.chapters as BudgetChapterTree[]) : [];
      setItemsBudgetChapters(chapters);
      const subIds = new Set<string>();
      for (const ch of chapters) {
        for (const s of ch.subchapters) subIds.add(s.id);
      }
      setItemsTargetSubchapterId((prev) => {
        if (prev && subIds.has(prev)) return prev;
        return chapters[0]?.subchapters?.[0]?.id ?? '';
      });
      setBudgetSubchapterChapterId((prev) => {
        if (prev && chapters.some((c) => c.id === prev)) return prev;
        return chapters[0]?.id ?? '';
      });
    } catch {
      /* silencioso: errores ya se muestran en otras acciones */
    }
  }, [itemsFilterProjectId]);

  const createBudgetChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemsFilterProjectId) {
      setItemsError('Seleccione una obra.');
      return;
    }
    const cod = budgetChapterCodigo.trim();
    const nom = budgetChapterNombre.trim();
    if (!cod || !nom) {
      setItemsError('Indique código y nombre del capítulo.');
      return;
    }
    setItemsSaving(true);
    setItemsError(null);
    try {
      const res = await fetch('/api/admin/catalogos/budget-chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId: itemsFilterProjectId, codigo: cod, nombre: nom }),
      });
      const data = await res.json();
      if (!res.ok) {
        setItemsError(data.error ?? 'No se pudo crear el capítulo');
        return;
      }
      setBudgetChapterCodigo('');
      setBudgetChapterNombre('');
      await reloadItemsBudgetTree();
      setItemsError('Capítulo creado correctamente.');
    } catch {
      setItemsError('Error de conexión.');
    } finally {
      setItemsSaving(false);
    }
  };

  const createBudgetSubchapter = async (e: React.FormEvent) => {
    e.preventDefault();
    const nom = budgetSubchapterNombre.trim();
    const chId = budgetSubchapterChapterId.trim();
    if (!chId || !nom) {
      setItemsError('Seleccione capítulo padre y nombre del subcapítulo.');
      return;
    }
    setItemsSaving(true);
    setItemsError(null);
    try {
      const res = await fetch('/api/admin/catalogos/budget-subchapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ chapterId: chId, nombre: nom }),
      });
      const data = await res.json();
      if (!res.ok) {
        setItemsError(data.error ?? 'No se pudo crear el subcapítulo');
        return;
      }
      setBudgetSubchapterNombre('');
      if (data.subchapter?.id) setItemsTargetSubchapterId(String(data.subchapter.id));
      await reloadItemsBudgetTree();
      setItemsError('Subcapítulo creado correctamente.');
    } catch {
      setItemsError('Error de conexión.');
    } finally {
      setItemsSaving(false);
    }
  };

  const saveEditBudgetChapter = async (id: string) => {
    const codigo = editingBudgetChapterForm.codigo.trim();
    const nombre = editingBudgetChapterForm.nombre.trim();
    if (!codigo || !nombre) {
      setItemsError('Indique código y nombre del capítulo.');
      return;
    }
    setItemsSaving(true);
    setItemsError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/budget-chapters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          codigo,
          nombre,
          orden: editingBudgetChapterForm.orden,
          isActive: editingBudgetChapterForm.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setItemsError(data.error ?? 'No se pudo guardar el capítulo');
        return;
      }
      await reloadItemsBudgetTree();
      setEditingBudgetChapterId(null);
      setEditingBudgetChapterForm({ codigo: '', nombre: '', orden: 0, isActive: true });
      setItemsError('Capítulo actualizado correctamente.');
    } catch {
      setItemsError('Error de conexión.');
    } finally {
      setItemsSaving(false);
    }
  };

  const saveEditBudgetSubchapter = async (id: string) => {
    const chapterId = editingBudgetSubchapterForm.chapterId.trim();
    const nombre = editingBudgetSubchapterForm.nombre.trim();
    if (!chapterId || !nombre) {
      setItemsError('Seleccione capítulo padre y nombre del subcapítulo.');
      return;
    }
    setItemsSaving(true);
    setItemsError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/budget-subchapters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          chapterId,
          nombre,
          orden: editingBudgetSubchapterForm.orden,
          isActive: editingBudgetSubchapterForm.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setItemsError(data.error ?? 'No se pudo guardar el subcapítulo');
        return;
      }
      await reloadItemsBudgetTree();
      setEditingBudgetSubchapterId(null);
      setEditingBudgetSubchapterForm({ chapterId: '', nombre: '', orden: 0, isActive: true });
      setItemsError('Subcapítulo actualizado correctamente.');
    } catch {
      setItemsError('Error de conexión.');
    } finally {
      setItemsSaving(false);
    }
  };

  const deleteBudgetChapter = async (id: string, label: string) => {
    if (!confirm(`¿Eliminar el capítulo "${label}" y todos sus subcapítulos e ítems asociados?`)) return;
    setItemsSaving(true);
    setItemsError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/budget-chapters/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setItemsError(data.error ?? 'No se pudo eliminar');
        return;
      }
      await reloadItemsBudgetTree();
      if (editingBudgetChapterId === id) {
        setEditingBudgetChapterId(null);
        setEditingBudgetChapterForm({ codigo: '', nombre: '', orden: 0, isActive: true });
      }
    } catch {
      setItemsError('Error de conexión.');
    } finally {
      setItemsSaving(false);
    }
  };

  const deleteBudgetSubchapter = async (id: string, label: string) => {
    if (!confirm(`¿Eliminar el subcapítulo "${label}" y todos los ítems que contiene?`)) return;
    setItemsSaving(true);
    setItemsError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/budget-subchapters/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setItemsError(data.error ?? 'No se pudo eliminar');
        return;
      }
      await reloadItemsBudgetTree();
      if (editingBudgetSubchapterId === id) {
        setEditingBudgetSubchapterId(null);
        setEditingBudgetSubchapterForm({ chapterId: '', nombre: '', orden: 0, isActive: true });
      }
    } catch {
      setItemsError('Error de conexión.');
    } finally {
      setItemsSaving(false);
    }
  };

  const createItemCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemsError(null);
    setItemsSaving(true);
    try {
      if (!itemsFilterProjectId) {
        setItemsError('Seleccione una obra.');
        return;
      }
      if (!itemsTargetSubchapterId) {
        setItemsError('Seleccione el subcapítulo donde se creará el ítem (estructura de presupuesto).');
        return;
      }
      if (!itemNewUnidad.trim()) {
        setItemsError('Seleccione una unidad de medida.');
        return;
      }
      if (!itemNewProveedorId) {
        setItemsError('Seleccione el proveedor del ítem.');
        return;
      }
      const kindNew = itemCatalogCaptureKind(itemNewUnidad.trim());
      if (kindNew !== 'none' && kindNew !== 'manual') {
        if (
          computeItemCatalogCantidadFromInputs(
            itemNewUnidad,
            itemNewLargo,
            itemNewAncho,
            itemNewAltura,
            itemNewCantidad,
          ) == null
        ) {
          setItemsError('Ingrese las medidas necesarias para calcular la cantidad.');
          return;
        }
      }
      const icPayload = itemCatalogPayloadFromFormFields(
        itemNewUnidad,
        itemNewLargo,
        itemNewAncho,
        itemNewAltura,
        itemNewCantidad,
      );
      const codigoAuto = nextAutonumericItemCatalogCodigo(itemsAdminFlat);
      const res = await fetch('/api/admin/catalogos/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: itemsFilterProjectId,
          subchapterId: itemsTargetSubchapterId,
          codigo: codigoAuto,
          descripcion: itemNewDescripcion.trim(),
          unidad: icPayload.unidad,
          precioUnitario: itemNewPrecio.trim() ? Number(itemNewPrecio.replace(',', '.')) : null,
          cantidad: icPayload.cantidad,
          largo: icPayload.largo,
          ancho: icPayload.ancho,
          altura: icPayload.altura,
          imagenUrl: itemNewImagenUrl.trim() || null,
          ...fotoGeoPayload(itemNewFotoGeo),
          proveedorId: itemNewProveedorId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setItemsError(data.error ?? 'No se pudo crear');
        return;
      }
      await reloadItemsBudgetTree();
      setItemsError('Ítem creado correctamente.');
      setItemNewDescripcion('');
      setItemNewUnidad('');
      setItemNewPrecio('');
      setItemNewCantidad('');
      setItemNewLargo('');
      setItemNewAncho('');
      setItemNewAltura('');
      setItemNewImagenUrl('');
      setItemNewFotoGeo(emptyFotoGeoFields());
      setItemNewProveedorId(itemProveedorOptions[0]?.id ?? '');
    } catch {
      setItemsError('Error de conexión.');
    } finally {
      setItemsSaving(false);
    }
  };

  const saveEditItem = async (id: string) => {
    setItemsError(null);
    setItemsSaving(true);
    try {
      if (!editingItemForm.unidad.trim()) {
        setItemsError('Seleccione una unidad de medida.');
        return;
      }
      if (!editingItemForm.proveedorId.trim()) {
        setItemsError('Seleccione el proveedor del ítem.');
        return;
      }
      const kindEd = itemCatalogCaptureKind(editingItemForm.unidad.trim());
      if (kindEd !== 'none' && kindEd !== 'manual') {
        if (
          computeItemCatalogCantidadFromInputs(
            editingItemForm.unidad,
            editingItemForm.largo,
            editingItemForm.ancho,
            editingItemForm.altura,
            editingItemForm.cantidad,
          ) == null
        ) {
          setItemsError('Ingrese las medidas necesarias para calcular la cantidad.');
          return;
        }
      }
      const icEdit = itemCatalogPayloadFromFormFields(
        editingItemForm.unidad,
        editingItemForm.largo,
        editingItemForm.ancho,
        editingItemForm.altura,
        editingItemForm.cantidad,
      );
      const res = await fetch(`/api/admin/catalogos/items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subchapterId: editingItemForm.subchapterId.trim() || undefined,
          codigo: editingItemForm.codigo.trim(),
          descripcion: editingItemForm.descripcion.trim(),
          unidad: icEdit.unidad,
          precioUnitario: editingItemForm.precioUnitario.trim()
            ? Number(editingItemForm.precioUnitario.replace(',', '.'))
            : null,
          cantidad: icEdit.cantidad,
          largo: icEdit.largo,
          ancho: icEdit.ancho,
          altura: icEdit.altura,
          imagenUrl: editingItemForm.imagenUrl.trim() || null,
          ...fotoGeoPayload(editingItemForm),
          proveedorId: editingItemForm.proveedorId.trim(),
          isActive: editingItemForm.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setItemsError(data.error ?? 'No se pudo guardar');
        return;
      }
      await reloadItemsBudgetTree();
      setEditingItemId(null);
      setEditingItemForm({
        codigo: '',
        descripcion: '',
        unidad: '',
        precioUnitario: '',
        cantidad: '',
        largo: '',
        ancho: '',
        altura: '',
        imagenUrl: '',
        ...emptyFotoGeoFields(),
        proveedorId: '',
        isActive: true,
        subchapterId: '',
      });
    } catch {
      setItemsError('Error de conexión.');
    } finally {
      setItemsSaving(false);
    }
  };

  const deleteItem = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar ítem "${nombre}"?`)) return;
    setDeletingItemId(id);
    setItemsError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/items/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setItemsError(data.error ?? 'No se pudo eliminar');
        return;
      }
      await reloadItemsBudgetTree();
      if (editingItemId === id) {
        setEditingItemId(null);
        setEditingItemForm({
          codigo: '',
          descripcion: '',
          unidad: '',
          precioUnitario: '',
          cantidad: '',
          largo: '',
          ancho: '',
          altura: '',
          imagenUrl: '',
          ...emptyFotoGeoFields(),
          proveedorId: '',
          isActive: true,
          subchapterId: '',
        });
      }
    } catch {
      setItemsError('Error de conexión.');
    } finally {
      setDeletingItemId(null);
    }
  };

  const reloadFrentesObraAdmin = async () => {
    if (!frentesObraFilterProjectId) return;
    try {
      const res = await fetch(
        `/api/admin/catalogos/frentes-obra?projectId=${encodeURIComponent(frentesObraFilterProjectId)}`,
        { credentials: 'include' },
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) setFrentesObraAdmin(data.items);
    } catch {
      // ignore
    }
  };

  const createFrenteObraCatalog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!frentesObraFilterProjectId) {
      setFrentesObraError('Seleccione una obra.');
      return;
    }
    setFrentesObraSaving(true);
    setFrentesObraError(null);
    setFrentesObraMessage(null);
    try {
      const res = await fetch('/api/admin/catalogos/frentes-obra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: frentesObraFilterProjectId,
          nombre: frentesObraNewNombre.trim(),
          orden: frentesObraNewOrden,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFrentesObraError(data.error ?? 'No se pudo crear');
        return;
      }
      setFrentesObraNewNombre('');
      setFrentesObraNewOrden(0);
      await reloadFrentesObraAdmin();
      setFrentesObraMessage('Frente de obra creado.');
      setTimeout(() => setFrentesObraMessage(null), 3000);
    } catch {
      setFrentesObraError('Error de conexión.');
    } finally {
      setFrentesObraSaving(false);
    }
  };

  const saveEditFrenteObra = async (id: string) => {
    setFrentesObraSaving(true);
    setFrentesObraError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/frentes-obra/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nombre: editingFrenteObraForm.nombre.trim(),
          orden: editingFrenteObraForm.orden,
          isActive: editingFrenteObraForm.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFrentesObraError(data.error ?? 'No se pudo guardar');
        return;
      }
      await reloadFrentesObraAdmin();
      setEditingFrenteObraId(null);
      setEditingFrenteObraForm({ nombre: '', orden: 0, isActive: true });
      setFrentesObraMessage('Actualizado.');
      setTimeout(() => setFrentesObraMessage(null), 2500);
    } catch {
      setFrentesObraError('Error de conexión.');
    } finally {
      setFrentesObraSaving(false);
    }
  };

  const deleteFrenteObraCatalog = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar frente de obra "${nombre}"? Los informes conservarán el texto guardado.`)) return;
    setDeletingFrenteObraId(id);
    setFrentesObraError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/frentes-obra/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        setFrentesObraError(data.error ?? 'No se pudo eliminar');
        return;
      }
      await reloadFrentesObraAdmin();
      if (editingFrenteObraId === id) {
        setEditingFrenteObraId(null);
        setEditingFrenteObraForm({ nombre: '', orden: 0, isActive: true });
      }
    } catch {
      setFrentesObraError('Error de conexión.');
    } finally {
      setDeletingFrenteObraId(null);
    }
  };

  const reloadJornadasAdmin = async () => {
    try {
      const res = await fetch('/api/admin/catalogos/jornadas', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) setJornadasAdmin(data.items);
    } catch {
      // ignore
    }
  };

  const createJornadaAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setJornadasAdminSaving(true);
    setJornadasAdminError(null);
    setJornadasAdminMessage(null);
    try {
      const res = await fetch('/api/admin/catalogos/jornadas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nombre: jornadaNew.nombre.trim(),
          horaInicio: normalizarHoraHHmm(jornadaNew.horaInicio),
          horaFin: normalizarHoraHHmm(jornadaNew.horaFin),
          orden: jornadaNew.orden,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJornadasAdminError(data.error ?? 'No se pudo crear');
        return;
      }
      await reloadJornadasAdmin();
      fetch('/api/catalogos/jornadas', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((d: { items?: { id: string; nombre: string; horaInicio: string; horaFin: string; orden: number }[] }) => {
          const list = Array.isArray(d.items) ? d.items : [];
          setJornadasCatalog(list);
        })
        .catch(() => {});
      setJornadaNew({ nombre: '', horaInicio: '06:00', horaFin: '18:00', orden: 0 });
      setJornadasAdminMessage('Jornada creada.');
      setTimeout(() => setJornadasAdminMessage(null), 3000);
    } catch {
      setJornadasAdminError('Error de conexión.');
    } finally {
      setJornadasAdminSaving(false);
    }
  };

  const saveEditJornadaAdmin = async (id: string) => {
    setJornadasAdminSaving(true);
    setJornadasAdminError(null);
    try {
      const res = await fetch(`/api/admin/catalogos/jornadas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          nombre: editingJornadaForm.nombre.trim(),
          horaInicio: normalizarHoraHHmm(editingJornadaForm.horaInicio),
          horaFin: normalizarHoraHHmm(editingJornadaForm.horaFin),
          orden: editingJornadaForm.orden,
          isActive: editingJornadaForm.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJornadasAdminError(data.error ?? 'No se pudo guardar');
        return;
      }
      await reloadJornadasAdmin();
      fetch('/api/catalogos/jornadas', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((d: { items?: { id: string; nombre: string; horaInicio: string; horaFin: string; orden: number }[] }) => {
          const list = Array.isArray(d.items) ? d.items : [];
          setJornadasCatalog(list);
        })
        .catch(() => {});
      setEditingJornadaId(null);
      setJornadasAdminMessage('Jornada actualizada.');
      setTimeout(() => setJornadasAdminMessage(null), 3000);
    } catch {
      setJornadasAdminError('Error de conexión.');
    } finally {
      setJornadasAdminSaving(false);
    }
  };

  /** Informe diario cerrado en BD (4 firmas): solo lectura para obra+fecha+jornada. La fecha sigue editable para cambiar de día. */
  const informeBloqueado = informeCerrado;

  /** Texto para dejar explícita la clave del registro: obra + fecha + jornada (único en BD). */
  const informeClaveLinea = useMemo(() => {
    const obra = obrasForInforme.find((o) => o.id === selectedObraId);
    const obraTxt = obra ? `${obra.code} – ${obra.name}` : selectedObraId || '—';
    const j = jornadasCatalog.find((x) => x.id === selectedJornadaId);
    const jornadaTxt = j ? `${j.nombre} (${j.horaInicio} – ${j.horaFin})` : selectedJornadaId || '—';
    const fechaIso = (datosGeneralesForm.fechaReporte || '').trim() || new Date().toISOString().slice(0, 10);
    let fechaFmt = fechaIso;
    try {
      const d = new Date(`${fechaIso}T12:00:00`);
      if (!Number.isNaN(d.getTime())) {
        fechaFmt = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }
    } catch {
      // mantener fechaIso
    }
    return { obraTxt, jornadaTxt, fechaFmt };
  }, [obrasForInforme, selectedObraId, jornadasCatalog, selectedJornadaId, datosGeneralesForm.fechaReporte]);

  const informeFieldsetStyle: CSSProperties = {
    border: 'none',
    padding: 0,
    margin: 0,
    minWidth: 0,
  };

  function computeHorasTotales(entrada: string, salida: string): string {
    if (!entrada || !salida) return '0h 0m';
    const [eh, em] = entrada.split(':').map(Number);
    const [sh, sm] = salida.split(':').map(Number);
    let min = (sh * 60 + sm) - (eh * 60 + em);
    if (min < 0) min += 24 * 60;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
  }

  const horasTotalesDisplay = computeHorasTotales(datosGeneralesForm.horaEntrada, datosGeneralesForm.horaSalida);

  const { frenteSelectOptions, frenteSelectValue } = useMemo(() => {
    const base = frentesObraOptions.map((o) => ({ id: o.id, nombre: o.nombre }));
    const out = [...base];
    const cid = (datosGeneralesForm.frenteObraCatalogoId ?? '').trim();
    const txt = (datosGeneralesForm.frenteObra ?? '').trim();
    if (cid && cid !== 'local' && !base.some((o) => o.id === cid)) {
      out.unshift({
        id: cid,
        nombre: txt ? `${txt} (referencia antigua)` : '(Frente no disponible en el catálogo)',
      });
    }
    const matchedByName = txt ? base.find((o) => o.nombre === txt) : undefined;
    if (txt && !matchedByName && (!cid || cid === 'local')) {
      out.unshift({ id: 'local', nombre: txt });
    }
    let value = '';
    if (cid === 'local') value = 'local';
    else if (cid) value = cid;
    else if (txt && matchedByName) value = matchedByName.id;
    else if (txt) value = 'local';
    return { frenteSelectOptions: out, frenteSelectValue: value };
  }, [frentesObraOptions, datosGeneralesForm.frenteObra, datosGeneralesForm.frenteObraCatalogoId]);

  const { contratSelectOptions, contratSelectValue } = useMemo(() => {
    const base = contratistasOptions.map((o) => ({ id: o.id, cedula: o.cedula, nombre: o.nombre }));
    const out = [...base];

    const cid = (datosGeneralesForm.contratistaCatalogoId ?? '').trim();
    const txt = (datosGeneralesForm.contratista ?? '').trim();

    // Si viene un id pero aún no está en opciones (por timing), insertamos una opción “ref.”
    if (cid && cid !== 'local' && !base.some((o) => o.id === cid)) {
      out.unshift({
        id: cid,
        cedula: '',
        nombre: txt ? txt : '(Contratista no disponible en el catálogo)',
      });
    }

    if (txt && (!cid || cid === 'local')) {
      if (!base.some((o) => o.id === 'local')) out.unshift({ id: 'local', cedula: '', nombre: txt });
    }

    let value = '';
    if (cid === 'local') value = 'local';
    else if (cid) value = cid;
    else if (txt) value = 'local';

    return { contratSelectOptions: out, contratSelectValue: value };
  }, [contratistasOptions, datosGeneralesForm.contratista, datosGeneralesForm.contratistaCatalogoId]);

  const { encargadoSelectOptions, encargadoSelectValue } = useMemo(() => {
    const base = encargadosOptions.map((o) => ({ id: o.id, cedula: o.cedula, nombre: o.nombre }));
    const out = [...base];

    const cid = (datosGeneralesForm.encargadoReporteCatalogoId ?? '').trim();
    const txt = (datosGeneralesForm.encargadoReporte ?? '').trim();

    if (cid && cid !== 'local' && !base.some((o) => o.id === cid)) {
      out.unshift({
        id: cid,
        cedula: '',
        nombre: txt ? txt : '(Encargado no disponible en el catálogo)',
      });
    }

    if (txt && (!cid || cid === 'local')) {
      if (!base.some((o) => o.id === 'local')) out.unshift({ id: 'local', cedula: '', nombre: txt });
    }

    let value = '';
    if (cid === 'local') value = 'local';
    else if (cid) value = cid;
    else if (txt) value = 'local';

    return { encargadoSelectOptions: out, encargadoSelectValue: value };
  }, [encargadosOptions, datosGeneralesForm.encargadoReporte, datosGeneralesForm.encargadoReporteCatalogoId]);

  const { cargoSelectOptions, cargoSelectValue } = useMemo(() => {
    type Cab = { id: string; nombre: string; consecutivo?: number | null };
    const base: Cab[] = cargosOptions.map((o) => ({
      id: o.id,
      nombre: o.nombre,
      consecutivo: o.consecutivo,
    }));
    const out: Cab[] = [...base];

    const cid = (datosGeneralesForm.cargoCatalogoId ?? '').trim();
    const txt = (datosGeneralesForm.cargo ?? '').trim();

    if (cid && cid !== 'local' && !base.some((o) => o.id === cid)) {
      out.unshift({
        id: cid,
        nombre: txt ? txt : '(Cargo no disponible en el catálogo)',
        consecutivo: undefined,
      });
    }

    if (txt && (!cid || cid === 'local')) {
      if (!base.some((o) => o.id === 'local')) out.unshift({ id: 'local', nombre: txt, consecutivo: undefined });
    }

    let value = '';
    if (cid === 'local') value = 'local';
    else if (cid) value = cid;
    else if (txt) value = 'local';

    return { cargoSelectOptions: out, cargoSelectValue: value };
  }, [cargosOptions, datosGeneralesForm.cargo, datosGeneralesForm.cargoCatalogoId]);

  const startVoiceCapture = async (
    field:
      | 'contratista'
      | 'encargadoReporte'
      | 'cargo'
      | 'suspensionDraftMotivo'
      | 'editSuspensionMotivo'
      | 'personalDraftNombre'
      | 'personalDraftCargo'
      | 'personalDraftSubcontratista'
      | 'equipoDraftDescripcion'
      | 'equipoDraftPlaca'
      | 'equipoDraftObservacion'
      | 'ingresoDraftProveedor'
      | 'ingresoDraftTipoMaterial'
      | 'ingresoDraftNoRemision'
      | 'ingresoDraftUnidad'
      | 'ingresoDraftObservacion'
      | 'entregaDraftTipoMaterial'
      | 'entregaDraftUnidad'
      | 'entregaDraftContratista'
      | 'entregaDraftObservacion'
      | 'actividadDraftObservacion'
      | 'actividadObservacion',
    actividadIdx?: number,
  ) => {
    const setVoiceError =
      field === 'suspensionDraftMotivo' || field === 'editSuspensionMotivo'
        ? setJornadaError
        : field === 'personalDraftNombre' ||
            field === 'personalDraftCargo' ||
            field === 'personalDraftSubcontratista'
          ? setPersonalError
          : field === 'equipoDraftDescripcion' || field === 'equipoDraftPlaca' || field === 'equipoDraftObservacion'
            ? setEquiposError
            : field === 'ingresoDraftProveedor' ||
                field === 'ingresoDraftTipoMaterial' ||
                field === 'ingresoDraftNoRemision' ||
                field === 'ingresoDraftUnidad' ||
                field === 'ingresoDraftObservacion'
              ? setIngresoError
              : field === 'entregaDraftTipoMaterial' ||
                  field === 'entregaDraftUnidad' ||
                  field === 'entregaDraftContratista' ||
                  field === 'entregaDraftObservacion'
                ? setEntregaError
                : field === 'actividadDraftObservacion' || field === 'actividadObservacion'
                ? setActividadError
                : setInformeError;

    const allowInsecureLanVoice = voiceInsecureDevOriginMatch();
    if (typeof window !== 'undefined' && !window.isSecureContext && !allowInsecureLanVoice) {
      setVoiceError(
        'El dictado requiere una página segura (https o localhost). En el celular use: npm run dev:https y abra https://SU_IP:3000 (acepte la advertencia del certificado), o un túnel tipo ngrok.',
      );
      return;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setVoiceError(
        'Dictado no disponible en este navegador. En Android use Chrome actualizado; evite WebView o navegadores sin soporte de reconocimiento de voz.',
      );
      return;
    }

    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        stream.getTracks().forEach((t) => t.stop());
      } catch (err: any) {
        const name = String(err?.name ?? '');
        const denied = name === 'NotAllowedError' || name === 'PermissionDeniedError';
        const lanHint =
          allowInsecureLanVoice && typeof window !== 'undefined' && !window.isSecureContext
            ? ` En el PC ejecute «npm run dev:https» y en el celular abra https://${window.location.host}/… (aviso del certificado: Avanzado → continuar). Alternativa: chrome://flags → «Insecure origins treated as secure» → ${window.location.origin}.`
            : '';
        setVoiceError(
          denied
            ? 'Micrófono bloqueado. En Chrome: candado del sitio → Micrófono → Permitir; en Android también Ajustes → Apps → Chrome → Permisos.' +
                lanHint
            : name === 'SecurityError'
              ? 'El navegador bloqueó el micrófono en http por IP. Use la flag “Insecure origins treated as secure” con esta URL o sirva el sitio con https.' +
                lanHint
              : 'No se pudo usar el micrófono. Cierre otras apps que lo usen (llamadas, grabadora) e intente de nuevo.' + lanHint,
        );
        return;
      }
    }

    try {
      try {
        speechRecognitionRef.current?.abort();
      } catch {
        /* noop */
      }

      const recognition = new SpeechRecognitionCtor();
      speechRecognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.lang = 'es-CO';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const transcript = event?.results?.[0]?.[0]?.transcript ?? '';
        const text = String(transcript).trim();
        if (!text) return;
        if (field === 'suspensionDraftMotivo') {
          setSuspensionDraft((prev) => ({ ...prev, motivoSuspension: text }));
          return;
        }
        if (field === 'editSuspensionMotivo') {
          setEditSuspensionDraft((prev) => ({ ...prev, motivoSuspension: text }));
          return;
        }
        if (field === 'personalDraftNombre') {
          setPersonalDraft((d) => ({ ...d, nombre: text }));
          return;
        }
        if (field === 'personalDraftCargo') {
          setPersonalDraft((d) => ({ ...d, cargo: text }));
          return;
        }
        if (field === 'personalDraftSubcontratista') {
          setPersonalDraft((d) => ({ ...d, subcontratista: text }));
          return;
        }
        if (field === 'equipoDraftDescripcion') {
          setEquipoDraft((d) => ({ ...d, descripcion: text }));
          return;
        }
        if (field === 'equipoDraftPlaca') {
          setEquipoDraft((d) => ({ ...d, placaRef: text }));
          return;
        }
        if (field === 'equipoDraftObservacion') {
          setEquipoDraft((d) => ({ ...d, observacion: text }));
          return;
        }
        if (field === 'ingresoDraftProveedor') {
          setIngresoDraft((d) => ({ ...d, proveedor: text }));
          return;
        }
        if (field === 'ingresoDraftTipoMaterial') {
          setIngresoDraft((d) => ({ ...d, tipoMaterial: text }));
          return;
        }
        if (field === 'ingresoDraftNoRemision') {
          setIngresoDraft((d) => ({ ...d, noRemision: text }));
          return;
        }
        if (field === 'ingresoDraftUnidad') {
          setIngresoDraft((d) => ({ ...d, unidad: text }));
          return;
        }
        if (field === 'ingresoDraftObservacion') {
          setIngresoDraft((d) => ({ ...d, observacion: text }));
          return;
        }
        if (field === 'entregaDraftTipoMaterial') {
          setEntregaDraft((d) => ({ ...d, tipoMaterial: text }));
          return;
        }
        if (field === 'entregaDraftUnidad') {
          setEntregaDraft((d) => ({ ...d, unidad: text }));
          return;
        }
        if (field === 'entregaDraftContratista') {
          setEntregaDraft((d) => ({ ...d, contratista: text }));
          return;
        }
        if (field === 'entregaDraftObservacion') {
          setEntregaDraft((d) => ({ ...d, observacion: text }));
          return;
        }
        if (field === 'actividadDraftObservacion') {
          updateActividadDraft({ observacion: text });
          return;
        }
        if (field === 'actividadObservacion') {
          if (typeof actividadIdx === 'number') {
            updateActividadRow(actividadIdx, { observacion: text });
          }
          return;
        }
        setDatosGeneralesForm((prev) => ({ ...prev, [field]: text } as any));
      };
      recognition.onerror = (ev: any) => {
        const code = String(ev?.error ?? '');
        if (code === 'aborted') return;
        const perm = 'Permiso de micrófono denegado o bloqueado. Revíselo en ajustes del sitio o del navegador.';
        const net =
          'El dictado en Android usa servicios de Google y requiere internet. Si falla, pruebe otra red o escriba el texto.';
        const msgs: Record<string, string> = {
          'not-allowed': perm,
          'service-not-allowed': perm,
          network: net,
          'no-speech': 'No se detectó voz. Hable después del pitido e intente otra vez.',
          'audio-capture': 'No se pudo usar el micrófono. Compruebe que no esté en uso por otra app.',
        };
        setVoiceError(
          msgs[code] ?? 'No se pudo capturar voz. Verifique permisos del micrófono o escriba el texto.',
        );
      };
      recognition.onend = () => {
        if (speechRecognitionRef.current === recognition) speechRecognitionRef.current = null;
      };
      recognition.start();
    } catch {
      setVoiceError('No se pudo iniciar el dictado por voz.');
    }
  };

  const submitDatosGenerales = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObraId) {
      setInformeError('Seleccione una obra.');
      return;
    }
    if (!selectedJornadaId) {
      setInformeError('Seleccione una jornada.');
      return;
    }
    setSavingInforme(true);
    setInformeMessage(null);
    setInformeError(null);
    try {
      const cid = (datosGeneralesForm.frenteObraCatalogoId ?? '').trim();
      const frenteBody: Record<string, string> = {};
      if (cid && cid !== 'local') {
        frenteBody.frenteObraCatalogoId = cid;
      } else if ((datosGeneralesForm.frenteObra ?? '').trim()) {
        frenteBody.frenteObra = datosGeneralesForm.frenteObra.trim();
      }
      const res = await fetch('/api/informes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedObraId,
          date: datosGeneralesForm.fechaReporte,
          jornadaId: selectedJornadaId,
          ...frenteBody,
          contratistaCatalogoId: datosGeneralesForm.contratistaCatalogoId || undefined,
          contratista: datosGeneralesForm.contratista || undefined,
          encargadoReporteCatalogoId: datosGeneralesForm.encargadoReporteCatalogoId || undefined,
          encargadoReporte: datosGeneralesForm.encargadoReporte || undefined,
          cargoCatalogoId: datosGeneralesForm.cargoCatalogoId || undefined,
          cargo: datosGeneralesForm.cargo || undefined,
          horaEntrada: datosGeneralesForm.horaEntrada || undefined,
          horaSalida: datosGeneralesForm.horaSalida || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInformeError(data.error ?? 'No se pudo guardar el informe');
        return;
      }
      setInformeMessage('Informe guardado correctamente.');
      setTimeout(() => setInformeMessage(null), 4000);
    } catch {
      setInformeError('Error de conexión.');
    } finally {
      setSavingInforme(false);
    }
  };

  const validarHorasSuspensionEnJornada = (horaSuspension: string, horaReinicio: string): boolean => {
    const jr = jornadasCatalog.find((j) => j.id === selectedJornadaId);
    if (!jr) return true;
    const ini = normalizarHoraHHmm(jr.horaInicio);
    const fin = normalizarHoraHHmm(jr.horaFin);
    const okSusp = estaHoraDentroDeJornada(horaSuspension, jr.horaInicio, jr.horaFin);
    const okRein = estaHoraDentroDeJornada(horaReinicio, jr.horaInicio, jr.horaFin);
    if (!okSusp || !okRein) {
      setJornadaRangoAlert(
        `Las horas de suspensión y de reinicio deben quedar dentro del rango de la jornada seleccionada (${ini} – ${fin}). Ajuste los horarios o elija otra jornada arriba.`,
      );
      return false;
    }
    return true;
  };

  const agregarSuspension = async () => {
    setJornadaError(null);
    setJornadaMessage(null);
    if (!selectedObraId || !selectedJornadaId) {
      setJornadaError('Seleccione obra y jornada.');
      return;
    }
    const motivo = suspensionDraft.motivoSuspension.trim();
    const hS = suspensionDraft.horaSuspension.trim();
    const hR = suspensionDraft.horaReinicio.trim();
    const tc = suspensionDraft.tipoClima.trim();
    if (!motivo || !hS || !hR || !tc) {
      setJornadaError('Complete motivo, horas de suspensión y reinicio, y tipo.');
      return;
    }
    if (!validarHorasSuspensionEnJornada(hS, hR)) return;
    const horas = horasDraftCalculadas;
    if (horas <= 0) {
      setJornadaError('La duración entre suspensión y reinicio debe ser mayor a 0.');
      return;
    }
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);
    setSavingSuspension(true);
    try {
      const res = await fetch('/api/informes/suspensiones', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedObraId,
          date,
          jornadaId: selectedJornadaId,
          motivoSuspension: motivo,
          horaSuspension: hS,
          horaReinicio: hR,
          tipoClima: tc,
          horasClima: horas,
          imagenUrl: suspensionDraft.imagenUrl.trim() || null,
          ...fotoGeoPayload(suspensionDraft),
        }),
      });
      const data = (await res.json()) as { error?: string; item?: SuspensionRow };
      if (!res.ok) {
        setJornadaError(data.error ?? 'No se pudo guardar');
        return;
      }
      if (data.item) {
        setSuspensionesRows((prev) => [...prev, data.item!]);
      }
      setSuspensionDraft({ motivoSuspension: '', horaSuspension: '', horaReinicio: '', tipoClima: '', imagenUrl: '', ...emptyFotoGeoFields() });
      setJornadaMessage('Suspensión registrada.');
      setTimeout(() => setJornadaMessage(null), 3000);
    } catch {
      setJornadaError('Error de conexión.');
    } finally {
      setSavingSuspension(false);
    }
  };

  const iniciarEdicionSuspension = (row: SuspensionRow) => {
    setEditingSuspensionId(row.id);
    setEditSuspensionDraft({
      motivoSuspension: row.motivoSuspension,
      horaSuspension: row.horaSuspension,
      horaReinicio: row.horaReinicio,
      tipoClima: row.tipoClima,
      imagenUrl: row.imagenUrl ?? '',
      ...fotoGeoFromSource(row),
    });
    setJornadaError(null);
  };

  const cancelarEdicionSuspension = () => {
    setEditingSuspensionId(null);
    setEditSuspensionDraft({
      motivoSuspension: '',
      horaSuspension: '',
      horaReinicio: '',
      tipoClima: '',
      imagenUrl: '',
      ...emptyFotoGeoFields(),
    });
  };

  const guardarEdicionSuspension = async () => {
    if (!editingSuspensionId) return;
    const motivo = editSuspensionDraft.motivoSuspension.trim();
    const hS = editSuspensionDraft.horaSuspension.trim();
    const hR = editSuspensionDraft.horaReinicio.trim();
    const tc = editSuspensionDraft.tipoClima.trim();
    if (!motivo || !hS || !hR || !tc) {
      setJornadaError('Complete todos los campos.');
      return;
    }
    if (!validarHorasSuspensionEnJornada(hS, hR)) return;
    const horas = horasEditCalculadas;
    if (horas <= 0) {
      setJornadaError('La duración debe ser mayor a 0.');
      return;
    }
    setSavingSuspension(true);
    setJornadaError(null);
    try {
      const res = await fetch(`/api/informes/suspensiones/${encodeURIComponent(editingSuspensionId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          motivoSuspension: motivo,
          horaSuspension: hS,
          horaReinicio: hR,
          tipoClima: tc,
          horasClima: horas,
          imagenUrl: editSuspensionDraft.imagenUrl.trim() || null,
          ...fotoGeoPayload(editSuspensionDraft),
        }),
      });
      const data = (await res.json()) as { error?: string; item?: SuspensionRow };
      if (!res.ok) {
        setJornadaError(data.error ?? 'No se pudo actualizar');
        return;
      }
      if (data.item) {
        setSuspensionesRows((prev) => prev.map((r) => (r.id === data.item!.id ? data.item! : r)));
      }
      cancelarEdicionSuspension();
      setJornadaMessage('Suspensión actualizada.');
      setTimeout(() => setJornadaMessage(null), 3000);
    } catch {
      setJornadaError('Error de conexión.');
    } finally {
      setSavingSuspension(false);
    }
  };

  const eliminarSuspension = async (id: string) => {
    if (informeBloqueado) return;
    if (!window.confirm('¿Eliminar esta suspensión?')) return;
    setJornadaError(null);
    try {
      const res = await fetch(`/api/informes/suspensiones/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setJornadaError(data.error ?? 'No se pudo eliminar');
        return;
      }
      if (editingSuspensionId === id) cancelarEdicionSuspension();
      setSuspensionesRows((prev) => prev.filter((r) => r.id !== id));
      setJornadaMessage('Suspensión eliminada.');
      setTimeout(() => setJornadaMessage(null), 3000);
    } catch {
      setJornadaError('Error de conexión.');
    }
  };

  const cancelPersonalDraft = () => {
    setPersonalDraft(emptyPersonalDraft());
    setPersonalEditingIndex(null);
    setPersonalError(null);
  };

  const startEditPersonal = (idx: number) => {
    const r = personalRows[idx];
    if (!r) return;
    setPersonalDraft({
      nombre: r.nombre,
      cargo: r.cargo,
      subcontratista: r.subcontratista,
      horaEntrada: r.horaEntrada,
      horaSalida: r.horaSalida,
    });
    setPersonalEditingIndex(idx);
    setPersonalError(null);
  };

  const commitPersonalDraft = () => {
    const nombre = personalDraft.nombre.trim();
    if (!nombre) {
      setPersonalError('Indique nombre y apellidos.');
      return;
    }
    setPersonalError(null);
    if (personalEditingIndex !== null) {
      const idx = personalEditingIndex;
      setPersonalRows((prev) =>
        prev.map((row, i) =>
          i === idx
            ? {
                ...row,
                nombre: personalDraft.nombre.trim(),
                cargo: personalDraft.cargo.trim(),
                subcontratista: personalDraft.subcontratista.trim(),
                horaEntrada: personalDraft.horaEntrada,
                horaSalida: personalDraft.horaSalida,
              }
            : row,
        ),
      );
      setPersonalEditingIndex(null);
    } else {
      setPersonalRows((prev) => [
        ...prev,
        {
          nombre: personalDraft.nombre.trim(),
          cargo: personalDraft.cargo.trim(),
          subcontratista: personalDraft.subcontratista.trim(),
          horaEntrada: personalDraft.horaEntrada,
          horaSalida: personalDraft.horaSalida,
        },
      ]);
    }
    setPersonalDraft(emptyPersonalDraft());
  };

  const removePersonalRow = (idx: number) => {
    if (personalEditingIndex === idx) {
      setPersonalEditingIndex(null);
      setPersonalDraft(emptyPersonalDraft());
    } else if (personalEditingIndex !== null && idx < personalEditingIndex) {
      setPersonalEditingIndex(personalEditingIndex - 1);
    }
    setPersonalRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const savePersonal = async () => {
    if (!selectedObraId) {
      setPersonalError('Seleccione una obra.');
      return;
    }
    if (!selectedJornadaId) {
      setPersonalError('Seleccione una jornada.');
      return;
    }
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);
    setSavingPersonal(true);
    setPersonalMessage(null);
    setPersonalError(null);
    try {
      const res = await fetch('/api/informes/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedObraId,
          date,
          jornadaId: selectedJornadaId,
          personal: personalRows.map((r) => ({
            nombre: r.nombre,
            cargo: r.cargo,
            subcontratista: r.subcontratista,
            horaEntrada: r.horaEntrada,
            horaSalida: r.horaSalida,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPersonalError(data.error ?? 'No se pudo guardar');
        return;
      }
      const list = Array.isArray(data.personal) ? data.personal : [];
      setPersonalRows(
        list.map((p: any) => ({
          id: p.id,
          nombre: p.nombre ?? '',
          cargo: p.cargo ?? '',
          subcontratista: p.subcontratista ?? '',
          horaEntrada: p.horaEntrada ?? '',
          horaSalida: p.horaSalida ?? '',
        })),
      );
      setPersonalMessage('Personal guardado.');
      setPersonalDraft(emptyPersonalDraft());
      setPersonalEditingIndex(null);
      setTimeout(() => setPersonalMessage(null), 2500);
    } catch {
      setPersonalError('Error de conexión.');
    } finally {
      setSavingPersonal(false);
    }
  };

  const cancelEquipoDraft = () => {
    setEquipoDraft(emptyEquipoDraft());
    setEquipoEditingIndex(null);
    setEquiposError(null);
  };

  const addEquipoHorarioDraft = () => {
    const horaIngreso = equipoDraft.horaIngreso.trim();
    const horaSalida = equipoDraft.horaSalida.trim();
    if (!horaIngreso || !horaSalida) {
      setEquiposError('Indique hora de ingreso y hora de salida para agregar el horario.');
      return;
    }
    const horasTrabajadas = computeEquipoHorasDecimal(horaIngreso, horaSalida);
    if (horasTrabajadas <= 0) {
      setEquiposError('Las horas trabajadas del horario deben ser mayores a 0.');
      return;
    }
    setEquipoDraft((prev) => ({
      ...prev,
      horaIngreso: '',
      horaSalida: '',
      horasTrabajadas: 0,
      horarios: [...prev.horarios, { horaIngreso, horaSalida, horasTrabajadas }],
    }));
    setEquiposError(null);
  };

  const removeEquipoHorarioDraft = (idx: number) => {
    setEquipoDraft((prev) => ({
      ...prev,
      horarios: prev.horarios.filter((_, i) => i !== idx),
    }));
  };

  const startEditEquipo = (idx: number) => {
    const r = equiposRows[idx];
    if (!r) return;
    setEquipoDraft({
      descripcion: r.descripcion,
      placaRef: r.placaRef,
      propiedad: r.propiedad,
      estado: r.estado,
      observacion: r.observacion,
      imagenUrl: r.imagenUrl,
      ...fotoGeoFromSource(r),
      horaIngreso: '',
      horaSalida: '',
      horasTrabajadas: 0,
      horarios: [...r.horarios],
    });
    setEquipoEditingIndex(idx);
    setEquiposError(null);
  };

  const commitEquipoDraft = () => {
    if (!equipoDraft.descripcion.trim()) {
      setEquiposError('Indique la descripción del equipo.');
      return;
    }
    const pendingHoraIngreso = equipoDraft.horaIngreso.trim();
    const pendingHoraSalida = equipoDraft.horaSalida.trim();
    const nextHorarios = [...equipoDraft.horarios];
    if (pendingHoraIngreso || pendingHoraSalida) {
      if (!pendingHoraIngreso || !pendingHoraSalida) {
        setEquiposError('Complete hora de ingreso y hora de salida, o agregue un horario ya completo.');
        return;
      }
      const pendingHoras = computeEquipoHorasDecimal(pendingHoraIngreso, pendingHoraSalida);
      if (pendingHoras <= 0) {
        setEquiposError('Las horas trabajadas del horario deben ser mayores a 0.');
        return;
      }
      nextHorarios.push({
        horaIngreso: pendingHoraIngreso,
        horaSalida: pendingHoraSalida,
        horasTrabajadas: pendingHoras,
      });
    }
    setEquiposError(null);
    if (equipoEditingIndex !== null) {
      const idx = equipoEditingIndex;
      setEquiposRows((prev) =>
        prev.map((row, i) =>
          i === idx
            ? {
                ...row,
                descripcion: equipoDraft.descripcion.trim(),
                placaRef: equipoDraft.placaRef.trim(),
                propiedad: equipoDraft.propiedad,
                estado: equipoDraft.estado,
                observacion: equipoDraft.observacion.trim(),
                imagenUrl: equipoDraft.imagenUrl.trim(),
                ...fotoGeoPayload(equipoDraft),
                horaIngreso: nextHorarios[0]?.horaIngreso ?? '',
                horaSalida: nextHorarios[nextHorarios.length - 1]?.horaSalida ?? '',
                horasTrabajadas: sumEquipoHorarios(nextHorarios),
                horarios: nextHorarios,
              }
            : row,
        ),
      );
      setEquipoEditingIndex(null);
    } else {
      setEquiposRows((prev) => [
        ...prev,
        {
          descripcion: equipoDraft.descripcion.trim(),
          placaRef: equipoDraft.placaRef.trim(),
          propiedad: equipoDraft.propiedad,
          estado: equipoDraft.estado,
          observacion: equipoDraft.observacion.trim(),
          imagenUrl: equipoDraft.imagenUrl.trim(),
          ...fotoGeoPayload(equipoDraft),
          horaIngreso: nextHorarios[0]?.horaIngreso ?? '',
          horaSalida: nextHorarios[nextHorarios.length - 1]?.horaSalida ?? '',
          horasTrabajadas: sumEquipoHorarios(nextHorarios),
          horarios: nextHorarios,
        },
      ]);
    }
    setEquipoDraft(emptyEquipoDraft());
  };

  const removeEquipoRow = (idx: number) => {
    if (equipoEditingIndex === idx) {
      setEquipoEditingIndex(null);
      setEquipoDraft(emptyEquipoDraft());
    } else if (equipoEditingIndex !== null && idx < equipoEditingIndex) {
      setEquipoEditingIndex(equipoEditingIndex - 1);
    }
    setEquiposRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveEquipos = async () => {
    if (!selectedObraId) {
      setEquiposError('Seleccione una obra.');
      return;
    }
    if (!selectedJornadaId) {
      setEquiposError('Seleccione una jornada.');
      return;
    }
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);
    setSavingEquipos(true);
    setEquiposMessage(null);
    setEquiposError(null);
    try {
      const res = await fetch('/api/informes/equipos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedObraId,
          date,
          jornadaId: selectedJornadaId,
          equipos: equiposRows.map((e) => ({
            descripcion: e.descripcion,
            placaRef: e.placaRef,
            propiedad: e.propiedad,
            estado: e.estado,
            observacion: e.observacion,
            imagenUrl: e.imagenUrl,
            ...fotoGeoPayload(e),
            horaIngreso: e.horaIngreso,
            horaSalida: e.horaSalida,
            horasTrabajadas: Number(e.horasTrabajadas),
            horarios: e.horarios.map((h) => ({
              horaIngreso: h.horaIngreso,
              horaSalida: h.horaSalida,
              horasTrabajadas: Number(h.horasTrabajadas),
            })),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEquiposError(data.error ?? 'No se pudo guardar');
        return;
      }
      const list = Array.isArray(data.equipos) ? data.equipos : [];
      setEquiposRows(
        list.map((e: any) => {
          const horarios = Array.isArray(e.horarios)
            ? e.horarios.map((h: any) => ({
                horaIngreso: h.horaIngreso ?? '',
                horaSalida: h.horaSalida ?? '',
                horasTrabajadas: Number(h.horasTrabajadas ?? 0),
              }))
            : [];
          const fallbackHorarios =
            horarios.length > 0
              ? horarios
              : e.horaIngreso || e.horaSalida
                ? [
                    {
                      horaIngreso: e.horaIngreso ?? '',
                      horaSalida: e.horaSalida ?? '',
                      horasTrabajadas: Number(e.horasTrabajadas ?? 0),
                    },
                  ]
                : [];
          return {
            id: e.id,
            descripcion: e.descripcion ?? '',
            placaRef: e.placaRef ?? '',
            propiedad: e.propiedad ?? '',
            estado: e.estado ?? '',
            observacion: e.observacion ?? '',
            imagenUrl: e.imagenUrl ?? '',
            ...fotoGeoFromSource(e),
            horaIngreso: fallbackHorarios[0]?.horaIngreso ?? '',
            horaSalida: fallbackHorarios[fallbackHorarios.length - 1]?.horaSalida ?? '',
            horasTrabajadas: sumEquipoHorarios(fallbackHorarios),
            horarios: fallbackHorarios,
          };
        }),
      );
      setEquiposMessage('Equipos guardados.');
      setEquipoDraft(emptyEquipoDraft());
      setEquipoEditingIndex(null);
      setTimeout(() => setEquiposMessage(null), 2500);
    } catch {
      setEquiposError('Error de conexión.');
    } finally {
      setSavingEquipos(false);
    }
  };

  const cancelIngresoDraft = () => {
    setIngresoDraft(emptyIngresoDraft());
    setIngresoEditingIndex(null);
    setIngresoError(null);
  };

  const startEditIngreso = (idx: number) => {
    const r = ingresoRows[idx];
    if (!r) return;
    setIngresoDraft({
      proveedor: r.proveedor,
      tipoMaterial: r.tipoMaterial,
      noRemision: r.noRemision,
      unidad: r.unidad,
      cantidad: r.cantidad,
      observacion: r.observacion,
      imagenUrl: r.imagenUrl,
      ...fotoGeoFromSource(r),
    });
    setIngresoEditingIndex(idx);
    setIngresoError(null);
  };

  const commitIngresoDraft = () => {
    if (!ingresoDraft.proveedor.trim() && !ingresoDraft.tipoMaterial.trim()) {
      setIngresoError('Indique proveedor o tipo de material.');
      return;
    }
    setIngresoError(null);
    if (ingresoEditingIndex !== null) {
      const idx = ingresoEditingIndex;
      setIngresoRows((prev) =>
        prev.map((row, i) =>
          i === idx
            ? {
                ...row,
                proveedor: ingresoDraft.proveedor.trim(),
                tipoMaterial: ingresoDraft.tipoMaterial.trim(),
                noRemision: ingresoDraft.noRemision.trim(),
                unidad: ingresoDraft.unidad.trim(),
                cantidad: Number(ingresoDraft.cantidad) || 0,
                observacion: ingresoDraft.observacion.trim(),
                imagenUrl: ingresoDraft.imagenUrl.trim(),
                ...fotoGeoPayload(ingresoDraft),
              }
            : row,
        ),
      );
      setIngresoEditingIndex(null);
    } else {
      setIngresoRows((prev) => [
        ...prev,
        {
          proveedor: ingresoDraft.proveedor.trim(),
          tipoMaterial: ingresoDraft.tipoMaterial.trim(),
          noRemision: ingresoDraft.noRemision.trim(),
          unidad: ingresoDraft.unidad.trim(),
          cantidad: Number(ingresoDraft.cantidad) || 0,
          observacion: ingresoDraft.observacion.trim(),
          imagenUrl: ingresoDraft.imagenUrl.trim(),
          ...fotoGeoPayload(ingresoDraft),
        },
      ]);
    }
    setIngresoDraft(emptyIngresoDraft());
  };

  const removeIngresoRow = (idx: number) => {
    if (ingresoEditingIndex === idx) {
      setIngresoEditingIndex(null);
      setIngresoDraft(emptyIngresoDraft());
    } else if (ingresoEditingIndex !== null && idx < ingresoEditingIndex) {
      setIngresoEditingIndex(ingresoEditingIndex - 1);
    }
    setIngresoRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveIngresos = async () => {
    if (!selectedObraId) {
      setIngresoError('Seleccione una obra.');
      return;
    }
    if (!selectedJornadaId) {
      setIngresoError('Seleccione una jornada.');
      return;
    }
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);
    setSavingIngreso(true);
    setIngresoMessage(null);
    setIngresoError(null);
    try {
      const res = await fetch('/api/informes/material-ingresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedObraId,
          date,
          jornadaId: selectedJornadaId,
          ingresos: ingresoRows.map((m) => ({
            proveedor: m.proveedor,
            tipoMaterial: m.tipoMaterial,
            noRemision: m.noRemision,
            unidad: m.unidad,
            cantidad: Number(m.cantidad),
            observacion: m.observacion,
            imagenUrl: m.imagenUrl,
            ...fotoGeoPayload(m),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIngresoError(data.error ?? 'No se pudo guardar');
        return;
      }
      const list = Array.isArray(data.ingresos) ? data.ingresos : [];
      setIngresoRows(
        list.map((m: any) => ({
          id: m.id,
          proveedor: m.proveedor ?? '',
          tipoMaterial: m.tipoMaterial ?? '',
          noRemision: m.noRemision ?? '',
          unidad: m.unidad ?? '',
          cantidad: Number(m.cantidad ?? 0),
          observacion: m.observacion ?? '',
          imagenUrl: m.imagenUrl ?? '',
          ...fotoGeoFromSource(m),
        })),
      );
      setIngresoMessage('Ingreso de material guardado.');
      setIngresoDraft(emptyIngresoDraft());
      setIngresoEditingIndex(null);
      setTimeout(() => setIngresoMessage(null), 2500);
    } catch {
      setIngresoError('Error de conexión.');
    } finally {
      setSavingIngreso(false);
    }
  };

  const cancelEntregaDraft = () => {
    setEntregaDraft(emptyEntregaDraft());
    setEntregaEditingIndex(null);
    setEntregaError(null);
  };

  const startEditEntrega = (idx: number) => {
    const r = entregaRows[idx];
    if (!r) return;
    setEntregaDraft({
      tipoMaterial: r.tipoMaterial,
      unidad: r.unidad,
      cantidad: r.cantidad,
      contratista: r.contratista,
      firmaRecibido: r.firmaRecibido,
      observacion: r.observacion,
      imagenUrl: r.imagenUrl,
      ...fotoGeoFromSource(r),
    });
    setEntregaEditingIndex(idx);
    setEntregaError(null);
  };

  const commitEntregaDraft = () => {
    if (!entregaDraft.tipoMaterial.trim()) {
      setEntregaError('Indique el tipo de material.');
      return;
    }
    setEntregaError(null);
    if (entregaEditingIndex !== null) {
      const idx = entregaEditingIndex;
      setEntregaRows((prev) =>
        prev.map((row, i) =>
          i === idx
            ? {
                ...row,
                tipoMaterial: entregaDraft.tipoMaterial.trim(),
                unidad: entregaDraft.unidad.trim(),
                cantidad: Number(entregaDraft.cantidad) || 0,
                contratista: entregaDraft.contratista.trim(),
                firmaRecibido: entregaDraft.firmaRecibido,
                observacion: entregaDraft.observacion.trim(),
                imagenUrl: entregaDraft.imagenUrl.trim(),
                ...fotoGeoPayload(entregaDraft),
              }
            : row,
        ),
      );
      setEntregaEditingIndex(null);
    } else {
      setEntregaRows((prev) => [
        ...prev,
        {
          tipoMaterial: entregaDraft.tipoMaterial.trim(),
          unidad: entregaDraft.unidad.trim(),
          cantidad: Number(entregaDraft.cantidad) || 0,
          contratista: entregaDraft.contratista.trim(),
          firmaRecibido: entregaDraft.firmaRecibido,
          observacion: entregaDraft.observacion.trim(),
          imagenUrl: entregaDraft.imagenUrl.trim(),
          ...fotoGeoPayload(entregaDraft),
        },
      ]);
    }
    setEntregaDraft(emptyEntregaDraft());
  };

  const removeEntregaRow = (idx: number) => {
    if (entregaEditingIndex === idx) {
      setEntregaEditingIndex(null);
      setEntregaDraft(emptyEntregaDraft());
    } else if (entregaEditingIndex !== null && idx < entregaEditingIndex) {
      setEntregaEditingIndex(entregaEditingIndex - 1);
    }
    setEntregaRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveEntregas = async () => {
    if (!selectedObraId) {
      setEntregaError('Seleccione una obra.');
      return;
    }
    if (!selectedJornadaId) {
      setEntregaError('Seleccione una jornada.');
      return;
    }
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);
    setSavingEntrega(true);
    setEntregaMessage(null);
    setEntregaError(null);
    try {
      const res = await fetch('/api/informes/material-entregas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedObraId,
          date,
          jornadaId: selectedJornadaId,
          entregas: entregaRows.map((m) => ({
            tipoMaterial: m.tipoMaterial,
            unidad: m.unidad,
            cantidad: Number(m.cantidad),
            contratista: m.contratista,
            firmaRecibido: m.firmaRecibido,
            observacion: m.observacion,
            imagenUrl: m.imagenUrl,
            ...fotoGeoPayload(m),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEntregaError(data.error ?? 'No se pudo guardar');
        return;
      }
      const list = Array.isArray(data.entregas) ? data.entregas : [];
      setEntregaRows(
        list.map((m: any) => ({
          id: m.id,
          tipoMaterial: m.tipoMaterial ?? '',
          unidad: m.unidad ?? '',
          cantidad: Number(m.cantidad ?? 0),
          contratista: m.contratista ?? '',
          firmaRecibido: Boolean(m.firmaRecibido),
          observacion: m.observacion ?? '',
          imagenUrl: m.imagenUrl ?? '',
          ...fotoGeoFromSource(m),
        })),
      );
      setEntregaMessage('Material entregado guardado.');
      setEntregaDraft(emptyEntregaDraft());
      setEntregaEditingIndex(null);
      setTimeout(() => setEntregaMessage(null), 2500);
    } catch {
      setEntregaError('Error de conexión.');
    } finally {
      setSavingEntrega(false);
    }
  };

  const updateActividadDraft = (patch: Partial<typeof actividadDraft>) => {
    setActividadDraft((prev) => {
      const next = { ...prev, ...patch };
      const largo = typeof next.largo === 'number' ? next.largo : Number(next.largo ?? 0);
      const ancho = typeof next.ancho === 'number' ? next.ancho : Number(next.ancho ?? 0);
      const altura = typeof next.altura === 'number' ? next.altura : Number(next.altura ?? 0);
      const cantidadCalculada = Number.isFinite(largo * ancho * altura) ? largo * ancho * altura : 0;
      const cantidadManualEnPatch = patch.cantidadTotal !== undefined;
      const cantidadTotal = cantidadManualEnPatch
        ? Number(next.cantidadTotal ?? 0)
        : Number(next.cantidadTotal ?? 0) > 0
          ? Number(next.cantidadTotal ?? 0)
          : cantidadCalculada;
      return { ...next, largo, ancho, altura, cantidadTotal };
    });
  };

  const cancelActividadDraft = () => {
    setActividadDraft(emptyActividadDraft());
    setActividadEditingIndex(null);
    setActividadError(null);
  };

  const startEditActividad = (idx: number) => {
    const r = actividadRows[idx];
    if (!r) return;
    setActividadDraft({
      pk: r.pk,
      abscisado: r.abscisado,
      itemContractual: r.itemContractual,
      descripcion: r.descripcion,
      unidadMedida: r.unidadMedida,
      observacion: r.observacion,
      imagenUrl: r.imagenUrl ?? null,
      ...fotoGeoFromSource(r),
      largo: Number(r.largo ?? 0),
      ancho: Number(r.ancho ?? 0),
      altura: Number(r.altura ?? 0),
      cantidadTotal: Number(r.cantidadTotal ?? 0),
    });
    setActividadEditingIndex(idx);
    setActividadError(null);
  };

  const commitActividadDraft = () => {
    const selectedItem = itemsCatalogOptions.find((it) => it.codigo === actividadDraft.itemContractual);
    const normalizedDraft = {
      ...actividadDraft,
      descripcion: String(selectedItem?.descripcion ?? actividadDraft.descripcion ?? '').trim(),
      unidadMedida: String(selectedItem?.unidad ?? actividadDraft.unidadMedida ?? '').trim(),
      largo:
        selectedItem?.largo != null && Number.isFinite(Number(selectedItem.largo))
          ? Number(selectedItem.largo)
          : Number(actividadDraft.largo ?? 0),
      ancho:
        selectedItem?.ancho != null && Number.isFinite(Number(selectedItem.ancho))
          ? Number(selectedItem.ancho)
          : Number(actividadDraft.ancho ?? 0),
      altura:
        selectedItem?.altura != null && Number.isFinite(Number(selectedItem.altura))
          ? Number(selectedItem.altura)
          : Number(actividadDraft.altura ?? 0),
      cantidadTotal:
        selectedItem?.cantidad != null && Number.isFinite(Number(selectedItem.cantidad))
          ? Number(selectedItem.cantidad)
          : Number(actividadDraft.cantidadTotal ?? 0),
      imagenUrl: actividadDraft.imagenUrl ?? null,
      ...fotoGeoPayload(actividadDraft),
    };
    const cantidadCalculada = Number.isFinite(normalizedDraft.largo * normalizedDraft.ancho * normalizedDraft.altura)
      ? normalizedDraft.largo * normalizedDraft.ancho * normalizedDraft.altura
      : 0;
    const cantidadTotal = Number(normalizedDraft.cantidadTotal ?? 0) > 0
      ? Number(normalizedDraft.cantidadTotal ?? 0)
      : cantidadCalculada;
    const normalizedDraftWithTotal = { ...normalizedDraft, cantidadTotal };
    const invalid =
      !normalizedDraftWithTotal.pk.trim() ||
      !normalizedDraftWithTotal.abscisado.trim() ||
      !normalizedDraftWithTotal.itemContractual.trim() ||
      !normalizedDraftWithTotal.descripcion.trim() ||
      !normalizedDraftWithTotal.unidadMedida.trim() ||
      !(Number(normalizedDraftWithTotal.cantidadTotal) > 0);
    if (invalid) {
      setActividadError('Completa PK, Abscisado, Ítem contractual y Cantidad mayor a 0.');
      return;
    }
    setActividadError(null);
    if (actividadEditingIndex !== null) {
      const idx = actividadEditingIndex;
      setActividadRows((prev) => prev.map((row, i) => (i === idx ? { ...row, ...normalizedDraftWithTotal } : row)));
      setActividadEditingIndex(null);
    } else {
      setActividadRows((prev) => [...prev, { ...normalizedDraftWithTotal }]);
    }
    setActividadDraft(emptyActividadDraft());
  };

  const removeActividadRow = (idx: number) => {
    if (actividadEditingIndex === idx) {
      setActividadEditingIndex(null);
      setActividadDraft(emptyActividadDraft());
    } else if (actividadEditingIndex !== null && idx < actividadEditingIndex) {
      setActividadEditingIndex(actividadEditingIndex - 1);
    }
    setActividadRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateActividadRow = (
    idx: number,
    patch: Partial<(typeof actividadRows)[number]>,
  ) => {
    setActividadRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, ...patch };
        const largo = typeof next.largo === 'number' ? next.largo : Number(next.largo ?? 0);
        const ancho = typeof next.ancho === 'number' ? next.ancho : Number(next.ancho ?? 0);
        const altura = typeof next.altura === 'number' ? next.altura : Number(next.altura ?? 0);
        const cantidadCalculada = Number.isFinite(largo * ancho * altura) ? largo * ancho * altura : 0;
        const cantidadManualEnPatch = patch.cantidadTotal !== undefined;
        const cantidadTotal = cantidadManualEnPatch
          ? Number(next.cantidadTotal ?? 0)
          : Number(next.cantidadTotal ?? 0) > 0
            ? Number(next.cantidadTotal ?? 0)
            : cantidadCalculada;
        return { ...next, largo, ancho, altura, cantidadTotal };
      }),
    );
  };

  const saveActividades = async () => {
    if (!selectedObraId) {
      setActividadError('Seleccione una obra.');
      return;
    }
    if (!selectedJornadaId) {
      setActividadError('Seleccione una jornada.');
      return;
    }
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);

    const invalid = actividadRows.some(
      (r) =>
        !r.pk.trim() ||
        !r.abscisado.trim() ||
        !r.itemContractual.trim() ||
        !r.descripcion.trim() ||
        !r.unidadMedida.trim() ||
        !(Number(r.cantidadTotal) > 0),
    );
    if (actividadRows.length === 0) {
      setActividadError('Agrega al menos una actividad.');
      return;
    }
    if (invalid) {
      setActividadError('Completa PK, Abscisado, Ítem contractual, Descripción, Unidad y Cantidad mayor a 0.');
      return;
    }

    setSavingActividad(true);
    setActividadMessage(null);
    setActividadError(null);
    try {
      const res = await fetch('/api/informes/actividades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedObraId,
          date,
          jornadaId: selectedJornadaId,
          actividades: actividadRows.map((a) => ({
            pk: a.pk,
            abscisado: a.abscisado,
            itemContractual: a.itemContractual,
            descripcion: a.descripcion,
            unidadMedida: a.unidadMedida,
            observacion: Boolean(a.observacion.trim()),
            observacionTexto: a.observacion,
            imagenUrl: a.imagenUrl ?? null,
            ...fotoGeoPayload(a),
            largo: Number(a.largo),
            ancho: Number(a.ancho),
            altura: Number(a.altura),
            cantidadTotal: Number(a.cantidadTotal),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActividadError(data.error ?? 'No se pudo guardar');
        return;
      }
      const list = Array.isArray(data.actividades) ? data.actividades : [];
      setActividadRows(
        list.map((a: any) => ({
          id: a.id,
          pk: a.pk ?? '',
          abscisado: a.abscisado ?? '',
          itemContractual: a.itemContractual ?? '',
          descripcion: a.descripcion ?? '',
          unidadMedida: a.unidadMedida ?? '',
          observacion: String(a.observacionTexto ?? ''),
          imagenUrl: a.imagenUrl ?? null,
          ...fotoGeoFromSource(a),
          largo: Number(a.largo ?? 0),
          ancho: Number(a.ancho ?? 0),
          altura: Number(a.altura ?? 0),
          cantidadTotal: Number(a.cantidadTotal ?? 0),
        })),
      );
      setActividadMessage('Actividades guardadas.');
      setTimeout(() => setActividadMessage(null), 2500);
    } catch {
      setActividadError('Error de conexión.');
    } finally {
      setSavingActividad(false);
    }
  };

  const captureRegistroFotoGeo = useCallback(async (): Promise<FotoGeoFields> => {
    const base: FotoGeoFields = {
      ...emptyFotoGeoFields(),
      imagenTomadaEn: new Date().toISOString(),
    };
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return { ...base, imagenGeoEstado: 'unavailable' };
    }
    if (!window.isSecureContext && !voiceInsecureDevOriginMatch()) {
      return { ...base, imagenGeoEstado: 'insecure' };
    }
    if (!browserPermissionPolicyAllows('geolocation')) {
      return { ...base, imagenGeoEstado: 'blocked_by_policy' };
    }
    return new Promise((resolve) => {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              imagenLatitud: pos.coords.latitude,
              imagenLongitud: pos.coords.longitude,
              imagenPrecision: pos.coords.accuracy,
              imagenGeoEstado: 'granted',
              imagenTomadaEn: new Date(pos.timestamp || Date.now()).toISOString(),
            });
          },
          (err) => {
            const status = err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable';
            resolve({ ...base, imagenGeoEstado: status });
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
        );
      } catch {
        resolve({ ...base, imagenGeoEstado: 'blocked_by_policy' });
      }
    });
  }, []);

  const uploadRegistroFotografico = async (file: File | null): Promise<UploadedRegistroFotografico | null> => {
    if (!file) return null;
    if (!selectedObraId) throw new Error('Seleccione una obra antes de subir la imagen.');
    const geoPromise = captureRegistroFotoGeo();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', selectedObraId);
    const res = await fetch('/api/uploads/evidencia-foto', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    const data = await res.json();
    const url = data?.previewUrl || data?.url;
    if (!res.ok || !url) {
      throw new Error(data?.error ?? 'Error al subir imagen.');
    }
    const geo = await geoPromise;
    return { url: String(url), ...geo };
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.isSecureContext && !voiceInsecureDevOriginMatch()) {
      setMediaPermissionState({ camera: 'insecure', geolocation: 'insecure' });
      return;
    }

    let cancelled = false;
    if (!browserPermissionPolicyAllows('geolocation')) {
      setMediaPermissionState((s) => ({ ...s, geolocation: 'blocked_by_policy' }));
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          if (!cancelled) setMediaPermissionState((s) => ({ ...s, geolocation: 'granted' }));
        },
        (err) => {
          if (!cancelled) {
            setMediaPermissionState((s) => ({
              ...s,
              geolocation: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable',
            }));
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    } else {
      setMediaPermissionState((s) => ({ ...s, geolocation: 'unavailable' }));
    }

    if (!browserPermissionPolicyAllows('camera')) {
      setMediaPermissionState((s) => ({ ...s, camera: 'blocked_by_policy' }));
    } else if (navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
          if (!cancelled) setMediaPermissionState((s) => ({ ...s, camera: 'granted' }));
        })
        .catch((err: any) => {
          if (!cancelled) {
            setMediaPermissionState((s) => ({
              ...s,
              camera: String(err?.name ?? '') === 'NotAllowedError' ? 'denied' : 'unavailable',
            }));
          }
        });
    } else {
      setMediaPermissionState((s) => ({ ...s, camera: 'unavailable' }));
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const addEnsayoRow = () => {
    setEnsayosRows((prev) => [
      ...prev,
      {
        materialActividad: '',
        tipoEnsayo: '',
        idMuestra: '',
        laboratorio: '',
        localizacion: '',
        resultado: '',
        observacion: '',
        imagenUrl: '',
        ...emptyFotoGeoFields(),
      },
    ]);
  };

  const addEnsayoFromDraft = () => {
    if (
      !ensayoDraft.materialActividad.trim() ||
      !ensayoDraft.tipoEnsayo.trim() ||
      !ensayoDraft.idMuestra.trim() ||
      !ensayoDraft.laboratorio.trim() ||
      !ensayoDraft.localizacion.trim() ||
      !ensayoDraft.resultado.trim()
    ) {
      setEnsayosError('Completa: material/actividad, tipo de ensayo, ID muestra, laboratorio, localización y resultado.');
      return;
    }
    setEnsayosError(null);
    setEnsayosRows((prev) => [...prev, { ...ensayoDraft, observacion: ensayoDraft.observacion.trim() }]);
    setEnsayoDraft(emptyEnsayoDraft());
  };

  const removeEnsayoRow = (idx: number) => {
    setEnsayosRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateEnsayoRow = (
    idx: number,
    patch: Partial<(typeof ensayosRows)[number]>,
  ) => {
    setEnsayosRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  };

  const saveEnsayos = async () => {
    if (!selectedObraId) {
      setEnsayosError('Seleccione una obra.');
      return;
    }
    if (!selectedJornadaId) {
      setEnsayosError('Seleccione una jornada.');
      return;
    }
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);

    if (ensayosRows.length === 0) {
      setEnsayosError('Agrega al menos un ensayo.');
      return;
    }

    const invalid = ensayosRows.some(
      (r) =>
        !r.materialActividad.trim() ||
        !r.tipoEnsayo.trim() ||
        !r.idMuestra.trim() ||
        !r.laboratorio.trim() ||
        !r.localizacion.trim() ||
        !r.resultado.trim(),
    );
    if (invalid) {
      setEnsayosError('Completa: material/actividad, tipo de ensayo, ID muestra, laboratorio, localización y resultado.');
      return;
    }

    setSavingEnsayos(true);
    setEnsayosMessage(null);
    setEnsayosError(null);
    try {
      const res = await fetch('/api/informes/ensayos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedObraId,
          date,
          jornadaId: selectedJornadaId,
          ensayos: ensayosRows.map((e) => ({
            materialActividad: e.materialActividad,
            tipoEnsayo: e.tipoEnsayo,
            idMuestra: e.idMuestra,
            laboratorio: e.laboratorio,
            localizacion: e.localizacion,
            resultado: e.resultado,
            observacion: e.observacion || null,
            imagenUrl: e.imagenUrl || null,
          ...fotoGeoPayload(e),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEnsayosError(data.error ?? 'No se pudo guardar');
        return;
      }

      const list = Array.isArray(data.ensayos) ? data.ensayos : [];
      setEnsayosRows(
        list.map((e: any) => ({
          id: e.id,
          materialActividad: e.materialActividad ?? '',
          tipoEnsayo: e.tipoEnsayo ?? '',
          idMuestra: e.idMuestra ?? '',
          laboratorio: e.laboratorio ?? '',
          localizacion: e.localizacion ?? '',
          resultado: e.resultado ?? '',
          observacion: e.observacion ?? '',
          imagenUrl: e.imagenUrl ?? '',
          ...fotoGeoFromSource(e),
        })),
      );
      setEnsayosMessage('Ensayos guardados.');
      setTimeout(() => setEnsayosMessage(null), 2500);
    } catch {
      setEnsayosError('Error de conexión.');
    } finally {
      setSavingEnsayos(false);
    }
  };

  const addDanoRow = () => {
    setDanosRows((prev) => [
      ...prev,
      {
        horaReporte: '',
        direccion: '',
        tipoDano: '',
        entidad: '',
        noReporte: '',
        observacion: '',
        imagenUrl: '',
        ...emptyFotoGeoFields(),
      },
    ]);
  };

  const addDanoFromDraft = () => {
    if (
      !danoDraft.direccion.trim() ||
      !danoDraft.tipoDano.trim() ||
      !danoDraft.entidad.trim() ||
      !danoDraft.noReporte.trim()
    ) {
      setDanosError('Completa: dirección, tipo de daño, entidad y no. reporte.');
      return;
    }
    setDanosError(null);
    setDanosRows((prev) => [...prev, { ...danoDraft, observacion: danoDraft.observacion.trim() }]);
    setDanoDraft(emptyDanoDraft());
  };

  const removeDanoRow = (idx: number) => {
    setDanosRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateDanoRow = (
    idx: number,
    patch: Partial<(typeof danosRows)[number]>,
  ) => {
    setDanosRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  };

  const saveDanos = async () => {
    if (!selectedObraId) {
      setDanosError('Seleccione una obra.');
      return;
    }
    if (!selectedJornadaId) {
      setDanosError('Seleccione una jornada.');
      return;
    }
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);

    if (danosRows.length === 0) {
      setDanosError('Agrega al menos un daño.');
      return;
    }

    const invalid = danosRows.some(
      (r) =>
        !r.direccion.trim() ||
        !r.tipoDano.trim() ||
        !r.entidad.trim() ||
        !r.noReporte.trim(),
    );
    if (invalid) {
      setDanosError('Completa: dirección, tipo de daño, entidad y no. reporte.');
      return;
    }

    setSavingDanos(true);
    setDanosMessage(null);
    setDanosError(null);
    try {
      const res = await fetch('/api/informes/danos-redes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedObraId,
          date,
          jornadaId: selectedJornadaId,
          danos: danosRows.map((d) => ({
            horaReporte: d.horaReporte || null,
            direccion: d.direccion,
            tipoDano: d.tipoDano,
            entidad: d.entidad,
            noReporte: d.noReporte,
            observacion: d.observacion || null,
            imagenUrl: d.imagenUrl || null,
            ...fotoGeoPayload(d),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setDanosError(data.error ?? 'No se pudo guardar');
        return;
      }

      const list = Array.isArray(data.danos) ? data.danos : [];
      setDanosRows(
        list.map((d: any) => ({
          id: d.id,
          horaReporte: d.horaReporte ?? '',
          direccion: d.direccion ?? '',
          tipoDano: d.tipoDano ?? '',
          entidad: d.entidad ?? '',
          noReporte: d.noReporte ?? '',
          observacion: d.observacion ?? '',
          imagenUrl: d.imagenUrl ?? '',
          ...fotoGeoFromSource(d),
        })),
      );
      setDanosMessage('Daños guardados.');
      setTimeout(() => setDanosMessage(null), 2500);
    } catch {
      setDanosError('Error de conexión.');
    } finally {
      setSavingDanos(false);
    }
  };

  const addNoConformidadRow = () => {
    setNoConformidadesRows((prev) => [
      ...prev,
      {
        noConformidad: '',
        detalle: '',
        estado: '',
        imagenUrl: '',
        ...emptyFotoGeoFields(),
      },
    ]);
  };

  const addNoConformidadFromDraft = () => {
    if (
      !noConformidadDraft.noConformidad.trim() ||
      !noConformidadDraft.detalle.trim() ||
      !noConformidadDraft.estado.trim()
    ) {
      setNoConformidadesError('Completa No. no conformidad, Detalle y Estado.');
      return;
    }
    setNoConformidadesError(null);
    setNoConformidadesRows((prev) => [...prev, { ...noConformidadDraft }]);
    setNoConformidadDraft(emptyNoConformidadDraft());
  };

  const removeNoConformidadRow = (idx: number) => {
    setNoConformidadesRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateNoConformidadRow = (
    idx: number,
    patch: Partial<(typeof noConformidadesRows)[number]>,
  ) => {
    setNoConformidadesRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  };

  const saveNoConformidades = async () => {
    if (!selectedObraId) {
      setNoConformidadesError('Seleccione una obra.');
      return;
    }
    if (!selectedJornadaId) {
      setNoConformidadesError('Seleccione una jornada.');
      return;
    }
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);

    if (noConformidadesRows.length === 0) {
      setNoConformidadesError('Agrega al menos una no conformidad.');
      return;
    }

    const invalid = noConformidadesRows.some(
      (r) => !r.noConformidad.trim() || !r.detalle.trim() || !r.estado.trim(),
    );
    if (invalid) {
      setNoConformidadesError('Completa No. no conformidad, Detalle y Estado.');
      return;
    }

    setSavingNoConformidades(true);
    setNoConformidadesMessage(null);
    setNoConformidadesError(null);
    try {
      const res = await fetch('/api/informes/no-conformidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedObraId,
          date,
          jornadaId: selectedJornadaId,
          noConformidades: noConformidadesRows.map((n) => ({
            noConformidad: n.noConformidad,
            detalle: n.detalle,
            estado: n.estado,
            imagenUrl: n.imagenUrl || null,
            ...fotoGeoPayload(n),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNoConformidadesError(data.error ?? 'No se pudo guardar');
        return;
      }

      const list = Array.isArray(data.noConformidades) ? data.noConformidades : [];
      setNoConformidadesRows(
        list.map((n: any) => ({
          id: n.id,
          noConformidad: n.noConformidad ?? '',
          detalle: n.detalle ?? '',
          estado: n.estado ?? '',
          imagenUrl: n.imagenUrl ?? '',
          ...fotoGeoFromSource(n),
        })),
      );
      setNoConformidadesMessage('No conformidades guardadas.');
      setTimeout(() => setNoConformidadesMessage(null), 2500);
    } catch {
      setNoConformidadesError('Error de conexión.');
    } finally {
      setSavingNoConformidades(false);
    }
  };

  /** Persiste evidencias + firmas. `skipPhotoValidation` permite guardar solo firmas sin exigir fotos (botón Firmar). */
  const persistEvidenciasApi = async (
    firmasToSend: Record<FirmaEvidenciaKey, FirmaEvidenciaState>,
    options?: { skipPhotoValidation?: boolean },
  ): Promise<boolean> => {
    if (!selectedObraId) {
      setEvidenciasError('Seleccione una obra.');
      return false;
    }
    if (!selectedJornadaId) {
      setEvidenciasError('Seleccione una jornada.');
      return false;
    }
    const date = datosGeneralesForm.fechaReporte || new Date().toISOString().slice(0, 10);

    if (!options?.skipPhotoValidation && registroFotografico && totalEvidenciasCount(evidenciaUrlsPorFase) === 0) {
      setEvidenciasError('Si marcaste “Sí”, debes cargar al menos una foto.');
      return false;
    }

    setSavingEvidencias(true);
    setEvidenciasMessage(null);
    setEvidenciasError(null);
    try {
      const res = await fetch('/api/informes/evidencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedObraId,
          date,
          jornadaId: selectedJornadaId,
          registroFotografico,
          observacionesGenerales,
          observaciones: null,
          responsableDiligenciamiento: firmasToSend.responsableDiligenciamiento,
          residenteObra: firmasToSend.residenteObra,
          auxiliarIngenieria: firmasToSend.auxiliarIngenieria,
          vistoBuenoDirectorObra: firmasToSend.vistoBuenoDirectorObra,
          // Si el usuario marcó “NO”, no se deben persistir fotos previas aunque existan en el estado.
          evidenciaUrls: registroFotografico ? evidenciaUrlsPorFase : emptyEvidenciaUrlsPorFase(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEvidenciasError(data?.error ?? 'No se pudo guardar');
        return false;
      }

      if (typeof data.informeCerrado === 'boolean') {
        setInformeCerrado(data.informeCerrado);
        setCerradoEn(typeof data.cerradoEn === 'string' ? data.cerradoEn : null);
      }

      return true;
    } catch {
      setEvidenciasError('Error de conexión.');
      return false;
    } finally {
      setSavingEvidencias(false);
    }
  };

  const saveEvidencias = async () => {
    const ok = await persistEvidenciasApi(firmasEvidencias);
    if (ok) {
      setEvidenciasMessage('Evidencias y cierre guardados.');
      setTimeout(() => setEvidenciasMessage(null), 2500);
    }
  };

  const uploadEvidenciasFotos = async (files: FileList | null, fase: EvidenciaFase) => {
    if (!files || files.length === 0) return;
    if (informeBloqueado) return;
    setEvidenciasError(null);

    const list = Array.from(files);
    const valid = list.filter((f) => {
      const okType = ['image/jpeg', 'image/jpg', 'image/png'].includes(f.type);
      const okSize = f.size <= 5 * 1024 * 1024;
      return okType && okSize;
    });

    if (valid.length !== list.length) {
      setEvidenciasError('Revisa formatos (JPG/PNG) y tamaño máximo (5MB).');
    }

    if (valid.length === 0) return;

    setUploadingEvidencia(true);
    try {
      const appended: EvidenciaItem[] = [];
      for (const f of valid) {
        const uploaded = await uploadRegistroFotografico(f);
        if (!uploaded) {
          continue;
        }
        appended.push({ url: uploaded.url, ...fotoGeoPayload(uploaded) });
      }

      if (appended.length > 0) {
        let mergedLen = 0;
        setEvidenciaUrlsPorFase((prev) => {
          const merged = [...prev[fase], ...appended];
          mergedLen = merged.length;
          return { ...prev, [fase]: merged };
        });
        setEvidenciaCarouselIndex((prev) => ({
          ...prev,
          [fase]: mergedLen > 0 ? mergedLen - 1 : 0,
        }));
        setRegistroFotografico(true);
      }
    } catch {
      setEvidenciasError('Error de conexión.');
    } finally {
      setUploadingEvidencia(false);
    }
  };

  const removeEvidenciaUrl = (fase: EvidenciaFase, idx: number) => {
    if (informeBloqueado) return;
    setEvidenciaUrlsPorFase((prev) => {
      const nextArr = prev[fase].filter((_, i) => i !== idx);
      setEvidenciaCarouselIndex((ci) => {
        const cur = ci[fase];
        let ni = cur;
        if (idx < cur) ni = cur - 1;
        else if (idx === cur) ni = Math.min(cur, Math.max(0, nextArr.length - 1));
        if (nextArr.length === 0) ni = 0;
        else ni = Math.max(0, Math.min(ni, nextArr.length - 1));
        return { ...ci, [fase]: ni };
      });
      return { ...prev, [fase]: nextArr };
    });
  };

  return (
    <div className="shell">
      <header className="topbar">
        <button
          className="topbar-menu-button"
          aria-label="Abrir menú"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span />
          <span />
          <span />
        </button>

        <div className="topbar-brand">
          <img
            src="/images/Logo_camacon.png"
            alt="CAMACON"
            className="topbar-logo"
          />
          {firmaToken && (
            <div className="topbar-firma-token" title="Código de firma del día (úsalo en Evidencias y cierre)">
              <span className="topbar-firma-token-label">Código de firma</span>
              <div className="topbar-firma-token-row">
                <code>{firmaToken}</code>
                <button
                  type="button"
                  className="topbar-firma-token-copy"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(firmaToken);
                      setFirmaTokenCopiado(true);
                      setTimeout(() => setFirmaTokenCopiado(false), 2000);
                    } catch {
                      // ignorar
                    }
                  }}
                >
                  {firmaTokenCopiado ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>
          )}
        </div>

        <nav className="topbar-nav-desktop">
          {canSee('home') && (
            <button
              type="button"
              className={`topbar-link ${activeSection === 'home' ? 'topbar-link-active' : ''}`}
              onClick={() => setActiveSection('home')}
            >
              <IconHome />
              <span>Inicio</span>
            </button>
          )}
          {(canSee('datos') ||
            canSee('jornada') ||
            canSee('personal') ||
            canSee('equipos') ||
            canSee('actividades') ||
            canSee('calidad') ||
            canSee('evidencias') ||
            canSee('tabulacion')) && (
            <div className="topbar-dropdown-wrap" ref={informeDropdownRef}>
              <button
                type="button"
                className={`topbar-link ${
                  isInformeSection ? 'topbar-link-active' : ''
                } ${informeDropdownOpen ? 'topbar-link-open' : ''}`}
                onClick={() => setInformeDropdownOpen(!informeDropdownOpen)}
                aria-expanded={informeDropdownOpen}
                aria-haspopup="true"
              >
                <IconClipboard />
                <span>Informe diario</span>
                <IconChevronDown open={informeDropdownOpen} />
              </button>
              {informeDropdownOpen && (
                <div className="topbar-dropdown" role="menu">
                  {INFORME_STEPS.filter((s) => canSee(s.id)).map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      type="button"
                      role="menuitem"
                      className={`topbar-dropdown-item ${activeSection === id ? 'topbar-dropdown-item-active' : ''}`}
                      onClick={() => {
                        setActiveSection(id);
                        setInformeDropdownOpen(false);
                      }}
                    >
                      <Icon />
                      <span>{label}</span>
                      <IconChevronRight />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {canSee('settings') && (
            <button
              type="button"
              className={`topbar-link ${activeSection === 'settings' ? 'topbar-link-active' : ''}`}
              onClick={() => setActiveSection('settings')}
            >
              <IconCog />
              <span>Configuración</span>
            </button>
          )}
          {canSee('users') && (
            <button
              type="button"
              className={`topbar-link ${activeSection === 'users' ? 'topbar-link-active' : ''}`}
              onClick={() => setActiveSection('users')}
            >
              <IconUsers />
              <span>Usuarios</span>
            </button>
          )}
          {canShowInstallCta && !isAppInstalled && installAvailable && (
            <button type="button" className="topbar-link" onClick={handleInstallClick}>
              <span>Instalar app</span>
            </button>
          )}
          {canShowInstallCta && !isAppInstalled && !installAvailable && (
            <button type="button" className="topbar-link" onClick={handleInstallHelpClick}>
              <span>Como instalar</span>
            </button>
          )}
          <button type="button" className="topbar-link topbar-link-danger" onClick={handleLogout} title="Cerrar sesión">
            <IconLogout />
            <span>Cerrar sesión</span>
          </button>
        </nav>
      </header>

      {menuOpen && (
        <nav className="nav-drawer" aria-label="Menú principal">
          <div className="nav-drawer-inner">
            {canSee('home') && (
              <button
                type="button"
                className={`nav-item ${activeSection === 'home' ? 'nav-item-active' : ''}`}
                onClick={() => {
                  setActiveSection('home');
                  setMenuOpen(false);
                }}
              >
                <IconHome />
                <span>Inicio</span>
                <IconChevronRight />
              </button>
            )}

            {(canSee('datos') ||
              canSee('jornada') ||
              canSee('personal') ||
              canSee('equipos') ||
              canSee('actividades') ||
              canSee('calidad') ||
              canSee('evidencias') ||
              canSee('tabulacion')) && (
              <div className="nav-section">
                <button
                  type="button"
                  className={`nav-section-header ${informeExpanded ? 'nav-section-header-open' : ''}`}
                  onClick={() => setInformeExpanded(!informeExpanded)}
                  aria-expanded={informeExpanded}
                >
                  <IconClipboard />
                  <span>Informe diario</span>
                  <IconChevronDown open={informeExpanded} />
                </button>
                {informeExpanded && (
                  <div className="nav-sublist" role="menu">
                    {INFORME_STEPS.filter((s) => canSee(s.id)).map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        role="menuitem"
                        className={`nav-sublist-item ${activeSection === id ? 'nav-sublist-item-active' : ''}`}
                        onClick={() => {
                          setActiveSection(id);
                          setMenuOpen(false);
                        }}
                      >
                        <Icon />
                        <span>{label}</span>
                        <IconChevronRight />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {canSee('settings') && (
              <button
                type="button"
                className={`nav-item ${activeSection === 'settings' ? 'nav-item-active' : ''}`}
                onClick={() => {
                  setActiveSection('settings');
                  setMenuOpen(false);
                }}
              >
                <IconCog />
                <span>Configuración</span>
                <IconChevronRight />
              </button>
            )}
            {canSee('users') && (
              <button
                type="button"
                className={`nav-item ${activeSection === 'users' ? 'nav-item-active' : ''}`}
                onClick={() => {
                  setActiveSection('users');
                  setMenuOpen(false);
                }}
              >
                <IconUsers />
                <span>Usuarios</span>
                <IconChevronRight />
              </button>
            )}
            {canShowInstallCta && !isAppInstalled && installAvailable && (
              <button
                type="button"
                className="nav-item"
                onClick={handleInstallClick}
              >
                <span>Instalar app</span>
                <IconChevronRight />
              </button>
            )}
            {canShowInstallCta && !isAppInstalled && !installAvailable && (
              <button
                type="button"
                className="nav-item"
                onClick={handleInstallHelpClick}
              >
                <span>Como instalar</span>
                <IconChevronRight />
              </button>
            )}
            <button type="button" className="nav-item nav-item-danger" onClick={handleLogout}>
              <IconLogout />
              <span>Cerrar sesión</span>
              <IconChevronRight />
            </button>
          </div>
        </nav>
      )}

      <main className="shell-main">
        {activeSection === 'home' && (
          <section className="shell-card">
            <h1 className="shell-title">Bienvenido al panel de obra</h1>
            <p className="shell-text">
              Desde aquí vas a poder acceder a informes diarios, inventario, personal de obra y más
              módulos que iremos activando.
            </p>
            <p className="shell-text-muted">
              Esta pantalla está optimizada para móviles: la barra superior se convierte en menú
              tipo hamburguesa para que puedas usarla cómodamente en campo.
            </p>
          </section>
        )}

        {activeSection === 'settings' && (
          <section className="shell-card shell-card-wide">
            <h1 className="shell-title">Configuración general</h1>
            <div className="users-tabs">
              <button
                type="button"
                className={`users-tab ${settingsSubSection === 'obras' ? 'users-tab-active' : ''}`}
                onClick={() => setSettingsSubSection('obras')}
              >
                <IconBuilding />
                Obras
              </button>
              <button
                type="button"
                className={`users-tab ${settingsSubSection === 'jornadas' ? 'users-tab-active' : ''}`}
                onClick={() => setSettingsSubSection('jornadas')}
              >
                <IconSun />
                Jornadas
              </button>
              <button
                type="button"
                className={`users-tab ${settingsSubSection === 'frentesObra' ? 'users-tab-active' : ''}`}
                onClick={() => setSettingsSubSection('frentesObra')}
              >
                <IconHammer />
                Frentes de obra
              </button>
              <button
                type="button"
                className={`users-tab ${settingsSubSection === 'contratistas' ? 'users-tab-active' : ''}`}
                onClick={() => setSettingsSubSection('contratistas')}
              >
                <IconUsers />
                Contratistas
              </button>
              <button
                type="button"
                className={`users-tab ${settingsSubSection === 'encargados' ? 'users-tab-active' : ''}`}
                onClick={() => setSettingsSubSection('encargados')}
              >
                <IconHardHat />
                Encargados
              </button>
              <button
                type="button"
                className={`users-tab ${settingsSubSection === 'cargos' ? 'users-tab-active' : ''}`}
                onClick={() => setSettingsSubSection('cargos')}
              >
                <IconCog />
                Cargos
              </button>
              <button
                type="button"
                className={`users-tab ${settingsSubSection === 'proveedores' ? 'users-tab-active' : ''}`}
                onClick={() => setSettingsSubSection('proveedores')}
              >
                <IconUsers />
                Proveedores
              </button>
              <button
                type="button"
                className={`users-tab ${settingsSubSection === 'estructuraItems' ? 'users-tab-active' : ''}`}
                onClick={() => setSettingsSubSection('estructuraItems')}
              >
                <IconClipboard />
                Capítulos
              </button>
              <button
                type="button"
                className={`users-tab ${settingsSubSection === 'items' ? 'users-tab-active' : ''}`}
                onClick={() => setSettingsSubSection('items')}
              >
                <IconClipboard />
                Ítems
              </button>
            </div>

            {settingsSubSection === 'obras' && (
              <>
                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>Crear obra</h2>
                {obraMessage && <p className="feedback feedback-success">{obraMessage}</p>}
                {obraError && <p className="feedback feedback-error">{obraError}</p>}
                <form className="auth-form" onSubmit={createObra} style={{ marginBottom: '1.5rem' }}>
                  <div className="form-field">
                    <label className="form-label" htmlFor="obra-name">Nombre de la obra</label>
                    <input
                      id="obra-name"
                      className="form-input"
                      type="text"
                      required
                      value={obraForm.name}
                      onChange={(e) => setObraForm({ ...obraForm, name: e.target.value })}
                    />
                  </div>
                  <div className="form-row-2">
                    <div className="form-field">
                      <label className="form-label" htmlFor="obra-start">Fecha inicio</label>
                      <input
                        id="obra-start"
                        className="form-input"
                        type="date"
                        value={obraForm.startDate}
                        onChange={(e) => setObraForm({ ...obraForm, startDate: e.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="obra-end">Fecha fin</label>
                      <input
                        id="obra-end"
                        className="form-input"
                        type="date"
                        value={obraForm.endDate}
                        onChange={(e) => setObraForm({ ...obraForm, endDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="obra-carpeta-nube">
                      Carpeta de imágenes en la nube (opcional)
                    </label>
                    <textarea
                      id="obra-carpeta-nube"
                      className="form-input"
                      rows={2}
                      placeholder="ID de carpeta o enlace (p. ej. carpeta de Google Drive)"
                      value={obraForm.evidenciasGoogleDriveFolderId}
                      onChange={(e) =>
                        setObraForm({ ...obraForm, evidenciasGoogleDriveFolderId: e.target.value })
                      }
                    />
                  </div>
                  <button type="submit" className="btn-primary" disabled={creatingObra}>
                    {creatingObra ? 'Creando...' : 'Crear obra'}
                  </button>
                </form>

                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>Listado de obras</h2>
                {loadingObras ? (
                  <p className="shell-text-muted">Cargando obras...</p>
                ) : (
                  <div className="users-table-wrap">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>Consec.</th>
                          <th>Código</th>
                          <th>Nombre</th>
                          <th>Inicio</th>
                          <th>Fin</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {obrasList.map((o) => (
                          <tr key={o.id}>
                            <td>{o.consecutivo ?? '—'}</td>
                            <td>{o.code}</td>
                            <td>{o.name}</td>
                            <td>{o.startDate ? new Date(o.startDate).toLocaleDateString('es') : '—'}</td>
                            <td>{o.endDate ? new Date(o.endDate).toLocaleDateString('es') : '—'}</td>
                            <td>
                              <div className="users-table-actions">
                                <button type="button" onClick={() => openEditObra(o)} aria-label="Editar">
                                  <IconEdit /> Editar
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  disabled={deletingObraId === o.id}
                                  onClick={() => deleteObra(o)}
                                  aria-label="Eliminar"
                                >
                                  <IconTrash /> Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {obrasList.length === 0 && (
                      <p className="shell-text-muted" style={{ padding: '1rem' }}>No hay obras. Crea una arriba.</p>
                    )}
                  </div>
                )}

                {editObra && (
                  <div role="dialog" aria-modal="true" aria-labelledby="edit-obra-title" style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                    <h3 id="edit-obra-title" className="shell-title" style={{ marginBottom: '0.75rem' }}>Editar obra</h3>
                    <form onSubmit={saveEditObra}>
                      <div className="form-field">
                        <label className="form-label">Consecutivo / Código</label>
                        <input
                          className="form-input"
                          type="text"
                          value={`${editObra.consecutivo ?? '—'} · ${editObra.code}`}
                          readOnly
                          disabled
                        />
                      </div>
                      <div className="form-field">
                        <label className="form-label">Nombre</label>
                        <input
                          className="form-input"
                          type="text"
                          required
                          value={editObraForm.name}
                          onChange={(e) => setEditObraForm({ ...editObraForm, name: e.target.value })}
                        />
                      </div>
                      <div className="form-row-2">
                        <div className="form-field">
                          <label className="form-label">Fecha inicio</label>
                          <input
                            className="form-input"
                            type="date"
                            value={editObraForm.startDate}
                            onChange={(e) => setEditObraForm({ ...editObraForm, startDate: e.target.value })}
                          />
                        </div>
                        <div className="form-field">
                          <label className="form-label">Fecha fin</label>
                          <input
                            className="form-input"
                            type="date"
                            value={editObraForm.endDate}
                            onChange={(e) => setEditObraForm({ ...editObraForm, endDate: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="form-field">
                        <label className="form-label">Carpeta de imágenes en la nube (opcional)</label>
                        <textarea
                          className="form-input"
                          rows={2}
                          placeholder="Vacío = carpeta por defecto del servidor"
                          value={editObraForm.evidenciasGoogleDriveFolderId}
                          onChange={(e) =>
                            setEditObraForm({ ...editObraForm, evidenciasGoogleDriveFolderId: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-actions-row">
                        <button type="submit" className="btn-primary" disabled={savingObra}>
                          {savingObra ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button type="button" className="btn-cancel" onClick={() => setEditObra(null)}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}

            {settingsSubSection === 'jornadas' && (
              <>
                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>Jornadas (turnos)</h2>
                {jornadasAdminMessage && <p className="feedback feedback-success">{jornadasAdminMessage}</p>}
                {jornadasAdminError && <p className="feedback feedback-error">{jornadasAdminError}</p>}

                <form className="auth-form" onSubmit={createJornadaAdmin} style={{ marginBottom: '1.5rem' }}>
                  <div className="form-row-2">
                    <div className="form-field">
                      <label className="form-label">Nombre</label>
                      <input
                        className="form-input"
                        type="text"
                        required
                        placeholder="Ej. Diurna"
                        value={jornadaNew.nombre}
                        onChange={(e) => setJornadaNew({ ...jornadaNew, nombre: e.target.value })}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Orden</label>
                      <input
                        className="form-input"
                        type="number"
                        value={jornadaNew.orden}
                        onChange={(e) => setJornadaNew({ ...jornadaNew, orden: Number(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="form-row-2 jornadas-time-row">
                    <div className="form-field">
                      <label className="form-label" htmlFor="jornada-new-hora-inicio">
                        Hora inicio
                      </label>
                      <input
                        id="jornada-new-hora-inicio"
                        className="form-input input-time-mobile"
                        type="time"
                        step={60}
                        required
                        value={jornadaNew.horaInicio}
                        onChange={(e) =>
                          setJornadaNew((prev) => ({
                            ...prev,
                            horaInicio: normalizarHoraHHmm(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="jornada-new-hora-fin">
                        Hora fin
                      </label>
                      <input
                        id="jornada-new-hora-fin"
                        className="form-input input-time-mobile"
                        type="time"
                        step={60}
                        required
                        value={jornadaNew.horaFin}
                        onChange={(e) =>
                          setJornadaNew((prev) => ({
                            ...prev,
                            horaFin: normalizarHoraHHmm(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" disabled={jornadasAdminSaving} style={{ marginTop: '0.75rem' }}>
                    {jornadasAdminSaving ? 'Guardando...' : 'Crear jornada'}
                  </button>
                </form>

                <h2 className="shell-title" style={{ fontSize: '1.1rem' }}>Listado</h2>
                {jornadasAdmin.length === 0 ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>No hay jornadas. Crea una arriba.</p>
                ) : (
                  <div className="users-table-wrap">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Inicio</th>
                          <th>Fin</th>
                          <th>Orden</th>
                          <th>Activa</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jornadasAdmin.map((j) => (
                          <tr key={j.id}>
                            {editingJornadaId === j.id ? (
                              <>
                                <td>
                                  <input
                                    className="form-input"
                                    value={editingJornadaForm.nombre}
                                    onChange={(e) => setEditingJornadaForm((f) => ({ ...f, nombre: e.target.value }))}
                                  />
                                </td>
                                <td>
                                  <input
                                    className="form-input input-time-mobile"
                                    type="time"
                                    step={60}
                                    aria-label="Hora inicio"
                                    value={editingJornadaForm.horaInicio}
                                    onChange={(e) =>
                                      setEditingJornadaForm((f) => ({
                                        ...f,
                                        horaInicio: normalizarHoraHHmm(e.target.value),
                                      }))
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    className="form-input input-time-mobile"
                                    type="time"
                                    step={60}
                                    aria-label="Hora fin"
                                    value={editingJornadaForm.horaFin}
                                    onChange={(e) =>
                                      setEditingJornadaForm((f) => ({
                                        ...f,
                                        horaFin: normalizarHoraHHmm(e.target.value),
                                      }))
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    className="form-input"
                                    type="number"
                                    value={editingJornadaForm.orden}
                                    onChange={(e) =>
                                      setEditingJornadaForm((f) => ({ ...f, orden: Number(e.target.value) || 0 }))
                                    }
                                  />
                                </td>
                                <td>
                                  <label className="perms-check-label">
                                    <input
                                      type="checkbox"
                                      checked={editingJornadaForm.isActive}
                                      onChange={(e) =>
                                        setEditingJornadaForm((f) => ({ ...f, isActive: e.target.checked }))
                                      }
                                    />
                                    <span className="perms-check-box" />
                                  </label>
                                </td>
                                <td>
                                  <div className="users-table-actions">
                                    <button type="button" disabled={jornadasAdminSaving} onClick={() => saveEditJornadaAdmin(j.id)}>
                                      {jornadasAdminSaving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-cancel"
                                      onClick={() => {
                                        setEditingJornadaId(null);
                                      }}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td>{j.nombre}</td>
                                <td>{j.horaInicio}</td>
                                <td>{j.horaFin}</td>
                                <td>{j.orden}</td>
                                <td>{j.isActive ? 'Sí' : 'No'}</td>
                                <td>
                                  <div className="users-table-actions">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingJornadaId(j.id);
                                        setEditingJornadaForm({
                                          nombre: j.nombre,
                                          horaInicio: normalizarHoraHHmm(j.horaInicio),
                                          horaFin: normalizarHoraHHmm(j.horaFin),
                                          orden: j.orden,
                                          isActive: j.isActive,
                                        });
                                      }}
                                    >
                                      <IconEdit /> Editar
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {settingsSubSection === 'frentesObra' && (
              <>
                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
                  Frentes de obra (por obra)
                </h2>
                {frentesObraMessage && <p className="feedback feedback-success">{frentesObraMessage}</p>}
                {frentesObraError && <p className="feedback feedback-error">{frentesObraError}</p>}

                <div className="form-field" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="frentes-obra-filter-obra">
                    Obra
                  </label>
                  <select
                    id="frentes-obra-filter-obra"
                    className="form-input"
                    value={frentesObraFilterProjectId}
                    onChange={(e) => setFrentesObraFilterProjectId(e.target.value)}
                  >
                    {frentesObraObrasOptions.length === 0 ? (
                      <option value="">— Sin obras —</option>
                    ) : (
                      frentesObraObrasOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code} · {o.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <form className="auth-form" onSubmit={createFrenteObraCatalog} style={{ marginBottom: '1.5rem' }}>
                  <div className="form-row-2">
                    <div className="form-field">
                      <label className="form-label">Nombre del frente</label>
                      <input
                        className="form-input"
                        type="text"
                        required
                        placeholder="Ej. Módulo norte"
                        value={frentesObraNewNombre}
                        onChange={(e) => setFrentesObraNewNombre(e.target.value)}
                        disabled={!frentesObraFilterProjectId}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Orden</label>
                      <input
                        className="form-input"
                        type="number"
                        value={frentesObraNewOrden}
                        onChange={(e) => setFrentesObraNewOrden(Number(e.target.value) || 0)}
                        disabled={!frentesObraFilterProjectId}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={frentesObraSaving || !frentesObraFilterProjectId}
                    style={{ marginTop: '0.75rem' }}
                  >
                    {frentesObraSaving ? 'Guardando...' : 'Crear frente'}
                  </button>
                </form>

                <h2 className="shell-title" style={{ fontSize: '1.1rem' }}>Listado</h2>
                {!frentesObraFilterProjectId ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>
                    Seleccione una obra para ver o crear frentes.
                  </p>
                ) : frentesObraAdmin.length === 0 ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>
                    No hay frentes para esta obra. Cree uno arriba.
                  </p>
                ) : (
                  <div className="users-table-wrap">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Orden</th>
                          <th>Activa</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {frentesObraAdmin.map((row) => (
                          <tr key={row.id}>
                            {editingFrenteObraId === row.id ? (
                              <>
                                <td>
                                  <input
                                    className="form-input"
                                    value={editingFrenteObraForm.nombre}
                                    onChange={(e) =>
                                      setEditingFrenteObraForm((f) => ({ ...f, nombre: e.target.value }))
                                    }
                                  />
                                </td>
                                <td>
                                  <input
                                    className="form-input"
                                    type="number"
                                    value={editingFrenteObraForm.orden}
                                    onChange={(e) =>
                                      setEditingFrenteObraForm((f) => ({
                                        ...f,
                                        orden: Number(e.target.value) || 0,
                                      }))
                                    }
                                  />
                                </td>
                                <td>
                                  <label className="perms-check-label">
                                    <input
                                      type="checkbox"
                                      checked={editingFrenteObraForm.isActive}
                                      onChange={(e) =>
                                        setEditingFrenteObraForm((f) => ({
                                          ...f,
                                          isActive: e.target.checked,
                                        }))
                                      }
                                    />
                                    <span className="perms-check-box" />
                                  </label>
                                </td>
                                <td>
                                  <div className="users-table-actions">
                                    <button type="button" disabled={frentesObraSaving} onClick={() => saveEditFrenteObra(row.id)}>
                                      {frentesObraSaving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-cancel"
                                      onClick={() => {
                                        setEditingFrenteObraId(null);
                                        setEditingFrenteObraForm({ nombre: '', orden: 0, isActive: true });
                                      }}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td>{row.nombre}</td>
                                <td>{row.orden}</td>
                                <td>{row.isActive ? 'Sí' : 'No'}</td>
                                <td>
                                  <div className="users-table-actions">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingFrenteObraId(row.id);
                                        setEditingFrenteObraForm({
                                          nombre: row.nombre,
                                          orden: row.orden,
                                          isActive: row.isActive,
                                        });
                                      }}
                                    >
                                      <IconEdit /> Editar
                                    </button>
                                    <button
                                      type="button"
                                      className="danger"
                                      disabled={deletingFrenteObraId === row.id}
                                      onClick={() => deleteFrenteObraCatalog(row.id, row.nombre)}
                                    >
                                      <IconTrash /> Eliminar
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {settingsSubSection === 'contratistas' && (
              <>
                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
                  Contratistas (por obra)
                </h2>
                {contratistasError && <p className="feedback feedback-error">{contratistasError}</p>}

                <div className="form-field" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="contratistas-filter-obra">
                    Obra
                  </label>
                  <select
                    id="contratistas-filter-obra"
                    className="form-input"
                    value={contratistasFilterProjectId}
                    onChange={(e) => setContratistasFilterProjectId(e.target.value)}
                  >
                    {catalogosPorObraObrasOptions.length === 0 ? (
                      <option value="">— Sin obras —</option>
                    ) : (
                      catalogosPorObraObrasOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code} · {o.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <form className="auth-form" onSubmit={createContratista} style={{ marginBottom: '1.5rem' }}>
                  <div className="form-row-2">
                    <div className="form-field">
                      <label className="form-label">Cédula</label>
                      <input
                        className="form-input"
                        type="text"
                        required
                        value={contratistasNewCedula}
                        onChange={(e) => setContratistasNewCedula(e.target.value)}
                        disabled={!contratistasFilterProjectId}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Nombre del contratista</label>
                      <input
                        className="form-input"
                        type="text"
                        required
                        value={contratistasNewNombre}
                        onChange={(e) => setContratistasNewNombre(e.target.value)}
                        disabled={!contratistasFilterProjectId}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={contratistasSaving || !contratistasFilterProjectId}
                    style={{ marginTop: '0.75rem' }}
                  >
                    {contratistasSaving ? 'Creando...' : 'Crear contratista'}
                  </button>
                </form>

                <h2 className="shell-title" style={{ fontSize: '1.1rem' }}>Listado</h2>
                {!contratistasFilterProjectId ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>
                    Seleccione una obra para ver o crear contratistas.
                  </p>
                ) : contratistasAdmin.length === 0 ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>
                    No hay contratistas para esta obra. Cree uno arriba.
                  </p>
                ) : (
                  <div className="users-table-wrap">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>Cédula</th>
                          <th>Nombre</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contratistasAdmin.map((c) => (
                          <tr key={c.id}>
                            <td>
                              {editingContratistaId === c.id ? (
                                <input
                                  className="form-input"
                                  type="text"
                                  value={editingContratistaCedula}
                                  onChange={(e) => setEditingContratistaCedula(e.target.value)}
                                />
                              ) : (
                                c.cedula
                              )}
                            </td>
                            <td>
                              {editingContratistaId === c.id ? (
                                <input
                                  className="form-input"
                                  type="text"
                                  value={editingContratistaNombre}
                                  onChange={(e) => setEditingContratistaNombre(e.target.value)}
                                />
                              ) : (
                                c.nombre
                              )}
                            </td>
                            <td>
                              {editingContratistaId === c.id ? (
                                <div className="users-table-actions">
                                  <button type="button" disabled={contratistasSaving} onClick={() => saveEditContratista(c.id)}>
                                    {contratistasSaving ? 'Guardando...' : 'Guardar'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => {
                                      setEditingContratistaId(null);
                                      setEditingContratistaNombre('');
                                      setEditingContratistaCedula('');
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <div className="users-table-actions">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingContratistaId(c.id);
                                      setEditingContratistaNombre(c.nombre);
                                      setEditingContratistaCedula(c.cedula);
                                    }}
                                  >
                                    <IconEdit /> Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="danger"
                                    disabled={deletingContratistaId === c.id}
                                    onClick={() => deleteContratista(c.id, c.nombre)}
                                  >
                                    <IconTrash /> Eliminar
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {settingsSubSection === 'encargados' && (
              <>
                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
                  Encargados (por obra)
                </h2>
                {encargadosError && <p className="feedback feedback-error">{encargadosError}</p>}

                <div className="form-field" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="encargados-filter-obra">
                    Obra
                  </label>
                  <select
                    id="encargados-filter-obra"
                    className="form-input"
                    value={encargadosFilterProjectId}
                    onChange={(e) => setEncargadosFilterProjectId(e.target.value)}
                  >
                    {catalogosPorObraObrasOptions.length === 0 ? (
                      <option value="">— Sin obras —</option>
                    ) : (
                      catalogosPorObraObrasOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code} · {o.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <form className="auth-form" onSubmit={createEncargado} style={{ marginBottom: '1.5rem' }}>
                  <div className="form-row-2">
                    <div className="form-field">
                      <label className="form-label">Cédula</label>
                      <input
                        className="form-input"
                        type="text"
                        required
                        value={encargadosNewCedula}
                        onChange={(e) => setEncargadosNewCedula(e.target.value)}
                        disabled={!encargadosFilterProjectId}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Nombre del encargado</label>
                      <input
                        className="form-input"
                        type="text"
                        required
                        value={encargadosNewNombre}
                        onChange={(e) => setEncargadosNewNombre(e.target.value)}
                        disabled={!encargadosFilterProjectId}
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={encargadosSaving || !encargadosFilterProjectId}
                    style={{ marginTop: '0.75rem' }}
                  >
                    {encargadosSaving ? 'Creando...' : 'Crear encargado'}
                  </button>
                </form>

                <h2 className="shell-title" style={{ fontSize: '1.1rem' }}>Listado</h2>
                {!encargadosFilterProjectId ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>
                    Seleccione una obra para ver o crear encargados.
                  </p>
                ) : encargadosAdmin.length === 0 ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>
                    No hay encargados para esta obra. Cree uno arriba.
                  </p>
                ) : (
                  <div className="users-table-wrap">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>Cédula</th>
                          <th>Nombre</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {encargadosAdmin.map((c) => (
                          <tr key={c.id}>
                            <td>
                              {editingEncargadoId === c.id ? (
                                <input
                                  className="form-input"
                                  type="text"
                                  value={editingEncargadoCedula}
                                  onChange={(e) => setEditingEncargadoCedula(e.target.value)}
                                />
                              ) : (
                                c.cedula
                              )}
                            </td>
                            <td>
                              {editingEncargadoId === c.id ? (
                                <input
                                  className="form-input"
                                  type="text"
                                  value={editingEncargadoNombre}
                                  onChange={(e) => setEditingEncargadoNombre(e.target.value)}
                                />
                              ) : (
                                c.nombre
                              )}
                            </td>
                            <td>
                              {editingEncargadoId === c.id ? (
                                <div className="users-table-actions">
                                  <button type="button" disabled={encargadosSaving} onClick={() => saveEditEncargado(c.id)}>
                                    {encargadosSaving ? 'Guardando...' : 'Guardar'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => {
                                      setEditingEncargadoId(null);
                                      setEditingEncargadoNombre('');
                                      setEditingEncargadoCedula('');
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <div className="users-table-actions">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingEncargadoId(c.id);
                                      setEditingEncargadoNombre(c.nombre);
                                      setEditingEncargadoCedula(c.cedula);
                                    }}
                                  >
                                    <IconEdit /> Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="danger"
                                    disabled={deletingEncargadoId === c.id}
                                    onClick={() => deleteEncargado(c.id, `${c.cedula} — ${c.nombre}`)}
                                  >
                                    <IconTrash /> Eliminar
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {settingsSubSection === 'cargos' && (
              <>
                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
                  Cargos (por obra)
                </h2>
                {cargosError && <p className="feedback feedback-error">{cargosError}</p>}

                <div className="form-field" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="cargos-filter-obra">
                    Obra
                  </label>
                  <select
                    id="cargos-filter-obra"
                    className="form-input"
                    value={cargosFilterProjectId}
                    onChange={(e) => setCargosFilterProjectId(e.target.value)}
                  >
                    {catalogosPorObraObrasOptions.length === 0 ? (
                      <option value="">— Sin obras —</option>
                    ) : (
                      catalogosPorObraObrasOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code} · {o.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <form className="auth-form" onSubmit={createCargo} style={{ marginBottom: '1.5rem' }}>
                  <div className="form-field">
                    <label className="form-label">Nombre del cargo</label>
                    <input
                      className="form-input"
                      type="text"
                      required
                      value={cargosNewNombre}
                      onChange={(e) => setCargosNewNombre(e.target.value)}
                      disabled={!cargosFilterProjectId}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={cargosSaving || !cargosFilterProjectId}
                    style={{ marginTop: '0.75rem' }}
                  >
                    {cargosSaving ? 'Creando...' : 'Crear cargo'}
                  </button>
                </form>

                <h2 className="shell-title" style={{ fontSize: '1.1rem' }}>Listado</h2>
                {!cargosFilterProjectId ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>
                    Seleccione una obra para ver o crear cargos.
                  </p>
                ) : cargosAdmin.length === 0 ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>
                    No hay cargos para esta obra. Cree uno arriba.
                  </p>
                ) : (
                  <div className="users-table-wrap">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>N.º</th>
                          <th>Nombre</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cargosAdmin.map((c) => (
                          <tr key={c.id}>
                            <td>{c.consecutivo ?? '—'}</td>
                            <td>
                              {editingCargoId === c.id ? (
                                <input
                                  className="form-input"
                                  type="text"
                                  value={editingCargoNombre}
                                  onChange={(e) => setEditingCargoNombre(e.target.value)}
                                />
                              ) : (
                                c.nombre
                              )}
                            </td>
                            <td>
                              {editingCargoId === c.id ? (
                                <div className="users-table-actions">
                                  <button type="button" disabled={cargosSaving} onClick={() => saveEditCargo(c.id)}>
                                    {cargosSaving ? 'Guardando...' : 'Guardar'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => {
                                      setEditingCargoId(null);
                                      setEditingCargoNombre('');
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <div className="users-table-actions">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCargoId(c.id);
                                      setEditingCargoNombre(c.nombre);
                                    }}
                                  >
                                    <IconEdit /> Editar
                                  </button>
                                  <button type="button" className="danger" disabled={deletingCargoId === c.id} onClick={() => deleteCargo(c.id, c.nombre)}>
                                    <IconTrash /> Eliminar
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {settingsSubSection === 'proveedores' && (
              <>
                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
                  Proveedores (por obra)
                </h2>
                {proveedoresError && <p className="feedback feedback-error">{proveedoresError}</p>}

                <div className="form-field" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="proveedores-filter-obra">
                    Obra
                  </label>
                  <select
                    id="proveedores-filter-obra"
                    className="form-input"
                    value={proveedoresFilterProjectId}
                    onChange={(e) => setProveedoresFilterProjectId(e.target.value)}
                  >
                    {catalogosPorObraObrasOptions.length === 0 ? (
                      <option value="">— Sin obras —</option>
                    ) : (
                      catalogosPorObraObrasOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code} · {o.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <form className="auth-form" onSubmit={createProveedor} style={{ marginBottom: '1.5rem' }}>
                  <div className="form-row-2">
                    <div className="form-field">
                      <label className="form-label">Tipo de persona</label>
                      <select
                        className="form-input"
                        value={proveedoresNewForm.tipoPersona}
                        onChange={(e) => setProveedoresNewForm((p) => ({ ...p, tipoPersona: e.target.value }))}
                        disabled={!proveedoresFilterProjectId}
                      >
                        <option value="Natural">Natural</option>
                        <option value="Jurídica">Jurídica</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Nombre / razón social</label>
                      <input
                        className="form-input"
                        required
                        value={proveedoresNewForm.nombreRazonSocial}
                        onChange={(e) => setProveedoresNewForm((p) => ({ ...p, nombreRazonSocial: e.target.value }))}
                        disabled={!proveedoresFilterProjectId}
                      />
                    </div>
                  </div>
                  <div className="form-row-2">
                    <div className="form-field">
                      <label className="form-label">Nombre comercial</label>
                      <input
                        className="form-input"
                        value={proveedoresNewForm.nombreComercial}
                        onChange={(e) => setProveedoresNewForm((p) => ({ ...p, nombreComercial: e.target.value }))}
                        disabled={!proveedoresFilterProjectId}
                      />
                    </div>
                    <div className="form-row-inline" style={{ alignItems: 'flex-start' }}>
                      <div className="form-field" style={{ flex: '1 1 12rem', marginBottom: 0 }}>
                        <label className="form-label">NIT o documento</label>
                        <input
                          className="form-input"
                          required
                          value={proveedoresNewForm.nitDocumento}
                          onChange={(e) => setProveedoresNewForm((p) => ({ ...p, nitDocumento: e.target.value }))}
                          disabled={!proveedoresFilterProjectId}
                        />
                      </div>
                      <div className="form-field" style={{ flex: '0 0 5rem', marginBottom: 0 }}>
                        <label className="form-label">DV</label>
                        <input
                          className="form-input"
                          value={proveedoresNewForm.dv}
                          onChange={(e) => setProveedoresNewForm((p) => ({ ...p, dv: e.target.value }))}
                          disabled={!proveedoresFilterProjectId}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="form-row-2">
                    <div className="form-field">
                      <label className="form-label">Email</label>
                      <input
                        className="form-input"
                        type="email"
                        value={proveedoresNewForm.email}
                        onChange={(e) => setProveedoresNewForm((p) => ({ ...p, email: e.target.value }))}
                        disabled={!proveedoresFilterProjectId}
                      />
                    </div>
                    <div className="form-row-inline" style={{ alignItems: 'flex-start' }}>
                      <div className="form-field" style={{ flex: '1 1 9rem', marginBottom: 0 }}>
                        <label className="form-label">Teléfono</label>
                        <input
                          className="form-input"
                          value={proveedoresNewForm.telefono}
                          onChange={(e) => setProveedoresNewForm((p) => ({ ...p, telefono: e.target.value }))}
                          disabled={!proveedoresFilterProjectId}
                        />
                      </div>
                      <div className="form-field" style={{ flex: '1 1 9rem', marginBottom: 0 }}>
                        <label className="form-label">Celular</label>
                        <input
                          className="form-input"
                          value={proveedoresNewForm.celular}
                          onChange={(e) => setProveedoresNewForm((p) => ({ ...p, celular: e.target.value }))}
                          disabled={!proveedoresFilterProjectId}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="form-field">
                    <label className="form-label">Dirección</label>
                    <input
                      className="form-input"
                      value={proveedoresNewForm.direccion}
                      onChange={(e) => setProveedoresNewForm((p) => ({ ...p, direccion: e.target.value }))}
                      disabled={!proveedoresFilterProjectId}
                    />
                  </div>
                  <div className="form-row-2">
                    <div className="form-field">
                      <label className="form-label">País</label>
                      <input
                        className="form-input"
                        value={proveedoresNewForm.pais}
                        onChange={(e) => setProveedoresNewForm((p) => ({ ...p, pais: e.target.value }))}
                        disabled={!proveedoresFilterProjectId}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Departamento</label>
                      <input
                        className="form-input"
                        value={proveedoresNewForm.departamento}
                        onChange={(e) => setProveedoresNewForm((p) => ({ ...p, departamento: e.target.value }))}
                        disabled={!proveedoresFilterProjectId}
                      />
                    </div>
                  </div>
                  <div className="form-row-2">
                    <div className="form-field">
                      <label className="form-label">Ciudad</label>
                      <input
                        className="form-input"
                        value={proveedoresNewForm.ciudad}
                        onChange={(e) => setProveedoresNewForm((p) => ({ ...p, ciudad: e.target.value }))}
                        disabled={!proveedoresFilterProjectId}
                      />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Código postal</label>
                      <input
                        className="form-input"
                        value={proveedoresNewForm.codigoPostal}
                        onChange={(e) => setProveedoresNewForm((p) => ({ ...p, codigoPostal: e.target.value }))}
                        disabled={!proveedoresFilterProjectId}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary" disabled={proveedoresSaving || !proveedoresFilterProjectId}>
                    {proveedoresSaving ? 'Creando...' : 'Crear proveedor'}
                  </button>
                </form>

                <h2 className="shell-title" style={{ fontSize: '1.1rem' }}>Listado</h2>
                {!proveedoresFilterProjectId ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>
                    Seleccione una obra para ver o crear proveedores.
                  </p>
                ) : proveedoresAdmin.length === 0 ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>
                    No hay proveedores para esta obra. Cree uno arriba.
                  </p>
                ) : (
                  <div className="users-table-wrap">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>Tipo</th>
                          <th>Proveedor</th>
                          <th>NIT / Doc.</th>
                          <th>Contacto</th>
                          <th>Ubicación</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {proveedoresAdmin.map((p) => (
                          <tr key={p.id}>
                            <td>
                              {editingProveedorId === p.id ? (
                                <select
                                  className="form-input"
                                  value={editingProveedorForm.tipoPersona}
                                  onChange={(e) => setEditingProveedorForm((f) => ({ ...f, tipoPersona: e.target.value }))}
                                >
                                  <option value="Natural">Natural</option>
                                  <option value="Jurídica">Jurídica</option>
                                </select>
                              ) : (
                                p.tipoPersona
                              )}
                            </td>
                            <td style={{ minWidth: '16rem' }}>
                              {editingProveedorId === p.id ? (
                                <div style={{ display: 'grid', gap: '0.4rem' }}>
                                  <input
                                    className="form-input"
                                    value={editingProveedorForm.nombreRazonSocial}
                                    onChange={(e) => setEditingProveedorForm((f) => ({ ...f, nombreRazonSocial: e.target.value }))}
                                    placeholder="Nombre / razón social"
                                  />
                                  <input
                                    className="form-input"
                                    value={editingProveedorForm.nombreComercial}
                                    onChange={(e) => setEditingProveedorForm((f) => ({ ...f, nombreComercial: e.target.value }))}
                                    placeholder="Nombre comercial"
                                  />
                                </div>
                              ) : (
                                <>
                                  <div style={{ fontWeight: 600 }}>{p.nombreRazonSocial}</div>
                                  <div className="shell-text-muted" style={{ fontSize: '0.78rem' }}>
                                    {p.nombreComercial || '—'}
                                  </div>
                                </>
                              )}
                            </td>
                            <td style={{ minWidth: '10rem' }}>
                              {editingProveedorId === p.id ? (
                                <div style={{ display: 'grid', gap: '0.4rem' }}>
                                  <input
                                    className="form-input"
                                    value={editingProveedorForm.nitDocumento}
                                    onChange={(e) => setEditingProveedorForm((f) => ({ ...f, nitDocumento: e.target.value }))}
                                    placeholder="NIT o documento"
                                  />
                                  <input
                                    className="form-input"
                                    value={editingProveedorForm.dv}
                                    onChange={(e) => setEditingProveedorForm((f) => ({ ...f, dv: e.target.value }))}
                                    placeholder="DV"
                                  />
                                </div>
                              ) : (
                                `${p.nitDocumento}${p.dv ? `-${p.dv}` : ''}`
                              )}
                            </td>
                            <td style={{ minWidth: '14rem' }}>
                              {editingProveedorId === p.id ? (
                                <div style={{ display: 'grid', gap: '0.4rem' }}>
                                  <input className="form-input" value={editingProveedorForm.email} onChange={(e) => setEditingProveedorForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" />
                                  <input className="form-input" value={editingProveedorForm.telefono} onChange={(e) => setEditingProveedorForm((f) => ({ ...f, telefono: e.target.value }))} placeholder="Teléfono" />
                                  <input className="form-input" value={editingProveedorForm.celular} onChange={(e) => setEditingProveedorForm((f) => ({ ...f, celular: e.target.value }))} placeholder="Celular" />
                                </div>
                              ) : (
                                <>
                                  <div>{p.email || '—'}</div>
                                  <div className="shell-text-muted" style={{ fontSize: '0.78rem' }}>
                                    {[p.telefono, p.celular].filter(Boolean).join(' / ') || '—'}
                                  </div>
                                </>
                              )}
                            </td>
                            <td style={{ minWidth: '15rem' }}>
                              {editingProveedorId === p.id ? (
                                <div style={{ display: 'grid', gap: '0.4rem' }}>
                                  <input className="form-input" value={editingProveedorForm.direccion} onChange={(e) => setEditingProveedorForm((f) => ({ ...f, direccion: e.target.value }))} placeholder="Dirección" />
                                  <input className="form-input" value={editingProveedorForm.pais} onChange={(e) => setEditingProveedorForm((f) => ({ ...f, pais: e.target.value }))} placeholder="País" />
                                  <input className="form-input" value={editingProveedorForm.departamento} onChange={(e) => setEditingProveedorForm((f) => ({ ...f, departamento: e.target.value }))} placeholder="Departamento" />
                                  <input className="form-input" value={editingProveedorForm.ciudad} onChange={(e) => setEditingProveedorForm((f) => ({ ...f, ciudad: e.target.value }))} placeholder="Ciudad" />
                                  <input className="form-input" value={editingProveedorForm.codigoPostal} onChange={(e) => setEditingProveedorForm((f) => ({ ...f, codigoPostal: e.target.value }))} placeholder="Código postal" />
                                </div>
                              ) : (
                                <>
                                  <div>{p.direccion || '—'}</div>
                                  <div className="shell-text-muted" style={{ fontSize: '0.78rem' }}>
                                    {[p.ciudad, p.departamento, p.pais].filter(Boolean).join(', ') || '—'}
                                  </div>
                                  <div className="shell-text-muted" style={{ fontSize: '0.78rem' }}>
                                    {p.codigoPostal || '—'}
                                  </div>
                                </>
                              )}
                            </td>
                            <td>
                              {editingProveedorId === p.id ? (
                                <input
                                  type="checkbox"
                                  checked={editingProveedorForm.isActive}
                                  onChange={(e) => setEditingProveedorForm((f) => ({ ...f, isActive: e.target.checked }))}
                                />
                              ) : p.isActive ? (
                                'Activo'
                              ) : (
                                'Inactivo'
                              )}
                            </td>
                            <td>
                              {editingProveedorId === p.id ? (
                                <div className="users-table-actions">
                                  <button type="button" disabled={proveedoresSaving} onClick={() => saveEditProveedor(p.id)}>
                                    {proveedoresSaving ? 'Guardando...' : 'Guardar'}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => {
                                      setEditingProveedorId(null);
                                      setEditingProveedorForm(emptyProveedorForm());
                                    }}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <div className="users-table-actions">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingProveedorId(p.id);
                                      setEditingProveedorForm({
                                        tipoPersona: p.tipoPersona,
                                        nombreRazonSocial: p.nombreRazonSocial,
                                        nombreComercial: p.nombreComercial ?? '',
                                        nitDocumento: p.nitDocumento,
                                        dv: p.dv ?? '',
                                        email: p.email ?? '',
                                        telefono: p.telefono ?? '',
                                        celular: p.celular ?? '',
                                        direccion: p.direccion ?? '',
                                        pais: p.pais ?? '',
                                        departamento: p.departamento ?? '',
                                        ciudad: p.ciudad ?? '',
                                        codigoPostal: p.codigoPostal ?? '',
                                        isActive: p.isActive,
                                      });
                                    }}
                                  >
                                    <IconEdit /> Editar
                                  </button>
                                  <button
                                    type="button"
                                    className="danger"
                                    disabled={deletingProveedorId === p.id}
                                    onClick={() => deleteProveedor(p.id, p.nombreComercial || p.nombreRazonSocial)}
                                  >
                                    <IconTrash /> Eliminar
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {(settingsSubSection === 'items' || settingsSubSection === 'estructuraItems') && (
              <>
                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>
                  {settingsSubSection === 'estructuraItems'
                    ? 'Capítulos y subcapítulos (por obra)'
                    : 'Ítems contractuales (por obra)'}
                </h2>
                {itemsError ? (
                  <p
                    className={
                      itemsError.startsWith('Importación completada') || itemsError.includes('correctamente')
                        ? 'feedback feedback-success'
                        : 'feedback feedback-error'
                    }
                  >
                    {itemsError}
                  </p>
                ) : null}

                <div className="form-field" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" htmlFor="items-filter-obra">Obra</label>
                  <select
                    id="items-filter-obra"
                    className="form-input"
                    value={itemsFilterProjectId}
                    onChange={(e) => setItemsFilterProjectId(e.target.value)}
                  >
                    {catalogosPorObraObrasOptions.length === 0 ? (
                      <option value="">— Sin obras —</option>
                    ) : (
                      catalogosPorObraObrasOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code} · {o.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {settingsSubSection === 'estructuraItems' && itemsFilterProjectId ? (
                  <>
                    <div className="budget-hierarchy-forms">
                      <section className="budget-inline-form">
                        <h4 className="shell-title" style={{ fontSize: '0.92rem', margin: 0 }}>
                          Configuración de capítulos
                        </h4>
                        <form onSubmit={createBudgetChapter}>
                          <div className="form-row-inline">
                            <div className="form-field" style={{ marginBottom: 0, minWidth: '6rem' }}>
                              <label className="form-label" htmlFor="budget-ch-codigo">Código</label>
                              <input
                                id="budget-ch-codigo"
                                className="form-input"
                                placeholder="ej. 1000"
                                value={budgetChapterCodigo}
                                onChange={(e) => setBudgetChapterCodigo(e.target.value)}
                                disabled={itemsSaving}
                              />
                            </div>
                            <div className="form-field" style={{ marginBottom: 0, flex: '1 1 10rem', minWidth: 0 }}>
                              <label className="form-label" htmlFor="budget-ch-nombre">Nombre</label>
                              <input
                                id="budget-ch-nombre"
                                className="form-input"
                                placeholder="Ej. Mantenimiento rutinario ciclorruta"
                                value={budgetChapterNombre}
                                onChange={(e) => setBudgetChapterNombre(e.target.value)}
                                disabled={itemsSaving}
                              />
                            </div>
                            <button type="submit" className="btn-primary" disabled={itemsSaving}>
                              Crear capítulo
                            </button>
                          </div>
                        </form>
                        {itemsBudgetChapters.length === 0 ? (
                          <p className="shell-text-muted" style={{ margin: 0 }}>
                            Aún no hay capítulos para esta obra.
                          </p>
                        ) : (
                          <div className="users-table-wrap">
                            <table className="users-table">
                              <thead>
                                <tr>
                                  <th>Código</th>
                                  <th>Nombre</th>
                                  <th>Orden</th>
                                  <th>Activo</th>
                                  <th>Subcapítulos</th>
                                  <th>Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {itemsBudgetChapters.map((ch) => (
                                  <tr key={ch.id}>
                                    <td>
                                      {editingBudgetChapterId === ch.id ? (
                                        <input
                                          className="form-input"
                                          type="text"
                                          value={editingBudgetChapterForm.codigo}
                                          onChange={(e) =>
                                            setEditingBudgetChapterForm((p) => ({ ...p, codigo: e.target.value }))
                                          }
                                        />
                                      ) : (
                                        ch.codigo
                                      )}
                                    </td>
                                    <td>
                                      {editingBudgetChapterId === ch.id ? (
                                        <input
                                          className="form-input"
                                          type="text"
                                          value={editingBudgetChapterForm.nombre}
                                          onChange={(e) =>
                                            setEditingBudgetChapterForm((p) => ({ ...p, nombre: e.target.value }))
                                          }
                                        />
                                      ) : (
                                        ch.nombre
                                      )}
                                    </td>
                                    <td>
                                      {editingBudgetChapterId === ch.id ? (
                                        <input
                                          className="form-input"
                                          type="number"
                                          value={editingBudgetChapterForm.orden}
                                          onChange={(e) =>
                                            setEditingBudgetChapterForm((p) => ({
                                              ...p,
                                              orden: Number(e.target.value) || 0,
                                            }))
                                          }
                                        />
                                      ) : (
                                        ch.orden
                                      )}
                                    </td>
                                    <td>
                                      {editingBudgetChapterId === ch.id ? (
                                        <input
                                          type="checkbox"
                                          checked={editingBudgetChapterForm.isActive}
                                          onChange={(e) =>
                                            setEditingBudgetChapterForm((p) => ({ ...p, isActive: e.target.checked }))
                                          }
                                        />
                                      ) : ch.isActive ? (
                                        'Sí'
                                      ) : (
                                        'No'
                                      )}
                                    </td>
                                    <td>{ch.subchapters.length}</td>
                                    <td>
                                      {editingBudgetChapterId === ch.id ? (
                                        <div className="users-table-actions">
                                          <button
                                            type="button"
                                            onClick={() => saveEditBudgetChapter(ch.id)}
                                            disabled={itemsSaving}
                                          >
                                            {itemsSaving ? 'Guardando...' : 'Guardar'}
                                          </button>
                                          <button
                                            type="button"
                                            className="btn-cancel"
                                            onClick={() => {
                                              setEditingBudgetChapterId(null);
                                              setEditingBudgetChapterForm({
                                                codigo: '',
                                                nombre: '',
                                                orden: 0,
                                                isActive: true,
                                              });
                                            }}
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="users-table-actions">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingBudgetChapterId(ch.id);
                                              setEditingBudgetChapterForm({
                                                codigo: ch.codigo,
                                                nombre: ch.nombre,
                                                orden: ch.orden,
                                                isActive: ch.isActive,
                                              });
                                            }}
                                          >
                                            <IconEdit /> Editar
                                          </button>
                                          <button
                                            type="button"
                                            className="danger"
                                            disabled={itemsSaving}
                                            onClick={() => deleteBudgetChapter(ch.id, `${ch.codigo} ${ch.nombre}`)}
                                          >
                                            <IconTrash /> Eliminar
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                      <section className="budget-inline-form">
                        <h4 className="shell-title" style={{ fontSize: '0.92rem', margin: 0 }}>
                          Configuración de subcapítulos
                        </h4>
                        <form onSubmit={createBudgetSubchapter}>
                          <div className="form-row-inline">
                            <div className="form-field" style={{ marginBottom: 0, minWidth: '10rem', flex: '1 1 40%' }}>
                              <label className="form-label" htmlFor="budget-sub-ch">Capítulo padre</label>
                              <select
                                id="budget-sub-ch"
                                className="form-input"
                                value={budgetSubchapterChapterId}
                                onChange={(e) => setBudgetSubchapterChapterId(e.target.value)}
                                disabled={itemsSaving || itemsBudgetChapters.length === 0}
                              >
                                <option value="">— Seleccione —</option>
                                {itemsBudgetChapters.map((ch) => (
                                  <option key={ch.id} value={ch.id}>
                                    {ch.codigo} · {ch.nombre}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="form-field" style={{ marginBottom: 0, flex: '1 1 8rem', minWidth: 0 }}>
                              <label className="form-label" htmlFor="budget-sub-nombre">Nombre</label>
                              <input
                                id="budget-sub-nombre"
                                className="form-input"
                                placeholder="Ej. Ciclorruta en adoquín"
                                value={budgetSubchapterNombre}
                                onChange={(e) => setBudgetSubchapterNombre(e.target.value)}
                                disabled={itemsSaving}
                              />
                            </div>
                            <button type="submit" className="btn-primary" disabled={itemsSaving || itemsBudgetChapters.length === 0}>
                              Crear subcapítulo
                            </button>
                          </div>
                        </form>
                        {budgetSubchaptersFlat.length === 0 ? (
                          <p className="shell-text-muted" style={{ margin: 0 }}>
                            Cree al menos un subcapítulo para poder asociar ítems.
                          </p>
                        ) : (
                          <div className="users-table-wrap">
                            <table className="users-table">
                              <thead>
                                <tr>
                                  <th>Capítulo</th>
                                  <th>Subcapítulo</th>
                                  <th>Orden</th>
                                  <th>Activo</th>
                                  <th>Ítems</th>
                                  <th>Acciones</th>
                                </tr>
                              </thead>
                              <tbody>
                                {budgetSubchaptersFlat.map((sub) => (
                                  <tr key={sub.id}>
                                    <td>
                                      {editingBudgetSubchapterId === sub.id ? (
                                        <select
                                          className="form-input"
                                          value={editingBudgetSubchapterForm.chapterId}
                                          onChange={(e) =>
                                            setEditingBudgetSubchapterForm((p) => ({
                                              ...p,
                                              chapterId: e.target.value,
                                            }))
                                          }
                                        >
                                          {itemsBudgetChapters.map((ch) => (
                                            <option key={ch.id} value={ch.id}>
                                              {ch.codigo} · {ch.nombre}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <>
                                          <div style={{ fontWeight: 600 }}>{sub.chapterCodigo}</div>
                                          <div className="shell-text-muted" style={{ fontSize: '0.78rem', lineHeight: 1.25 }}>
                                            {sub.chapterNombre}
                                          </div>
                                        </>
                                      )}
                                    </td>
                                    <td>
                                      {editingBudgetSubchapterId === sub.id ? (
                                        <input
                                          className="form-input"
                                          type="text"
                                          value={editingBudgetSubchapterForm.nombre}
                                          onChange={(e) =>
                                            setEditingBudgetSubchapterForm((p) => ({ ...p, nombre: e.target.value }))
                                          }
                                        />
                                      ) : (
                                        sub.nombre
                                      )}
                                    </td>
                                    <td>
                                      {editingBudgetSubchapterId === sub.id ? (
                                        <input
                                          className="form-input"
                                          type="number"
                                          value={editingBudgetSubchapterForm.orden}
                                          onChange={(e) =>
                                            setEditingBudgetSubchapterForm((p) => ({
                                              ...p,
                                              orden: Number(e.target.value) || 0,
                                            }))
                                          }
                                        />
                                      ) : (
                                        sub.orden
                                      )}
                                    </td>
                                    <td>
                                      {editingBudgetSubchapterId === sub.id ? (
                                        <input
                                          type="checkbox"
                                          checked={editingBudgetSubchapterForm.isActive}
                                          onChange={(e) =>
                                            setEditingBudgetSubchapterForm((p) => ({ ...p, isActive: e.target.checked }))
                                          }
                                        />
                                      ) : sub.isActive ? (
                                        'Sí'
                                      ) : (
                                        'No'
                                      )}
                                    </td>
                                    <td>{sub.items.length}</td>
                                    <td>
                                      {editingBudgetSubchapterId === sub.id ? (
                                        <div className="users-table-actions">
                                          <button
                                            type="button"
                                            onClick={() => saveEditBudgetSubchapter(sub.id)}
                                            disabled={itemsSaving}
                                          >
                                            {itemsSaving ? 'Guardando...' : 'Guardar'}
                                          </button>
                                          <button
                                            type="button"
                                            className="btn-cancel"
                                            onClick={() => {
                                              setEditingBudgetSubchapterId(null);
                                              setEditingBudgetSubchapterForm({
                                                chapterId: '',
                                                nombre: '',
                                                orden: 0,
                                                isActive: true,
                                              });
                                            }}
                                          >
                                            Cancelar
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="users-table-actions">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingBudgetSubchapterId(sub.id);
                                              setEditingBudgetSubchapterForm({
                                                chapterId: sub.chapterId,
                                                nombre: sub.nombre,
                                                orden: sub.orden,
                                                isActive: sub.isActive,
                                              });
                                            }}
                                          >
                                            <IconEdit /> Editar
                                          </button>
                                          <button
                                            type="button"
                                            className="danger"
                                            disabled={itemsSaving}
                                            onClick={() => deleteBudgetSubchapter(sub.id, sub.nombre)}
                                          >
                                            <IconTrash /> Eliminar
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </section>
                    </div>
                  </>
                ) : null}

                {settingsSubSection === 'items' ? (
                  <>
                <form className="auth-form" onSubmit={createItemCatalog} style={{ marginBottom: '1.5rem' }}>
                  <h3 className="shell-title" style={{ fontSize: '1rem' }}>Crear ítem manual</h3>
                  <div className="form-field" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label" htmlFor="item-new-subchapter">
                      Capítulo / subcapítulo donde se guardará este ítem
                    </label>
                    <select
                      id="item-new-subchapter"
                      className="form-input"
                      required
                      value={itemsTargetSubchapterId}
                      onChange={(e) => setItemsTargetSubchapterId(e.target.value)}
                      disabled={itemsSaving || subchapterPickerOptions.length === 0}
                    >
                      {subchapterPickerOptions.length === 0 ? (
                        <option value="">— Primero cree un capítulo y un subcapítulo —</option>
                      ) : (
                        subchapterPickerOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))
                      )}
                    </select>
                    <p className="shell-text-muted" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
                      El ítem quedará asociado al subcapítulo seleccionado aquí.
                    </p>
                  </div>
                  <div className="form-field" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label" htmlFor="item-new-proveedor">
                      Proveedor
                    </label>
                    <select
                      id="item-new-proveedor"
                      className="form-input"
                      required
                      value={itemNewProveedorId}
                      onChange={(e) => setItemNewProveedorId(e.target.value)}
                      disabled={itemsSaving || itemProveedorOptions.length === 0}
                    >
                      {itemProveedorOptions.length === 0 ? (
                        <option value="">— Primero cree un proveedor activo —</option>
                      ) : (
                        itemProveedorOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {(p.nombreComercial || p.nombreRazonSocial)} · {p.nitDocumento}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="form-row-inline">
                    <div className="form-field" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="item-new-codigo">Código</label>
                      <input
                        id="item-new-codigo"
                        className="form-input personal-input-readonly"
                        type="text"
                        readOnly
                        aria-readonly="true"
                        value={
                          itemsFilterProjectId
                            ? nextAutonumericItemCatalogCodigo(itemsAdminFlat)
                            : '—'
                        }
                        title="Se asigna automáticamente al crear el ítem (siguiente número disponible en esta obra)."
                      />
                    </div>
                    <div className="form-field" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="item-new-unidad">Unidad</label>
                      <select
                        id="item-new-unidad"
                        className="form-input"
                        required
                        value={normalizeItemCatalogUnit(itemNewUnidad) ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setItemNewUnidad(v);
                          const patch = getItemCatalogUnitChangePatch(v);
                          if (patch.largo !== undefined) setItemNewLargo(patch.largo);
                          if (patch.ancho !== undefined) setItemNewAncho(patch.ancho);
                          if (patch.altura !== undefined) setItemNewAltura(patch.altura);
                          if (patch.cantidad !== undefined) setItemNewCantidad(patch.cantidad);
                        }}
                      >
                        <option value="">Seleccione unidad…</option>
                        {ITEM_CATALOG_UNIT_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field" style={{ marginBottom: 0 }}>
                      <label className="form-label">Precio unitario</label>
                      <input className="form-input" type="number" step="0.01" value={itemNewPrecio} onChange={(e) => setItemNewPrecio(e.target.value)} />
                    </div>
                  </div>
                  {itemCatalogCaptureKind(itemNewUnidad) === 'm3' ? (
                    <div className="form-row-inline">
                      <div className="form-field" style={{ marginBottom: 0 }}>
                        <label className="form-label">Largo (m)</label>
                        <input className="form-input" type="number" step="0.01" value={itemNewLargo} onChange={(e) => setItemNewLargo(e.target.value)} />
                      </div>
                      <div className="form-field" style={{ marginBottom: 0 }}>
                        <label className="form-label">Ancho (m)</label>
                        <input className="form-input" type="number" step="0.01" value={itemNewAncho} onChange={(e) => setItemNewAncho(e.target.value)} />
                      </div>
                      <div className="form-field" style={{ marginBottom: 0 }}>
                        <label className="form-label">Alto (m)</label>
                        <input className="form-input" type="number" step="0.01" value={itemNewAltura} onChange={(e) => setItemNewAltura(e.target.value)} />
                      </div>
                    </div>
                  ) : null}
                  {itemCatalogCaptureKind(itemNewUnidad) === 'm2' ? (
                    <div className="form-row-inline">
                      <div className="form-field" style={{ marginBottom: 0 }}>
                        <label className="form-label">Largo (m)</label>
                        <input className="form-input" type="number" step="0.01" value={itemNewLargo} onChange={(e) => setItemNewLargo(e.target.value)} />
                      </div>
                      <div className="form-field" style={{ marginBottom: 0 }}>
                        <label className="form-label">Ancho (m)</label>
                        <input className="form-input" type="number" step="0.01" value={itemNewAncho} onChange={(e) => setItemNewAncho(e.target.value)} />
                      </div>
                    </div>
                  ) : null}
                  {itemCatalogCaptureKind(itemNewUnidad) === 'length' ? (
                    <div className="form-row-inline">
                      <div className="form-field" style={{ marginBottom: 0 }}>
                        <label className="form-label">Largo (m)</label>
                        <input className="form-input" type="number" step="0.01" value={itemNewLargo} onChange={(e) => setItemNewLargo(e.target.value)} />
                      </div>
                    </div>
                  ) : null}
                  {itemCatalogCaptureKind(itemNewUnidad) === 'manual' ? (
                    <p className="shell-text-muted" style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                      Cantidad manual (und, kg, ton o litros). Las medidas L/A/H no aplican para esta unidad.
                    </p>
                  ) : null}
                  <div className="form-row-inline">
                    <div className="form-field" style={{ marginBottom: 0 }}>
                      <label className="form-label">
                        {itemCatalogCaptureKind(itemNewUnidad) === 'manual'
                          ? 'Cantidad'
                          : itemCatalogCaptureKind(itemNewUnidad) === 'none'
                            ? 'Cantidad'
                            : 'Cantidad (calculada)'}
                      </label>
                      {itemCatalogCaptureKind(itemNewUnidad) === 'manual' ? (
                        <input
                          className="form-input"
                          type="number"
                          step="0.01"
                          value={itemNewCantidad}
                          onChange={(e) => setItemNewCantidad(e.target.value)}
                        />
                      ) : (
                        <input
                          className="form-input personal-input-readonly"
                          type="text"
                          readOnly
                          value={formatItemCatalogCantidadDisplay(
                            itemNewUnidad,
                            itemNewLargo,
                            itemNewAncho,
                            itemNewAltura,
                            itemNewCantidad,
                          )}
                        />
                      )}
                    </div>
                    <div className="form-field" style={{ marginBottom: 0 }}>
                      <label className="form-label">Total (cantidad × precio)</label>
                      <input
                        className="form-input personal-input-readonly"
                        type="text"
                        readOnly
                        value={
                          formatItemCatalogSubtotal(
                            itemNewPrecio.trim() ? Number(itemNewPrecio.replace(',', '.')) : null,
                            computeItemCatalogCantidadFromInputs(
                              itemNewUnidad,
                              itemNewLargo,
                              itemNewAncho,
                              itemNewAltura,
                              itemNewCantidad,
                            ),
                          ) ?? '—'
                        }
                      />
                    </div>
                  </div>
                  <RegistroFotograficoInput
                    idBase="item-new-imagen"
                    label="Imagen (archivo)"
                    imageUrl={itemNewImagenUrl}
                    disabled={!itemsFilterProjectId}
                    onFileSelected={async (file) => {
                      setItemsError(null);
                      try {
                        return await uploadRegistroFotografico(file);
                      } catch (err) {
                        setItemsError(err instanceof Error ? err.message : 'Error al subir imagen.');
                        return null;
                      }
                    }}
                    onUploaded={(foto) => {
                      setItemNewImagenUrl(foto.url);
                      setItemNewFotoGeo(fotoGeoPayload(foto));
                    }}
                    onClear={() => {
                      setItemNewImagenUrl('');
                      setItemNewFotoGeo(emptyFotoGeoFields());
                    }}
                    onPreview={setRegistroFotoPreviewUrl}
                  />
                  <div className="form-field">
                    <label className="form-label">Descripción</label>
                    <input className="form-input" type="text" required value={itemNewDescripcion} onChange={(e) => setItemNewDescripcion(e.target.value)} />
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={itemsSaving || !itemsFilterProjectId || !itemsTargetSubchapterId || !itemNewProveedorId}
                  >
                    {itemsSaving ? 'Guardando...' : 'Crear ítem'}
                  </button>
                </form>

                <h2 className="shell-title" style={{ fontSize: '1.1rem' }}>Listado</h2>
                {!itemsFilterProjectId ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>
                    Seleccione una obra para ver o crear ítems.
                  </p>
                ) : itemsBudgetChapters.length === 0 ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>
                    No se pudo cargar la jerarquía de presupuesto. Compruebe la base de datos (migración Prisma).
                  </p>
                ) : itemsAdminFlat.length === 0 ? (
                  <p className="shell-text-muted" style={{ padding: '1rem' }}>
                    Aún no hay ítems en ningún subcapítulo. Cree un ítem arriba y asígnelo al subcapítulo correspondiente.
                  </p>
                ) : null}
                {itemsFilterProjectId && itemsBudgetChapters.length > 0 && itemsAdminFlat.length > 0 ? (
                  <div className="users-table-wrap">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>Capítulo</th>
                          <th>Subcapítulo</th>
                          <th>Proveedor</th>
                          <th>Código</th>
                          <th>Descripción</th>
                          <th>Unidad</th>
                          <th>Largo</th>
                          <th>Ancho</th>
                          <th>Altura</th>
                          <th>Imagen</th>
                          <th>Precio</th>
                          <th>Cantidad</th>
                          <th>Total</th>
                          <th>Activo</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsAdminFlat.map((it) => (
                          <tr key={it.id}>
                            <td style={{ maxWidth: '9rem', verticalAlign: 'top' }}>
                              {editingItemId === it.id ? (
                                <span className="shell-text-muted" style={{ fontSize: '0.78rem' }}>
                                  {it.chapterCodigo} · {it.chapterNombre}
                                </span>
                              ) : (
                                <>
                                  <div style={{ fontWeight: 600 }}>{it.chapterCodigo}</div>
                                  <div className="shell-text-muted" style={{ fontSize: '0.78rem', lineHeight: 1.25 }}>
                                    {it.chapterNombre}
                                  </div>
                                </>
                              )}
                            </td>
                            <td style={{ maxWidth: '10rem', verticalAlign: 'top' }}>
                              {editingItemId === it.id ? (
                                <select
                                  className="form-input"
                                  style={{ minWidth: '9rem', fontSize: '0.78rem' }}
                                  value={editingItemForm.subchapterId}
                                  onChange={(e) => setEditingItemForm((p) => ({ ...p, subchapterId: e.target.value }))}
                                >
                                  {subchapterPickerOptions.map((o) => (
                                    <option key={o.id} value={o.id}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                it.subchapterNombre
                              )}
                            </td>
                            <td style={{ minWidth: '12rem', verticalAlign: 'top' }}>
                              {editingItemId === it.id ? (
                                <select
                                  className="form-input"
                                  value={editingItemForm.proveedorId}
                                  onChange={(e) => setEditingItemForm((p) => ({ ...p, proveedorId: e.target.value }))}
                                >
                                  <option value="">— Proveedor —</option>
                                  {itemProveedorOptions.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {(p.nombreComercial || p.nombreRazonSocial)} · {p.nitDocumento}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                it.proveedorNombre ?? '—'
                              )}
                            </td>
                            <td>
                              {editingItemId === it.id ? (
                                <input className="form-input" type="text" value={editingItemForm.codigo} onChange={(e) => setEditingItemForm((p) => ({ ...p, codigo: e.target.value }))} />
                              ) : it.codigo}
                            </td>
                            <td>
                              {editingItemId === it.id ? (
                                <input className="form-input" type="text" value={editingItemForm.descripcion} onChange={(e) => setEditingItemForm((p) => ({ ...p, descripcion: e.target.value }))} />
                              ) : it.descripcion}
                            </td>
                            <td>
                              {editingItemId === it.id ? (
                                <select
                                  className="form-input"
                                  style={{ minWidth: '12rem' }}
                                  value={
                                    normalizeItemCatalogUnit(editingItemForm.unidad) ??
                                    (editingItemForm.unidad.trim() ? editingItemForm.unidad.trim() : '')
                                  }
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    const patch = getItemCatalogUnitChangePatch(v);
                                    setEditingItemForm((p) => ({
                                      ...p,
                                      unidad: v,
                                      ...(patch.largo !== undefined ? { largo: patch.largo } : {}),
                                      ...(patch.ancho !== undefined ? { ancho: patch.ancho } : {}),
                                      ...(patch.altura !== undefined ? { altura: patch.altura } : {}),
                                      ...(patch.cantidad !== undefined ? { cantidad: patch.cantidad } : {}),
                                    }));
                                  }}
                                >
                                  <option value="">— Unidad —</option>
                                  {normalizeItemCatalogUnit(editingItemForm.unidad) == null &&
                                  editingItemForm.unidad.trim() ? (
                                    <option value={editingItemForm.unidad.trim()}>
                                      {editingItemForm.unidad.trim()} (texto en BD)
                                    </option>
                                  ) : null}
                                  {ITEM_CATALOG_UNIT_OPTIONS.map((o) => (
                                    <option key={o.value} value={o.value}>
                                      {o.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                it.unidad ?? '—'
                              )}
                            </td>
                            <td>
                              {editingItemId === it.id ? (
                                <input
                                  className="form-input"
                                  type="number"
                                  step="0.01"
                                  disabled={
                                    itemCatalogCaptureKind(editingItemForm.unidad) === 'manual' ||
                                    itemCatalogCaptureKind(editingItemForm.unidad) === 'none'
                                  }
                                  value={editingItemForm.largo}
                                  onChange={(e) => setEditingItemForm((p) => ({ ...p, largo: e.target.value }))}
                                />
                              ) : (it.largo != null ? Number(it.largo).toLocaleString('es-CO') : '—')}
                            </td>
                            <td>
                              {editingItemId === it.id ? (
                                <input
                                  className="form-input"
                                  type="number"
                                  step="0.01"
                                  disabled={
                                    itemCatalogCaptureKind(editingItemForm.unidad) !== 'm3' &&
                                    itemCatalogCaptureKind(editingItemForm.unidad) !== 'm2'
                                  }
                                  value={editingItemForm.ancho}
                                  onChange={(e) => setEditingItemForm((p) => ({ ...p, ancho: e.target.value }))}
                                />
                              ) : (it.ancho != null ? Number(it.ancho).toLocaleString('es-CO') : '—')}
                            </td>
                            <td>
                              {editingItemId === it.id ? (
                                <input
                                  className="form-input"
                                  type="number"
                                  step="0.01"
                                  disabled={itemCatalogCaptureKind(editingItemForm.unidad) !== 'm3'}
                                  value={editingItemForm.altura}
                                  onChange={(e) => setEditingItemForm((p) => ({ ...p, altura: e.target.value }))}
                                />
                              ) : (it.altura != null ? Number(it.altura).toLocaleString('es-CO') : '—')}
                            </td>
                            <td>
                              {editingItemId === it.id ? (
                                <RegistroFotograficoInput
                                  idBase={`item-edit-imagen-${it.id}`}
                                  label="Imagen"
                                  imageUrl={editingItemForm.imagenUrl}
                                  disabled={!itemsFilterProjectId}
                                  onFileSelected={async (file) => {
                                    setItemsError(null);
                                    try {
                                      return await uploadRegistroFotografico(file);
                                    } catch (err) {
                                      setItemsError(err instanceof Error ? err.message : 'Error al subir imagen.');
                                      return null;
                                    }
                                  }}
                                  onUploaded={(foto) =>
                                    setEditingItemForm((p) => ({ ...p, imagenUrl: foto.url, ...fotoGeoPayload(foto) }))
                                  }
                                  onClear={() =>
                                    setEditingItemForm((p) => ({ ...p, imagenUrl: '', ...clearFotoGeoPayload() }))
                                  }
                                  onPreview={setRegistroFotoPreviewUrl}
                                />
                              ) : (
                                it.imagenUrl ? (
                                  <button type="button" className="registro-foto-preview-btn" onClick={() => setRegistroFotoPreviewUrl(it.imagenUrl ?? '')}>
                                    <img src={it.imagenUrl} alt="Imagen ítem" className="calidad-table-thumb" />
                                  </button>
                                ) : '—'
                              )}
                            </td>
                            <td>
                              {editingItemId === it.id ? (
                                <input className="form-input" type="number" step="0.01" value={editingItemForm.precioUnitario} onChange={(e) => setEditingItemForm((p) => ({ ...p, precioUnitario: e.target.value }))} />
                              ) : (it.precioUnitario != null ? Number(it.precioUnitario).toLocaleString('es-CO') : '—')}
                            </td>
                            <td>
                              {editingItemId === it.id ? (
                                itemCatalogCaptureKind(editingItemForm.unidad) === 'manual' ? (
                                  <input
                                    className="form-input"
                                    type="number"
                                    step="0.01"
                                    value={editingItemForm.cantidad}
                                    onChange={(e) => setEditingItemForm((p) => ({ ...p, cantidad: e.target.value }))}
                                  />
                                ) : itemCatalogCaptureKind(editingItemForm.unidad) === 'none' ? (
                                  <span className="shell-text-muted">—</span>
                                ) : (
                                  <input
                                    className="form-input personal-input-readonly"
                                    type="text"
                                    readOnly
                                    value={formatItemCatalogCantidadDisplay(
                                      editingItemForm.unidad,
                                      editingItemForm.largo,
                                      editingItemForm.ancho,
                                      editingItemForm.altura,
                                      editingItemForm.cantidad,
                                    )}
                                  />
                                )
                              ) : (it.cantidad != null ? Number(it.cantidad).toLocaleString('es-CO') : '—')}
                            </td>
                            <td>
                              {editingItemId === it.id ? (
                                <input
                                  className="form-input personal-input-readonly"
                                  type="text"
                                  readOnly
                                  value={
                                    formatItemCatalogSubtotal(
                                      editingItemForm.precioUnitario.trim()
                                        ? Number(editingItemForm.precioUnitario.replace(',', '.'))
                                        : null,
                                      computeItemCatalogCantidadFromInputs(
                                        editingItemForm.unidad,
                                        editingItemForm.largo,
                                        editingItemForm.ancho,
                                        editingItemForm.altura,
                                        editingItemForm.cantidad,
                                      ),
                                    ) ?? '—'
                                  }
                                />
                              ) : (
                                formatItemCatalogSubtotal(it.precioUnitario, it.cantidad) ?? '—'
                              )}
                            </td>
                            <td>
                              {editingItemId === it.id ? (
                                <input type="checkbox" checked={editingItemForm.isActive} onChange={(e) => setEditingItemForm((p) => ({ ...p, isActive: e.target.checked }))} />
                              ) : (it.isActive ? 'Sí' : 'No')}
                            </td>
                            <td>
                              {editingItemId === it.id ? (
                                <div className="users-table-actions">
                                  <button type="button" onClick={() => saveEditItem(it.id)} disabled={itemsSaving}>
                                    {itemsSaving ? 'Guardando...' : 'Guardar'}
                                  </button>
                                  <button type="button" className="btn-cancel" onClick={() => setEditingItemId(null)}>
                                    Cancelar
                                  </button>
                                </div>
                              ) : (
                                <div className="users-table-actions">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingItemId(it.id);
                                      setEditingItemForm({
                                        codigo: it.codigo,
                                        descripcion: it.descripcion,
                                        unidad: it.unidad ?? '',
                                        precioUnitario: it.precioUnitario != null ? String(it.precioUnitario) : '',
                                        cantidad: it.cantidad != null ? String(it.cantidad) : '',
                                        largo: it.largo != null ? String(it.largo) : '',
                                        ancho: it.ancho != null ? String(it.ancho) : '',
                                        altura: it.altura != null ? String(it.altura) : '',
                                        imagenUrl: it.imagenUrl ?? '',
                                        ...fotoGeoFromSource(it),
                                        proveedorId: it.proveedorId ?? '',
                                        isActive: it.isActive,
                                        subchapterId: it.subchapterId,
                                      });
                                    }}
                                  >
                                    <IconEdit /> Editar
                                  </button>
                                  <button type="button" className="danger" onClick={() => deleteItem(it.id, `${it.codigo} - ${it.descripcion}`)} disabled={deletingItemId === it.id}>
                                    <IconTrash /> Eliminar
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                  </>
                ) : null}
              </>
            )}
          </section>
        )}

        {activeSection === 'users' && (
          <section className="shell-card shell-card-wide">
            <h1 className="shell-title">Gestión de usuarios</h1>
            <p className="shell-text">
              Crear usuarios, administrar la lista o editar roles y permisos. Solo SUPER ADMIN puede
              gestionar esta sección.
            </p>
            <div className="users-tabs">
              <button
                type="button"
                className={`users-tab ${usersSubSection === 'crear' ? 'users-tab-active' : ''}`}
                onClick={() => setUsersSubSection('crear')}
              >
                <IconUserPlus />
                Crear usuario
              </button>
              <button
                type="button"
                className={`users-tab ${usersSubSection === 'administrar' ? 'users-tab-active' : ''}`}
                onClick={() => setUsersSubSection('administrar')}
              >
                <IconUsers />
                Administrar usuarios
              </button>
              <button
                type="button"
                className={`users-tab ${usersSubSection === 'roles' ? 'users-tab-active' : ''}`}
                onClick={() => setUsersSubSection('roles')}
              >
                <IconShield />
                Administrar roles
              </button>
            </div>

            {usersSubSection === 'crear' && (
              <>
                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>Crear usuario y asignar rol</h2>
                <p className="shell-text">
                  Completa los datos del colaborador. Solo SUPER ADMIN puede crear nuevos accesos.
                </p>
                <form className="auth-form" onSubmit={handleCreateUser}>
                  <div className="form-field">
                    <label className="form-label" htmlFor="u-identification">Número de identificación</label>
                    <input
                      id="u-identification"
                      className="form-input"
                      type="text"
                      inputMode="numeric"
                      required
                      value={userForm.identification}
                      onChange={(e) => setUserForm({ ...userForm, identification: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="u-name">Nombre completo</label>
                    <input
                      id="u-name"
                      className="form-input"
                      type="text"
                      required
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="u-email">Correo electrónico</label>
                    <input
                      id="u-email"
                      className="form-input"
                      type="email"
                      required
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="u-role">Rol</label>
                    <select
                      id="u-role"
                      className="form-input"
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                    >
                      {availableRoles.map((r) => (
                        <option key={r.role} value={r.role}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-field">
                    <label className="form-label" htmlFor="u-password">Contraseña inicial</label>
                    <input
                      id="u-password"
                      className="form-input"
                      type="password"
                      required
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="btn-primary" disabled={creatingUser || !userForm.role}>
                    {creatingUser ? 'Creando usuario...' : 'Crear usuario'}
                  </button>
                </form>
              </>
            )}

            {usersSubSection === 'administrar' && (
              <>
                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>Listado de usuarios</h2>
                <p className="shell-text">
                  Editar datos, inactivar o eliminar usuarios. No puede eliminar su propio usuario.
                </p>
                {userMessage && <p className="feedback feedback-success">{userMessage}</p>}
                {userError && <p className="feedback feedback-error">{userError}</p>}
                {loadingUsers ? (
                  <p className="shell-text-muted">Cargando usuarios...</p>
                ) : (
                  <div className="users-table-wrap">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>Identificación</th>
                          <th>Nombre</th>
                          <th>Correo</th>
                          <th>Rol</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersList.map((u) => (
                          <tr key={u.id}>
                            <td>{u.identification}</td>
                            <td>{u.name}</td>
                            <td>{u.email}</td>
                            <td>{availableRoles.find((r) => r.role === u.role)?.label ?? u.role}</td>
                            <td>
                              <span className={u.isActive ? 'users-badge-active' : 'users-badge-inactive'}>
                                {u.isActive ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td>
                              <div className="users-table-actions">
                                <button type="button" onClick={() => openEditUser(u)} aria-label="Editar">
                                  <IconEdit /> Editar
                                </button>
                                <button type="button" onClick={() => toggleUserActive(u)}>
                                  {u.isActive ? 'Inactivar' : 'Activar'}
                                </button>
                                <button type="button" className="danger" onClick={() => deleteUser(u)} aria-label="Eliminar">
                                  <IconTrash /> Eliminar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {usersList.length === 0 && (
                      <p className="shell-text-muted" style={{ padding: '1rem' }}>No hay usuarios para mostrar.</p>
                    )}
                  </div>
                )}
                {editUser && (
                  <div role="dialog" aria-modal="true" aria-labelledby="edit-user-title" style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#f9fafb', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                    <h3 id="edit-user-title" className="shell-title" style={{ marginBottom: '0.75rem' }}>Editar usuario</h3>
                    <form onSubmit={saveEditUser}>
                      <div className="form-field">
                        <label className="form-label">Identificación</label>
                        <input className="form-input" type="text" value={editUser.identification} readOnly disabled />
                      </div>
                      <div className="form-field">
                        <label className="form-label">Nombre</label>
                        <input
                          className="form-input"
                          type="text"
                          required
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </div>
                      <div className="form-field">
                        <label className="form-label">Correo</label>
                        <input
                          className="form-input"
                          type="email"
                          required
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        />
                      </div>
                      <div className="form-field">
                        <label className="form-label">Rol</label>
                        <select
                          className="form-input"
                          value={editForm.role}
                          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                        >
                          {availableRoles.map((r) => (
                            <option key={r.role} value={r.role}>{r.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-field">
                        <label className="form-label">Nueva contraseña (dejar en blanco para no cambiar)</label>
                        <input
                          className="form-input"
                          type="password"
                          value={editForm.password}
                          onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                        />
                      </div>
                      <div className="form-actions-row">
                        <button type="submit" className="btn-primary" disabled={savingUser}>
                          {savingUser ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button type="button" className="btn-cancel" onClick={() => setEditUser(null)}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </>
            )}

            {usersSubSection === 'roles' && (
              <>
                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>Crear rol</h2>
                <p className="shell-text">
                  La clave debe ser única (letras, números, guión bajo). El nombre es el texto que verán los usuarios.
                </p>
                {roleMessage && <p className="feedback feedback-success">{roleMessage}</p>}
                {roleError && <p className="feedback feedback-error">{roleError}</p>}
                <form className="auth-form" style={{ marginBottom: '1.5rem' }} onSubmit={createRole}>
                  <div className="form-row-inline">
                    <div className="form-field" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="new-role-key">Clave del rol</label>
                      <input
                        id="new-role-key"
                        className="form-input"
                        type="text"
                        placeholder="EJ. SUPERVISOR"
                        value={newRoleKey}
                        onChange={(e) => setNewRoleKey(e.target.value.toUpperCase())}
                      />
                    </div>
                    <div className="form-field" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="new-role-label">Nombre a mostrar</label>
                      <input
                        id="new-role-label"
                        className="form-input"
                        type="text"
                        placeholder="Ej. Supervisor de obra"
                        value={newRoleLabel}
                        onChange={(e) => setNewRoleLabel(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn-primary" disabled={creatingRole || !newRoleKey.trim()}>
                      {creatingRole ? 'Creando...' : 'Crear rol'}
                    </button>
                  </div>
                </form>

                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '0.5rem' }}>Editar o eliminar roles</h2>
                <p className="shell-text">
                  Cambia el nombre mostrado o elimina un rol. No se puede eliminar un rol si hay usuarios asignados.
                </p>
                {loadingRoleLabels ? (
                  <p className="shell-text-muted">Cargando roles...</p>
                ) : (
                  <div className="roles-admin-list">
                    {roleLabels.map((r) => (
                      <div key={r.role} className="roles-admin-item">
                        <label>{r.role}</label>
                        <input
                          type="text"
                          value={editingRoleLabel[r.role] ?? r.label}
                          onChange={(e) => setEditingRoleLabel((prev) => ({ ...prev, [r.role]: e.target.value }))}
                        />
                        <button
                          type="button"
                          disabled={savingRoleLabel === r.role}
                          onClick={() => saveRoleLabel(r.role)}
                        >
                          {savingRoleLabel === r.role ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                          type="button"
                          className="danger"
                          style={{ marginLeft: '0.25rem' }}
                          disabled={deletingRole === r.role}
                          onClick={() => deleteRole(r.role)}
                          aria-label={`Eliminar rol ${r.role}`}
                        >
                          <IconTrash /> Eliminar
                        </button>
                      </div>
                    ))}
                    {roleLabels.length === 0 && (
                      <p className="shell-text-muted">No hay roles. Crea uno arriba.</p>
                    )}
                  </div>
                )}
                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>Permisos de menú por rol</h2>
                <p className="shell-text">
                  Marca las opciones de menú que cada rol puede ver.
                </p>
                {permissionsError && (
                  <p className="feedback feedback-error" role="alert">
                    {permissionsError}
                  </p>
                )}
                {loadingPermissions ? (
                  <p className="shell-text-muted">Cargando permisos...</p>
                ) : (
                  <div className="perms-table-wrap">
                    <table className="perms-table" cellPadding={0} cellSpacing={0}>
                      <thead>
                        <tr>
                          <th className="perms-th perms-th-role">Rol</th>
                          {permissionMenuKeys.map((key) => (
                            <th key={key} className="perms-th">{MENU_LABELS[key as keyof typeof MENU_LABELS] ?? key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rolePermissions.map((row) => {
                          const role = row.role;
                          const menuKeys = row.menuKeys ?? [];
                          return (
                            <tr key={role}>
                              <td className="perms-td perms-td-role">
                                {row.label ?? role}
                                {savingRole === role && <span className="perms-saving"> Guardando...</span>}
                              </td>
                              {permissionMenuKeys.map((menuKey) => (
                                <td key={menuKey} className="perms-td perms-td-check">
                                  <label className="perms-check-label">
                                    <input
                                      type="checkbox"
                                      checked={menuKeys.includes(menuKey)}
                                      disabled={savingRole === role}
                                      onChange={(e) => handlePermissionToggle(role, menuKey, e.target.checked)}
                                    />
                                    <span className="perms-check-box" />
                                  </label>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <h2 className="shell-title" style={{ fontSize: '1.1rem', marginTop: '1.75rem' }}>
                  Permisos de firma (Evidencias y cierre)
                </h2>
                <p className="shell-text">
                  Indica qué roles reciben el <strong>código en la barra superior</strong> y en qué{' '}
                  <strong>tipo de firma</strong> pueden registrar. Para poder firmar una fila hace falta marcar{' '}
                  <strong>Código barra</strong> y la columna de esa fila. Si un rol no tiene filas aquí, se aplican los
                  valores por defecto del sistema.
                </p>
                {loadingPermissions ? (
                  <p className="shell-text-muted">Cargando permisos de firma...</p>
                ) : (
                  <div className="perms-table-wrap">
                    <table className="perms-table" cellPadding={0} cellSpacing={0}>
                      <thead>
                        <tr>
                          <th className="perms-th perms-th-role">Rol</th>
                          {FIRMA_PERM_ADMIN_KEYS.map((key) => (
                            <th key={key} className="perms-th">
                              {FIRMA_PERM_LABELS[key]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rolePermissions.map((row) => {
                          const role = row.role;
                          const firmaPermKeys = row.firmaPermKeys ?? [];
                          return (
                            <tr key={`firma-${role}`}>
                              <td className="perms-td perms-td-role">
                                {row.label ?? role}
                                {savingRole === role && <span className="perms-saving"> Guardando...</span>}
                              </td>
                              {FIRMA_PERM_ADMIN_KEYS.map((permKey) => (
                                <td key={permKey} className="perms-td perms-td-check">
                                  <label className="perms-check-label">
                                    <input
                                      type="checkbox"
                                      checked={firmaPermKeys.includes(permKey)}
                                      disabled={savingRole === role}
                                      onChange={(e) =>
                                        handleFirmaPermissionToggle(role, permKey, e.target.checked)
                                      }
                                    />
                                    <span className="perms-check-box" />
                                  </label>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {usersSubSection !== 'administrar' && (userMessage || userError) && (
              <>
                {userMessage && <p className="feedback feedback-success">{userMessage}</p>}
                {userError && <p className="feedback feedback-error">{userError}</p>}
              </>
            )}
          </section>
        )}

        {isInformeSection && (
          <div className="obra-selector-bar">
            <label htmlFor="informe-obra-select" className="obra-selector-label">
              Obra
            </label>
            {loadingObrasForInforme ? (
              <span className="shell-text-muted">Cargando obras...</span>
            ) : (
              <select
                id="informe-obra-select"
                className="obra-selector-select"
                value={selectedObraId}
                onChange={(e) => setSelectedObraId(e.target.value)}
              >
                <option value="">Seleccione la obra</option>
                {obrasForInforme.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} – {o.name}
                  </option>
                ))}
              </select>
            )}
            <label htmlFor="informe-jornada-select" className="obra-selector-label" style={{ marginLeft: '1rem' }}>
              Jornada
            </label>
            {loadingJornadasCatalog ? (
              <span className="shell-text-muted">Cargando jornadas...</span>
            ) : (
              <select
                id="informe-jornada-select"
                className="obra-selector-select"
                value={selectedJornadaId}
                onChange={(e) => setSelectedJornadaId(e.target.value)}
                title="Turno / rango horario del informe (configuración)"
              >
                <option value="">Seleccione la jornada</option>
                {jornadasCatalog.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.nombre} ({j.horaInicio} – {j.horaFin})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {isInformeSection && selectedObraId && selectedJornadaId && (
          <p className="informe-clave-banner" role="status">
            <strong className="informe-clave-banner-label">Informe (obra · fecha · jornada):</strong>{' '}
            <span>{informeClaveLinea.obraTxt}</span>
            <span className="informe-clave-sep" aria-hidden>
              {' '}
              ·{' '}
            </span>
            <span>{informeClaveLinea.fechaFmt}</span>
            <span className="informe-clave-sep" aria-hidden>
              {' '}
              ·{' '}
            </span>
            <span>{informeClaveLinea.jornadaTxt}</span>
          </p>
        )}

        {isInformeSection && informeBloqueado && (
          <p className="feedback feedback-success" style={{ margin: '0 0 0.75rem' }}>
            Este informe está cerrado (cuatro firmas completas). Solo lectura. Puede cambiar la fecha del reporte u
            obra/jornada para trabajar en otro informe.
            {cerradoEn
              ? ` Cerrado: ${new Date(cerradoEn).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}.`
              : ''}
          </p>
        )}

        {activeSection === 'datos' && (
          <section className="shell-card">
            <h1 className="shell-title">Informe diario - Datos generales</h1>
            {informeMessage && <p className="feedback feedback-success">{informeMessage}</p>}
            {informeError && <p className="feedback feedback-error">{informeError}</p>}
            <form className="auth-form informe-datos-form" onSubmit={submitDatosGenerales}>
              <div className="informe-field">
                <label className="informe-label" htmlFor="fecha-reporte">FECHA DE REPORTE *</label>
                <div className="informe-input-wrap">
                  <input
                    id="fecha-reporte"
                    className="form-input"
                    type="date"
                    required
                    value={datosGeneralesForm.fechaReporte}
                    onChange={(e) => setDatosGeneralesForm((f) => ({ ...f, fechaReporte: e.target.value }))}
                  />
                  <span className="informe-input-icon" aria-hidden><IconCalendar /></span>
                </div>
              </div>
              <fieldset disabled={informeBloqueado} style={informeFieldsetStyle}>
              <div className="informe-field">
                <label className="informe-label" htmlFor="informe-no">INFORME NO. *</label>
                <div className="informe-input-wrap">
                  <input
                    id="informe-no"
                    className="form-input"
                    type="text"
                    placeholder="Ej: IDO-2026-001"
                    required
                    readOnly
                    aria-readonly="true"
                    value={datosGeneralesForm.informeNo}
                    onChange={(e) => setDatosGeneralesForm((f) => ({ ...f, informeNo: e.target.value }))}
                  />
                  <span className="informe-input-icon" aria-hidden><IconMic /></span>
                </div>
              </div>
              <div className="informe-field">
                <label className="informe-label" htmlFor="centro-trabajo">CENTRO DE TRABAJO *</label>
                <div className="informe-input-wrap">
                  <input
                    id="centro-trabajo"
                    className="form-input"
                    type="text"
                    required
                    readOnly
                    aria-readonly="true"
                    value={datosGeneralesForm.centroTrabajo}
                    onChange={(e) => setDatosGeneralesForm((f) => ({ ...f, centroTrabajo: e.target.value }))}
                  />
                  <span className="informe-input-icon" aria-hidden><IconMic /></span>
                </div>
              </div>
              <div className="informe-field">
                <label className="informe-label" htmlFor="frente-obra">FRENTE DE OBRA *</label>
                <div className="informe-input-wrap">
                  <InformeSearchableSelect
                    id="frente-obra"
                    value={frenteSelectValue}
                    disabled={!selectedObraId}
                    emptyOptionLabel={selectedObraId ? 'Seleccione...' : 'Seleccione una obra arriba'}
                    searchPlaceholder="Buscar frente de obra…"
                    options={frenteSelectOptions.map((o) => ({ value: o.id, label: o.nombre }))}
                    onChange={(v) => {
                      if (!v) {
                        setDatosGeneralesForm((f) => ({ ...f, frenteObra: '', frenteObraCatalogoId: '' }));
                        return;
                      }
                      if (v === 'local') {
                        const row = frenteSelectOptions.find((o) => o.id === 'local');
                        setDatosGeneralesForm((f) => ({
                          ...f,
                          frenteObraCatalogoId: 'local',
                          frenteObra: row?.nombre ?? f.frenteObra,
                        }));
                        return;
                      }
                      setDatosGeneralesForm((f) => {
                        const fromCatalog = frentesObraOptions.find((o) => o.id === v);
                        return {
                          ...f,
                          frenteObraCatalogoId: v,
                          frenteObra: fromCatalog?.nombre ?? f.frenteObra,
                        };
                      });
                    }}
                  />
                </div>
              </div>
              <div className="informe-field">
                <label className="informe-label" htmlFor="contratista">CONTRATISTA *</label>
                <div className="informe-input-wrap">
                  <InformeSearchableSelect
                    id="contratista"
                    value={contratSelectValue}
                    disabled={!selectedObraId}
                    emptyOptionLabel={selectedObraId ? 'Seleccione...' : 'Seleccione una obra arriba'}
                    searchPlaceholder="Buscar por cédula o nombre…"
                    options={contratSelectOptions.map((o) => ({
                      value: o.id,
                      label:
                        o.id === 'local' ? o.nombre : o.cedula ? `${o.cedula} - ${o.nombre}` : o.nombre,
                    }))}
                    onChange={(v) => {
                      if (!v) {
                        setDatosGeneralesForm((f) => ({ ...f, contratista: '', contratistaCatalogoId: '' }));
                        return;
                      }
                      if (v === 'local') {
                        setDatosGeneralesForm((f) => ({
                          ...f,
                          contratistaCatalogoId: 'local',
                          contratista: f.contratista,
                        }));
                        return;
                      }
                      const row = contratSelectOptions.find((o) => o.id === v);
                      setDatosGeneralesForm((f) => ({
                        ...f,
                        contratistaCatalogoId: v,
                        contratista: row?.nombre ?? f.contratista,
                      }));
                    }}
                  />
                </div>
              </div>
              <div className="informe-field">
                <label className="informe-label" htmlFor="encargado">ENCARGADO DE REPORTE *</label>
                <div className="informe-input-wrap">
                  <InformeSearchableSelect
                    id="encargado"
                    value={encargadoSelectValue}
                    disabled={!selectedObraId}
                    emptyOptionLabel={selectedObraId ? 'Seleccione...' : 'Seleccione una obra arriba'}
                    searchPlaceholder="Buscar por cédula o nombre…"
                    options={encargadoSelectOptions.map((o) => ({
                      value: o.id,
                      label:
                        o.id === 'local' ? o.nombre : o.cedula ? `${o.cedula} - ${o.nombre}` : o.nombre,
                    }))}
                    onChange={(v) => {
                      if (!v) {
                        setDatosGeneralesForm((f) => ({ ...f, encargadoReporte: '', encargadoReporteCatalogoId: '' }));
                        return;
                      }
                      if (v === 'local') {
                        setDatosGeneralesForm((f) => ({
                          ...f,
                          encargadoReporteCatalogoId: 'local',
                          encargadoReporte: f.encargadoReporte,
                        }));
                        return;
                      }
                      const row = encargadoSelectOptions.find((o) => o.id === v);
                      setDatosGeneralesForm((f) => ({
                        ...f,
                        encargadoReporteCatalogoId: v,
                        encargadoReporte: row?.nombre ?? f.encargadoReporte,
                      }));
                    }}
                  />
                </div>
              </div>
              <div className="informe-field">
                <label className="informe-label" htmlFor="cargo">CARGO *</label>
                <div className="informe-input-wrap">
                  <InformeSearchableSelect
                    id="cargo"
                    value={cargoSelectValue}
                    disabled={!selectedObraId}
                    emptyOptionLabel={selectedObraId ? 'Seleccione...' : 'Seleccione una obra arriba'}
                    searchPlaceholder="Buscar cargo…"
                    options={cargoSelectOptions.map((o) => ({
                      value: o.id,
                      label: o.consecutivo != null ? `${o.consecutivo}. ${o.nombre}` : o.nombre,
                    }))}
                    onChange={(v) => {
                      if (!v) {
                        setDatosGeneralesForm((f) => ({ ...f, cargo: '', cargoCatalogoId: '' }));
                        return;
                      }
                      if (v === 'local') {
                        const row = cargoSelectOptions.find((o) => o.id === 'local');
                        setDatosGeneralesForm((f) => ({
                          ...f,
                          cargoCatalogoId: 'local',
                          cargo: row?.nombre ?? f.cargo,
                        }));
                        return;
                      }
                      const row = cargoSelectOptions.find((o) => o.id === v);
                      setDatosGeneralesForm((f) => ({
                        ...f,
                        cargoCatalogoId: v,
                        cargo: row?.nombre ?? f.cargo,
                      }));
                    }}
                  />
                </div>
              </div>
              <div className="form-row-2">
                <div className="informe-field">
                  <label className="informe-label" htmlFor="hora-entrada">HORA DE ENTRADA *</label>
                  <div className="informe-input-wrap">
                    <input
                      id="hora-entrada"
                      className="form-input"
                      type="time"
                      required
                      value={datosGeneralesForm.horaEntrada}
                      onChange={(e) => setDatosGeneralesForm((f) => ({ ...f, horaEntrada: e.target.value }))}
                    />
                    <span className="informe-input-icon" aria-hidden><IconClock /></span>
                  </div>
                </div>
                <div className="informe-field">
                  <label className="informe-label" htmlFor="hora-salida">HORA DE SALIDA *</label>
                  <div className="informe-input-wrap">
                    <input
                      id="hora-salida"
                      className="form-input"
                      type="time"
                      required
                      value={datosGeneralesForm.horaSalida}
                      onChange={(e) => setDatosGeneralesForm((f) => ({ ...f, horaSalida: e.target.value }))}
                    />
                    <span className="informe-input-icon" aria-hidden><IconClock /></span>
                  </div>
                </div>
              </div>
              <div className="informe-field">
                <label className="informe-label">HORAS TOTALES DE OPERACIÓN</label>
                <div className="informe-input-readonly">{horasTotalesDisplay}</div>
              </div>
              <button
                type="submit"
                className="btn-primary"
                disabled={
                  savingInforme ||
                  informeBloqueado ||
                  !selectedObraId ||
                  !selectedJornadaId ||
                  !datosGeneralesForm.informeNo ||
                  !datosGeneralesForm.centroTrabajo ||
                  !datosGeneralesForm.fechaReporte ||
                  !datosGeneralesForm.contratista ||
                  !datosGeneralesForm.encargadoReporte ||
                  !datosGeneralesForm.cargo ||
                  !datosGeneralesForm.frenteObra
                }
              >
                {savingInforme ? 'Guardando...' : 'Guardar informe'}
              </button>
              </fieldset>
            </form>
          </section>
        )}

        {activeSection === 'jornada' && (
          <section className="shell-card">
            <h1 className="shell-title">Jornada y condiciones</h1>
            {jornadaMessage && <p className="feedback feedback-success">{jornadaMessage}</p>}
            {jornadaError && <p className="feedback feedback-error">{jornadaError}</p>}

            <div className="auth-form">
              <fieldset disabled={informeBloqueado} style={informeFieldsetStyle}>
                {editingSuspensionId && (
                  <>
                    <div className="section-divider">
                      <h2 className="section-title">Editar suspensión</h2>
                    </div>
                    <div className="informe-field">
                      <label className="informe-label" htmlFor="edit-motivo-suspension">MOTIVO *</label>
                      <div className="informe-input-wrap">
                        <textarea
                          id="edit-motivo-suspension"
                          className="form-input textarea-input"
                          rows={3}
                          value={editSuspensionDraft.motivoSuspension}
                          onChange={(e) =>
                            setEditSuspensionDraft((p) => ({ ...p, motivoSuspension: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="informe-icon-button textarea-mic"
                          aria-label="Dictar motivo"
                          onClick={() => void startVoiceCapture('editSuspensionMotivo')}
                        >
                          <IconMic />
                        </button>
                      </div>
                    </div>
                    <div className="form-row-2">
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="edit-hora-suspension">DESDE (SUSPENSIÓN) *</label>
                        <div className="informe-input-wrap">
                          <input
                            id="edit-hora-suspension"
                            className="form-input"
                            type="time"
                            value={editSuspensionDraft.horaSuspension}
                            onChange={(e) =>
                              setEditSuspensionDraft((p) => ({ ...p, horaSuspension: e.target.value }))
                            }
                          />
                          <span className="informe-input-icon" aria-hidden><IconClock /></span>
                        </div>
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="edit-hora-reinicio">HASTA (REINICIO) *</label>
                        <div className="informe-input-wrap">
                          <input
                            id="edit-hora-reinicio"
                            className="form-input"
                            type="time"
                            value={editSuspensionDraft.horaReinicio}
                            onChange={(e) =>
                              setEditSuspensionDraft((p) => ({ ...p, horaReinicio: e.target.value }))
                            }
                          />
                          <span className="informe-input-icon" aria-hidden><IconClock /></span>
                        </div>
                      </div>
                    </div>
                    <div className="form-row-2 form-row-2--align-inputs-end">
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="edit-tipo-clima">TIPO *</label>
                        <InformeSearchableSelect
                          id="edit-tipo-clima"
                          value={editSuspensionDraft.tipoClima}
                          disabled={informeBloqueado}
                          emptyOptionLabel="Seleccione…"
                          searchPlaceholder="Buscar tipo…"
                          options={[...CLIMA_INFORME_OPTIONS]}
                          onChange={(v) => setEditSuspensionDraft((p) => ({ ...p, tipoClima: v }))}
                        />
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="edit-horas-clima">HORAS (CALCULADAS)</label>
                        <p className="informe-label-hint">Según desde y hasta.</p>
                        <input
                          id="edit-horas-clima"
                          className="form-input"
                          type="number"
                          readOnly
                          value={horasEditCalculadas}
                        />
                      </div>
                    </div>
                    <RegistroFotograficoInput
                      idBase="edit-suspension-imagen"
                      label="Imagen (opcional)"
                      imageUrl={editSuspensionDraft.imagenUrl}
                      disabled={informeBloqueado || savingSuspension || !selectedObraId}
                      onFileSelected={async (file) => {
                        setJornadaError(null);
                        try {
                          return await uploadRegistroFotografico(file);
                        } catch (err) {
                          setJornadaError(err instanceof Error ? err.message : 'Error al subir imagen.');
                          return null;
                        }
                      }}
                      onUploaded={(foto) =>
                        setEditSuspensionDraft((p) => ({ ...p, imagenUrl: foto.url, ...fotoGeoPayload(foto) }))
                      }
                      onClear={() => setEditSuspensionDraft((p) => ({ ...p, imagenUrl: '', ...clearFotoGeoPayload() }))}
                      onPreview={setRegistroFotoPreviewUrl}
                    />
                    <div className="suspensiones-edit-actions">
                      <button type="button" className="btn-secondary" onClick={cancelarEdicionSuspension}>
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={savingSuspension}
                        onClick={() => void guardarEdicionSuspension()}
                      >
                        {savingSuspension ? 'Guardando…' : 'Guardar cambios'}
                      </button>
                    </div>
                  </>
                )}

                {!editingSuspensionId && (
                  <>
                    <div className="section-divider">
                      <h2 className="section-title">Nueva suspensión</h2>
                    </div>
                    <div className="informe-field">
                      <label className="informe-label" htmlFor="motivo-suspension">MOTIVO DE SUSPENSIÓN *</label>
                      <div className="informe-input-wrap">
                        <textarea
                          id="motivo-suspension"
                          className="form-input textarea-input"
                          rows={3}
                          placeholder="Describa el motivo"
                          value={suspensionDraft.motivoSuspension}
                          onChange={(e) =>
                            setSuspensionDraft((p) => ({ ...p, motivoSuspension: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="informe-icon-button textarea-mic"
                          aria-label="Dictar motivo de suspensión"
                          onClick={() => void startVoiceCapture('suspensionDraftMotivo')}
                        >
                          <IconMic />
                        </button>
                      </div>
                    </div>
                    <div className="form-row-2">
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="hora-suspension">HORA DE SUSPENSIÓN *</label>
                        <div className="informe-input-wrap">
                          <input
                            id="hora-suspension"
                            className="form-input"
                            type="time"
                            value={suspensionDraft.horaSuspension}
                            onChange={(e) =>
                              setSuspensionDraft((p) => ({ ...p, horaSuspension: e.target.value }))
                            }
                          />
                          <span className="informe-input-icon" aria-hidden><IconClock /></span>
                        </div>
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="hora-reinicio">HORA DE REINICIO *</label>
                        <div className="informe-input-wrap">
                          <input
                            id="hora-reinicio"
                            className="form-input"
                            type="time"
                            value={suspensionDraft.horaReinicio}
                            onChange={(e) =>
                              setSuspensionDraft((p) => ({ ...p, horaReinicio: e.target.value }))
                            }
                          />
                          <span className="informe-input-icon" aria-hidden><IconClock /></span>
                        </div>
                      </div>
                    </div>
                    <div className="form-row-2 form-row-2--align-inputs-end">
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="tipo-clima">TIPO *</label>
                        <InformeSearchableSelect
                          id="tipo-clima"
                          value={suspensionDraft.tipoClima}
                          disabled={informeBloqueado}
                          emptyOptionLabel="Seleccione…"
                          searchPlaceholder="Buscar tipo…"
                          options={[...CLIMA_INFORME_OPTIONS]}
                          onChange={(v) => setSuspensionDraft((p) => ({ ...p, tipoClima: v }))}
                        />
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="horas-clima">HORAS CON ESA CONDICIÓN</label>
                        <p className="informe-label-hint">Se calcula con la hora de suspensión y la de reinicio.</p>
                        <input
                          id="horas-clima"
                          className="form-input"
                          type="number"
                          readOnly
                          aria-readonly="true"
                          value={horasDraftCalculadas}
                        />
                      </div>
                    </div>
                    <RegistroFotograficoInput
                      idBase="suspension-imagen"
                      label="Imagen (opcional)"
                      imageUrl={suspensionDraft.imagenUrl}
                      disabled={informeBloqueado || savingSuspension || !selectedObraId}
                      onFileSelected={async (file) => {
                        setJornadaError(null);
                        try {
                          return await uploadRegistroFotografico(file);
                        } catch (err) {
                          setJornadaError(err instanceof Error ? err.message : 'Error al subir imagen.');
                          return null;
                        }
                      }}
                      onUploaded={(foto) =>
                        setSuspensionDraft((p) => ({ ...p, imagenUrl: foto.url, ...fotoGeoPayload(foto) }))
                      }
                      onClear={() => setSuspensionDraft((p) => ({ ...p, imagenUrl: '', ...clearFotoGeoPayload() }))}
                      onPreview={setRegistroFotoPreviewUrl}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ width: '100%', marginTop: '0.25rem' }}
                      disabled={
                        savingSuspension ||
                        informeBloqueado ||
                        !selectedObraId ||
                        !selectedJornadaId
                      }
                      onClick={() => void agregarSuspension()}
                    >
                      {savingSuspension ? 'Guardando…' : 'Agregar suspensión a la lista'}
                    </button>
                  </>
                )}

                <div className="section-divider">
                  <h2 className="section-title">Suspensiones registradas</h2>
                </div>
                {loadingSuspensiones ? (
                  <p className="shell-text-muted">Cargando…</p>
                ) : suspensionesRows.length === 0 ? (
                  <p className="shell-text-muted">No hay suspensiones para esta obra, fecha y jornada.</p>
                ) : (
                  <div className="users-table-wrap suspensiones-table-wrap">
                    <table className="users-table suspensiones-table">
                      <thead>
                        <tr>
                          <th>Motivo</th>
                          <th>Desde</th>
                          <th>Hasta</th>
                          <th>Tipo</th>
                          <th>Horas</th>
                          <th>Imagen</th>
                          <th aria-label="Acciones" />
                        </tr>
                      </thead>
                      <tbody>
                        {suspensionesRows.map((row) => (
                          <tr key={row.id}>
                            <td className="suspensiones-td-motivo">{row.motivoSuspension}</td>
                            <td>{row.horaSuspension}</td>
                            <td>{row.horaReinicio}</td>
                            <td>{climaInformeLabel(row.tipoClima)}</td>
                            <td>{row.horasClima}</td>
                            <td>
                              {row.imagenUrl ? (
                                <img
                                  src={row.imagenUrl}
                                  alt="Imagen de suspensión"
                                  className="calidad-table-thumb"
                                />
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="suspensiones-td-actions">
                              <button
                                type="button"
                                className="suspensiones-icon-btn"
                                title="Editar"
                                disabled={informeBloqueado}
                                onClick={() => iniciarEdicionSuspension(row)}
                              >
                                <IconEdit />
                              </button>
                              <button
                                type="button"
                                className="suspensiones-icon-btn suspensiones-icon-btn-danger"
                                title="Eliminar"
                                disabled={informeBloqueado}
                                onClick={() => void eliminarSuspension(row.id)}
                              >
                                <IconTrash />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </fieldset>
            </div>
          </section>
        )}

        {activeSection === 'personal' && (
          <section className="shell-card shell-card-wide">
            <fieldset disabled={informeBloqueado} style={informeFieldsetStyle}>
            <h1 className="shell-title">Personal en obra</h1>

            {personalMessage && <p className="feedback feedback-success">{personalMessage}</p>}
            {personalError && <p className="feedback feedback-error">{personalError}</p>}

            {loadingPersonal ? (
              <p className="shell-text-muted">Cargando personal...</p>
            ) : (
              <>
                <div className="personal-form-panel auth-form">
                  <div className="section-divider">
                    <h2 className="section-title">
                      {personalEditingIndex !== null ? 'Editar persona' : 'Agregar persona'}
                    </h2>
                  </div>
                  <div className="informe-field">
                    <label className="informe-label" htmlFor="personal-draft-nombre">
                      Nombre y apellidos *
                    </label>
                    <div className="informe-input-wrap">
                      <input
                        id="personal-draft-nombre"
                        className="personal-input personal-input-with-mic"
                        type="text"
                        autoComplete="name"
                        placeholder="Nombre completo"
                        value={personalDraft.nombre}
                        onChange={(e) => setPersonalDraft((d) => ({ ...d, nombre: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="informe-icon-button"
                        aria-label="Dictar nombre y apellidos"
                        onClick={() => void startVoiceCapture('personalDraftNombre')}
                      >
                        <IconMic />
                      </button>
                    </div>
                  </div>
                  <div className="informe-field">
                    <label className="informe-label" htmlFor="personal-draft-cargo">
                      Cargo
                    </label>
                    <div className="informe-input-wrap">
                      <input
                        id="personal-draft-cargo"
                        className="personal-input personal-input-with-mic"
                        type="text"
                        placeholder="Cargo en obra"
                        value={personalDraft.cargo}
                        onChange={(e) => setPersonalDraft((d) => ({ ...d, cargo: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="informe-icon-button"
                        aria-label="Dictar cargo"
                        onClick={() => void startVoiceCapture('personalDraftCargo')}
                      >
                        <IconMic />
                      </button>
                    </div>
                  </div>
                  <div className="informe-field">
                    <label className="informe-label" htmlFor="personal-draft-sub">
                      Subcontratista
                    </label>
                    <div className="informe-input-wrap">
                      <input
                        id="personal-draft-sub"
                        className="personal-input personal-input-with-mic"
                        type="text"
                        placeholder="Empresa o subcontratista"
                        value={personalDraft.subcontratista}
                        onChange={(e) =>
                          setPersonalDraft((d) => ({ ...d, subcontratista: e.target.value }))
                        }
                      />
                      <button
                        type="button"
                        className="informe-icon-button"
                        aria-label="Dictar subcontratista"
                        onClick={() => void startVoiceCapture('personalDraftSubcontratista')}
                      >
                        <IconMic />
                      </button>
                    </div>
                  </div>
                  <div className="personal-form-times">
                    <div className="informe-field">
                      <label className="informe-label" htmlFor="personal-draft-entrada">
                        Hora entrada
                      </label>
                      <div className="personal-time-wrap">
                        <input
                          id="personal-draft-entrada"
                          className="personal-input"
                          type="time"
                          value={personalDraft.horaEntrada}
                          onChange={(e) =>
                            setPersonalDraft((d) => ({ ...d, horaEntrada: e.target.value }))
                          }
                        />
                        <span className="personal-time-icon" aria-hidden>
                          <IconClock />
                        </span>
                      </div>
                    </div>
                    <div className="informe-field">
                      <label className="informe-label" htmlFor="personal-draft-salida">
                        Hora salida
                      </label>
                      <div className="personal-time-wrap">
                        <input
                          id="personal-draft-salida"
                          className="personal-input"
                          type="time"
                          value={personalDraft.horaSalida}
                          onChange={(e) =>
                            setPersonalDraft((d) => ({ ...d, horaSalida: e.target.value }))
                          }
                        />
                        <span className="personal-time-icon" aria-hidden>
                          <IconClock />
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="personal-form-actions">
                    <button type="button" className="btn-primary" onClick={commitPersonalDraft}>
                      {personalEditingIndex !== null ? 'Guardar cambios' : 'Agregar a la lista'}
                    </button>
                    {personalEditingIndex !== null && (
                      <button type="button" className="btn-secondary" onClick={cancelPersonalDraft}>
                        Cancelar edición
                      </button>
                    )}
                  </div>
                </div>

                <div className="section-divider">
                  <h2 className="section-title">
                    Personal en lista ({personalRows.length})
                  </h2>
                </div>
                {personalRows.length === 0 ? (
                  <p className="shell-text-muted">
                    No hay personas en la lista. Complete el formulario de arriba y pulse «Agregar a la lista».
                    Luego use «Guardar personal» para enviar al informe.
                  </p>
                ) : (
                  <div className="personal-list">
                    {personalRows.map((r, idx) => (
                      <div
                        key={r.id ?? `personal-${idx}`}
                        className={`personal-list-card${
                          personalEditingIndex === idx ? ' personal-list-card-editing' : ''
                        }`}
                      >
                        <div className="personal-list-card-head">
                          <div className="personal-list-card-name">
                            {r.nombre.trim() || `Persona ${idx + 1}`}
                          </div>
                          <div className="personal-list-card-actions">
                            <button
                              type="button"
                              className="suspensiones-icon-btn"
                              title="Editar"
                              aria-label="Editar"
                              onClick={() => startEditPersonal(idx)}
                            >
                              <IconEdit />
                            </button>
                            <button
                              type="button"
                              className="suspensiones-icon-btn suspensiones-icon-btn-danger"
                              title="Quitar de la lista"
                              aria-label="Quitar de la lista"
                              onClick={() => removePersonalRow(idx)}
                            >
                              <IconTrash />
                            </button>
                          </div>
                        </div>
                        <div className="personal-list-card-meta">
                          <div>
                            <strong>Cargo:</strong> {r.cargo.trim() || '—'}
                          </div>
                          <div>
                            <strong>Subcontratista:</strong> {r.subcontratista.trim() || '—'}
                          </div>
                          <div>
                            <strong>Jornada:</strong>{' '}
                            {r.horaEntrada || r.horaSalida
                              ? `${r.horaEntrada || '—'} → ${r.horaSalida || '—'}`
                              : '—'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: '1rem' }}
              disabled={savingPersonal || informeBloqueado || !selectedObraId || !selectedJornadaId}
              onClick={savePersonal}
            >
              {savingPersonal ? 'Guardando...' : 'Guardar personal'}
            </button>
            </fieldset>
          </section>
        )}

        {activeSection === 'equipos' && (
          <section className="shell-card shell-card-wide">
            <h1 className="shell-title">Equipos y materiales</h1>
            <div className="users-tabs equipos-materiales-tabs" role="tablist" aria-label="Equipos y materiales">
              <button
                type="button"
                role="tab"
                aria-selected={equiposTab === 'maquinaria'}
                className={`users-tab ${equiposTab === 'maquinaria' ? 'users-tab-active' : ''}`}
                onClick={() => setEquiposTab('maquinaria')}
              >
                Maquinaria
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={equiposTab === 'ingreso'}
                className={`users-tab ${equiposTab === 'ingreso' ? 'users-tab-active' : ''}`}
                onClick={() => setEquiposTab('ingreso')}
              >
                Ingreso material
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={equiposTab === 'entregado'}
                className={`users-tab ${equiposTab === 'entregado' ? 'users-tab-active' : ''}`}
                onClick={() => setEquiposTab('entregado')}
              >
                Entregas
              </button>
            </div>

            {equiposTab === 'maquinaria' && (
              <fieldset disabled={informeBloqueado} style={informeFieldsetStyle}>
                {equiposMessage && <p className="feedback feedback-success">{equiposMessage}</p>}
                {equiposError && <p className="feedback feedback-error">{equiposError}</p>}

                {loadingEquipos ? (
                  <p className="shell-text-muted">Cargando equipos...</p>
                ) : (
                  <>
                    <div className="personal-form-panel auth-form">
                      <div className="section-divider">
                        <h2 className="section-title">
                          {equipoEditingIndex !== null ? 'Editar equipo' : 'Agregar equipo'}
                        </h2>
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="equipo-draft-desc">
                          Descripción *
                        </label>
                        <div className="informe-input-wrap">
                          <input
                            id="equipo-draft-desc"
                            className="personal-input personal-input-with-mic"
                            type="text"
                            placeholder="Equipo o descripción"
                            value={equipoDraft.descripcion}
                            onChange={(e) =>
                              setEquipoDraft((d) => ({ ...d, descripcion: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="informe-icon-button"
                            aria-label="Dictar descripción"
                            onClick={() => void startVoiceCapture('equipoDraftDescripcion')}
                          >
                            <IconMic />
                          </button>
                        </div>
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="equipo-draft-placa">
                          Placa / referencia
                        </label>
                        <div className="informe-input-wrap">
                          <input
                            id="equipo-draft-placa"
                            className="personal-input personal-input-with-mic"
                            type="text"
                            placeholder="Placa o ref."
                            value={equipoDraft.placaRef}
                            onChange={(e) =>
                              setEquipoDraft((d) => ({ ...d, placaRef: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="informe-icon-button"
                            aria-label="Dictar placa o referencia"
                            onClick={() => void startVoiceCapture('equipoDraftPlaca')}
                          >
                            <IconMic />
                          </button>
                        </div>
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="equipo-draft-propiedad">
                          Propio / alquilado
                        </label>
                        <select
                          id="equipo-draft-propiedad"
                          className="personal-input"
                          value={equipoDraft.propiedad}
                          onChange={(e) =>
                            setEquipoDraft((d) => ({ ...d, propiedad: e.target.value }))
                          }
                        >
                          <option value="">Seleccione...</option>
                          <option value="PROPIO">Propio</option>
                          <option value="ALQUILADO">Alquilado</option>
                        </select>
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="equipo-draft-estado">
                          Estado
                        </label>
                        <select
                          id="equipo-draft-estado"
                          className="personal-input"
                          value={equipoDraft.estado}
                          onChange={(e) => setEquipoDraft((d) => ({ ...d, estado: e.target.value }))}
                        >
                          <option value="">Seleccione...</option>
                          <option value="OPERATIVO">Operativo</option>
                          <option value="EN_MANTENIMIENTO">En mantenimiento</option>
                          <option value="FUERA_DE_SERVICIO">Fuera de servicio</option>
                        </select>
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="equipo-draft-observacion">
                          Observación
                        </label>
                        <div className="informe-input-wrap">
                          <textarea
                            id="equipo-draft-observacion"
                            className="personal-input personal-input-with-mic textarea-input equipo-observacion-textarea"
                            placeholder="Observación del equipo"
                            rows={3}
                            value={equipoDraft.observacion}
                            onChange={(e) =>
                              setEquipoDraft((d) => ({ ...d, observacion: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="informe-icon-button textarea-mic"
                            aria-label="Dictar observación"
                            onClick={() => void startVoiceCapture('equipoDraftObservacion')}
                          >
                            <IconMic />
                          </button>
                        </div>
                      </div>
                      <RegistroFotograficoInput
                        idBase="equipo-draft-imagen"
                        imageUrl={equipoDraft.imagenUrl}
                        disabled={informeBloqueado || !selectedObraId}
                        onFileSelected={async (file) => {
                          setEquiposError(null);
                          try {
                            return await uploadRegistroFotografico(file);
                          } catch (err) {
                            setEquiposError(err instanceof Error ? err.message : 'Error al subir imagen.');
                            return null;
                          }
                        }}
                        onUploaded={(foto) =>
                          setEquipoDraft((d) => ({ ...d, imagenUrl: foto.url, ...fotoGeoPayload(foto) }))
                        }
                        onClear={() => setEquipoDraft((d) => ({ ...d, imagenUrl: '', ...clearFotoGeoPayload() }))}
                        onPreview={setRegistroFotoPreviewUrl}
                      />
                      <div className="form-row-inline equipo-horarios-row">
                        <div className="informe-field equipo-horarios-field">
                          <label className="informe-label" htmlFor="equipo-draft-h-in">
                            Hora inicial
                          </label>
                          <div className="personal-time-wrap">
                            <input
                              id="equipo-draft-h-in"
                              className="personal-input"
                              type="time"
                              value={equipoDraft.horaIngreso}
                              onChange={(e) =>
                                setEquipoDraft((d) => ({ ...d, horaIngreso: e.target.value }))
                              }
                            />
                            <span className="personal-time-icon" aria-hidden>
                              <IconClock />
                            </span>
                          </div>
                        </div>
                        <div className="informe-field equipo-horarios-field">
                          <label className="informe-label" htmlFor="equipo-draft-h-out">
                            Hora final
                          </label>
                          <div className="personal-time-wrap">
                            <input
                              id="equipo-draft-h-out"
                              className="personal-input"
                              type="time"
                              value={equipoDraft.horaSalida}
                              onChange={(e) =>
                                setEquipoDraft((d) => ({ ...d, horaSalida: e.target.value }))
                              }
                            />
                            <span className="personal-time-icon" aria-hidden>
                              <IconClock />
                            </span>
                          </div>
                        </div>
                        <div className="informe-field equipo-horarios-field equipo-horarios-total-field">
                          <label className="informe-label" htmlFor="equipo-draft-horas">
                            Horas trabajadas
                          </label>
                          <input
                            id="equipo-draft-horas"
                            className="personal-input personal-input-readonly"
                            type="text"
                            readOnly
                            value={formatEquipoHoras(
                              computeEquipoHorasDecimal(equipoDraft.horaIngreso, equipoDraft.horaSalida),
                            )}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-primary equipo-horarios-add-btn"
                          onClick={addEquipoHorarioDraft}
                        >
                          Agregar horario
                        </button>
                      </div>
                      {equipoDraft.horarios.length > 0 ? (
                        <div className="users-table-wrap equipo-horarios-table-wrap">
                          <table className="users-table">
                            <thead>
                              <tr>
                                <th>Hora inicial</th>
                                <th>Hora final</th>
                                <th>Horas</th>
                                <th>Acciones</th>
                              </tr>
                            </thead>
                            <tbody>
                              {equipoDraft.horarios.map((h, idx) => (
                                <tr key={`${h.horaIngreso}-${h.horaSalida}-${idx}`}>
                                  <td>{h.horaIngreso}</td>
                                  <td>{h.horaSalida}</td>
                                  <td>{formatEquipoHoras(h.horasTrabajadas)}</td>
                                  <td className="users-table-actions equipo-horarios-actions">
                                    <button
                                      type="button"
                                      className="equipo-horarios-remove-btn"
                                      onClick={() => removeEquipoHorarioDraft(idx)}
                                    >
                                      <IconTrash /> Quitar
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                      <p className="shell-text-muted" style={{ margin: 0 }}>
                        Total horas trabajadas: {formatEquipoHoras(sumEquipoHorarios(equipoDraft.horarios))}
                      </p>
                      <div className="personal-form-actions">
                        <button type="button" className="btn-primary" onClick={commitEquipoDraft}>
                          {equipoEditingIndex !== null ? 'Guardar cambios' : 'Agregar a la lista'}
                        </button>
                        {equipoEditingIndex !== null && (
                          <button type="button" className="btn-secondary" onClick={cancelEquipoDraft}>
                            Cancelar edición
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="section-divider">
                      <h2 className="section-title">Equipos en lista ({equiposRows.length})</h2>
                    </div>
                    {equiposRows.length === 0 ? (
                      <p className="shell-text-muted">
                        No hay equipos. Complete el formulario y pulse «Agregar a la lista»; luego «Guardar equipos».
                      </p>
                    ) : (
                      <div className="personal-list">
                        {equiposRows.map((r, idx) => (
                          <div
                            key={r.id ?? `equipo-${idx}`}
                            className={`personal-list-card${
                              equipoEditingIndex === idx ? ' personal-list-card-editing' : ''
                            }`}
                          >
                            <div className="personal-list-card-head">
                              <div className="personal-list-card-name">
                                {r.descripcion.trim() || `Equipo ${idx + 1}`}
                              </div>
                              <div className="personal-list-card-actions">
                                <button
                                  type="button"
                                  className="suspensiones-icon-btn"
                                  title="Editar"
                                  aria-label="Editar"
                                  onClick={() => startEditEquipo(idx)}
                                >
                                  <IconEdit />
                                </button>
                                <button
                                  type="button"
                                  className="suspensiones-icon-btn suspensiones-icon-btn-danger"
                                  title="Quitar"
                                  aria-label="Quitar"
                                  onClick={() => removeEquipoRow(idx)}
                                >
                                  <IconTrash />
                                </button>
                              </div>
                            </div>
                            <div className="personal-list-card-meta">
                              <div>
                                <strong>Placa / ref.:</strong> {r.placaRef.trim() || '—'}
                              </div>
                              <div>
                                <strong>Propiedad:</strong> {equipoPropiedadLabel(r.propiedad)}
                              </div>
                              <div>
                                <strong>Estado:</strong> {equipoEstadoLabel(r.estado)}
                              </div>
                              <div>
                                <strong>Observación:</strong> {r.observacion.trim() || '—'}
                              </div>
                              <div>
                                <strong>Registro fotográfico:</strong>{' '}
                                {r.imagenUrl ? (
                                  <img
                                    src={r.imagenUrl}
                                    alt="Registro fotográfico del equipo"
                                    className="calidad-table-thumb"
                                  />
                                ) : (
                                  '—'
                                )}
                              </div>
                              <div>
                                <strong>Horarios:</strong>{' '}
                                {r.horarios.length > 0 ? `${r.horarios.length} registro(s)` : '—'}
                              </div>
                              <div>
                                <strong>Horas trabajadas:</strong>{' '}
                                {formatEquipoHoras(r.horasTrabajadas)}
                              </div>
                            </div>
                            {r.horarios.length > 0 ? (
                              <div className="users-table-wrap" style={{ marginTop: '0.75rem' }}>
                                <table className="users-table">
                                  <thead>
                                    <tr>
                                      <th>Hora inicial</th>
                                      <th>Hora final</th>
                                      <th>Horas</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.horarios.map((h, horarioIdx) => (
                                      <tr key={`${h.horaIngreso}-${h.horaSalida}-${horarioIdx}`}>
                                        <td>{h.horaIngreso}</td>
                                        <td>{h.horaSalida}</td>
                                        <td>{formatEquipoHoras(h.horasTrabajadas)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '1rem' }}
                  disabled={savingEquipos || informeBloqueado || !selectedObraId || !selectedJornadaId}
                  onClick={saveEquipos}
                >
                  {savingEquipos ? 'Guardando...' : 'Guardar equipos'}
                </button>
              </fieldset>
            )}

            {equiposTab === 'ingreso' && (
              <fieldset disabled={informeBloqueado} style={informeFieldsetStyle}>
                {ingresoMessage && <p className="feedback feedback-success">{ingresoMessage}</p>}
                {ingresoError && <p className="feedback feedback-error">{ingresoError}</p>}

                {loadingIngreso ? (
                  <p className="shell-text-muted">Cargando ingresos...</p>
                ) : (
                  <>
                    <div className="personal-form-panel auth-form">
                      <div className="section-divider">
                        <h2 className="section-title">
                          {ingresoEditingIndex !== null ? 'Editar ingreso' : 'Agregar ingreso'}
                        </h2>
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="ingreso-draft-prov">
                          Proveedor
                        </label>
                        <div className="informe-input-wrap">
                          <input
                            id="ingreso-draft-prov"
                            className="personal-input personal-input-with-mic"
                            type="text"
                            placeholder="Proveedor"
                            value={ingresoDraft.proveedor}
                            onChange={(e) =>
                              setIngresoDraft((d) => ({ ...d, proveedor: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="informe-icon-button"
                            aria-label="Dictar proveedor"
                            onClick={() => void startVoiceCapture('ingresoDraftProveedor')}
                          >
                            <IconMic />
                          </button>
                        </div>
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="ingreso-draft-mat">
                          Tipo de material
                        </label>
                        <div className="informe-input-wrap">
                          <input
                            id="ingreso-draft-mat"
                            className="personal-input personal-input-with-mic"
                            type="text"
                            placeholder="Material"
                            value={ingresoDraft.tipoMaterial}
                            onChange={(e) =>
                              setIngresoDraft((d) => ({ ...d, tipoMaterial: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="informe-icon-button"
                            aria-label="Dictar tipo de material"
                            onClick={() => void startVoiceCapture('ingresoDraftTipoMaterial')}
                          >
                            <IconMic />
                          </button>
                        </div>
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="ingreso-draft-rem">
                          N.º remisión
                        </label>
                        <div className="informe-input-wrap">
                          <input
                            id="ingreso-draft-rem"
                            className="personal-input personal-input-with-mic"
                            type="text"
                            placeholder="Remisión"
                            value={ingresoDraft.noRemision}
                            onChange={(e) =>
                              setIngresoDraft((d) => ({ ...d, noRemision: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="informe-icon-button"
                            aria-label="Dictar número de remisión"
                            onClick={() => void startVoiceCapture('ingresoDraftNoRemision')}
                          >
                            <IconMic />
                          </button>
                        </div>
                      </div>
                      <div className="personal-form-times">
                        <div className="informe-field">
                          <label className="informe-label" htmlFor="ingreso-draft-ud">
                            Unidad
                          </label>
                          <div className="informe-input-wrap">
                            <input
                              id="ingreso-draft-ud"
                              className="personal-input personal-input-with-mic"
                              type="text"
                              placeholder="m³, kg…"
                              value={ingresoDraft.unidad}
                              onChange={(e) =>
                                setIngresoDraft((d) => ({ ...d, unidad: e.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="informe-icon-button"
                              aria-label="Dictar unidad"
                              onClick={() => void startVoiceCapture('ingresoDraftUnidad')}
                            >
                              <IconMic />
                            </button>
                          </div>
                        </div>
                        <div className="informe-field">
                          <label className="informe-label" htmlFor="ingreso-draft-cant">
                            Cantidad
                          </label>
                          <input
                            id="ingreso-draft-cant"
                            className="personal-input"
                            type="number"
                            min={0}
                            step={0.5}
                            value={ingresoDraft.cantidad}
                            onChange={(e) =>
                              setIngresoDraft((d) => ({
                                ...d,
                                cantidad: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="ingreso-draft-observacion">
                          Observación
                        </label>
                        <div className="informe-input-wrap">
                          <textarea
                            id="ingreso-draft-observacion"
                            className="personal-input personal-input-with-mic textarea-input equipo-observacion-textarea"
                            placeholder="Observación del ingreso"
                            rows={3}
                            value={ingresoDraft.observacion}
                            onChange={(e) =>
                              setIngresoDraft((d) => ({ ...d, observacion: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="informe-icon-button textarea-mic"
                            aria-label="Dictar observación"
                            onClick={() => void startVoiceCapture('ingresoDraftObservacion')}
                          >
                            <IconMic />
                          </button>
                        </div>
                      </div>
                      <RegistroFotograficoInput
                        idBase="ingreso-draft-imagen"
                        imageUrl={ingresoDraft.imagenUrl}
                        disabled={informeBloqueado || !selectedObraId}
                        onFileSelected={async (file) => {
                          setIngresoError(null);
                          try {
                            return await uploadRegistroFotografico(file);
                          } catch (err) {
                            setIngresoError(err instanceof Error ? err.message : 'Error al subir imagen.');
                            return null;
                          }
                        }}
                        onUploaded={(foto) =>
                          setIngresoDraft((d) => ({ ...d, imagenUrl: foto.url, ...fotoGeoPayload(foto) }))
                        }
                        onClear={() => setIngresoDraft((d) => ({ ...d, imagenUrl: '', ...clearFotoGeoPayload() }))}
                        onPreview={setRegistroFotoPreviewUrl}
                      />
                      <div className="personal-form-actions">
                        <button type="button" className="btn-primary" onClick={commitIngresoDraft}>
                          {ingresoEditingIndex !== null ? 'Guardar cambios' : 'Agregar a la lista'}
                        </button>
                        {ingresoEditingIndex !== null && (
                          <button type="button" className="btn-secondary" onClick={cancelIngresoDraft}>
                            Cancelar edición
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="section-divider">
                      <h2 className="section-title">Ingresos en lista ({ingresoRows.length})</h2>
                    </div>
                    {ingresoRows.length === 0 ? (
                      <p className="shell-text-muted">
                        No hay ingresos. Use el formulario y «Agregar a la lista»; luego «Guardar ingreso».
                      </p>
                    ) : (
                      <div className="personal-list">
                        {ingresoRows.map((r, idx) => (
                          <div
                            key={r.id ?? `ingreso-${idx}`}
                            className={`personal-list-card${
                              ingresoEditingIndex === idx ? ' personal-list-card-editing' : ''
                            }`}
                          >
                            <div className="personal-list-card-head">
                              <div className="personal-list-card-name">
                                {r.tipoMaterial.trim() || r.proveedor.trim() || `Ingreso ${idx + 1}`}
                              </div>
                              <div className="personal-list-card-actions">
                                <button
                                  type="button"
                                  className="suspensiones-icon-btn"
                                  title="Editar"
                                  aria-label="Editar"
                                  onClick={() => startEditIngreso(idx)}
                                >
                                  <IconEdit />
                                </button>
                                <button
                                  type="button"
                                  className="suspensiones-icon-btn suspensiones-icon-btn-danger"
                                  title="Quitar"
                                  aria-label="Quitar"
                                  onClick={() => removeIngresoRow(idx)}
                                >
                                  <IconTrash />
                                </button>
                              </div>
                            </div>
                            <div className="personal-list-card-meta">
                              <div>
                                <strong>Proveedor:</strong> {r.proveedor.trim() || '—'}
                              </div>
                              <div>
                                <strong>Remisión:</strong> {r.noRemision.trim() || '—'}
                              </div>
                              <div>
                                <strong>Cantidad:</strong> {r.cantidad}{' '}
                                {r.unidad.trim() ? r.unidad.trim() : ''}
                              </div>
                              <div>
                                <strong>Observación:</strong> {r.observacion.trim() || '—'}
                              </div>
                              <div>
                                <strong>Registro fotográfico:</strong>{' '}
                                {r.imagenUrl ? (
                                  <img
                                    src={r.imagenUrl}
                                    alt="Registro fotográfico del ingreso"
                                    className="calidad-table-thumb"
                                  />
                                ) : (
                                  '—'
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '1rem' }}
                  disabled={savingIngreso || informeBloqueado || !selectedObraId || !selectedJornadaId}
                  onClick={saveIngresos}
                >
                  {savingIngreso ? 'Guardando...' : 'Guardar ingreso'}
                </button>
              </fieldset>
            )}

            {equiposTab === 'entregado' && (
              <fieldset disabled={informeBloqueado} style={informeFieldsetStyle}>
                {entregaMessage && <p className="feedback feedback-success">{entregaMessage}</p>}
                {entregaError && <p className="feedback feedback-error">{entregaError}</p>}

                {loadingEntrega ? (
                  <p className="shell-text-muted">Cargando entregas...</p>
                ) : (
                  <>
                    <div className="personal-form-panel auth-form">
                      <div className="section-divider">
                        <h2 className="section-title">
                          {entregaEditingIndex !== null ? 'Editar entrega' : 'Agregar entrega'}
                        </h2>
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="entrega-draft-mat">
                          Tipo de material *
                        </label>
                        <div className="informe-input-wrap">
                          <input
                            id="entrega-draft-mat"
                            className="personal-input personal-input-with-mic"
                            type="text"
                            placeholder="Material"
                            value={entregaDraft.tipoMaterial}
                            onChange={(e) =>
                              setEntregaDraft((d) => ({ ...d, tipoMaterial: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="informe-icon-button"
                            aria-label="Dictar tipo de material"
                            onClick={() => void startVoiceCapture('entregaDraftTipoMaterial')}
                          >
                            <IconMic />
                          </button>
                        </div>
                      </div>
                      <div className="personal-form-times">
                        <div className="informe-field">
                          <label className="informe-label" htmlFor="entrega-draft-ud">
                            Unidad
                          </label>
                          <div className="informe-input-wrap">
                            <input
                              id="entrega-draft-ud"
                              className="personal-input personal-input-with-mic"
                              type="text"
                              placeholder="Unidad"
                              value={entregaDraft.unidad}
                              onChange={(e) =>
                                setEntregaDraft((d) => ({ ...d, unidad: e.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="informe-icon-button"
                              aria-label="Dictar unidad"
                              onClick={() => void startVoiceCapture('entregaDraftUnidad')}
                            >
                              <IconMic />
                            </button>
                          </div>
                        </div>
                        <div className="informe-field">
                          <label className="informe-label" htmlFor="entrega-draft-cant">
                            Cantidad
                          </label>
                          <input
                            id="entrega-draft-cant"
                            className="personal-input"
                            type="number"
                            min={0}
                            step={0.5}
                            value={entregaDraft.cantidad}
                            onChange={(e) =>
                              setEntregaDraft((d) => ({
                                ...d,
                                cantidad: Number(e.target.value),
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="entrega-draft-ctr">
                          Contratista
                        </label>
                        <div className="informe-input-wrap">
                          <input
                            id="entrega-draft-ctr"
                            className="personal-input personal-input-with-mic"
                            type="text"
                            placeholder="Quién recibe"
                            value={entregaDraft.contratista}
                            onChange={(e) =>
                              setEntregaDraft((d) => ({ ...d, contratista: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="informe-icon-button"
                            aria-label="Dictar contratista"
                            onClick={() => void startVoiceCapture('entregaDraftContratista')}
                          >
                            <IconMic />
                          </button>
                        </div>
                      </div>
                      <div className="informe-field equipos-entrega-firma-row">
                        <label className="informe-label equipos-entrega-firma-label" htmlFor="entrega-draft-firma">
                          Firma recibido
                        </label>
                        <input
                          id="entrega-draft-firma"
                          type="checkbox"
                          className="equipos-entrega-checkbox"
                          checked={entregaDraft.firmaRecibido}
                          onChange={(e) =>
                            setEntregaDraft((d) => ({ ...d, firmaRecibido: e.target.checked }))
                          }
                        />
                      </div>
                      <div className="informe-field">
                        <label className="informe-label" htmlFor="entrega-draft-observacion">
                          Observación
                        </label>
                        <div className="informe-input-wrap">
                          <textarea
                            id="entrega-draft-observacion"
                            className="personal-input personal-input-with-mic textarea-input equipo-observacion-textarea"
                            placeholder="Observación de la entrega"
                            rows={3}
                            value={entregaDraft.observacion}
                            onChange={(e) =>
                              setEntregaDraft((d) => ({ ...d, observacion: e.target.value }))
                            }
                          />
                          <button
                            type="button"
                            className="informe-icon-button textarea-mic"
                            aria-label="Dictar observación"
                            onClick={() => void startVoiceCapture('entregaDraftObservacion')}
                          >
                            <IconMic />
                          </button>
                        </div>
                      </div>
                      <RegistroFotograficoInput
                        idBase="entrega-draft-imagen"
                        imageUrl={entregaDraft.imagenUrl}
                        disabled={informeBloqueado || !selectedObraId}
                        onFileSelected={async (file) => {
                          setEntregaError(null);
                          try {
                            return await uploadRegistroFotografico(file);
                          } catch (err) {
                            setEntregaError(err instanceof Error ? err.message : 'Error al subir imagen.');
                            return null;
                          }
                        }}
                        onUploaded={(foto) =>
                          setEntregaDraft((d) => ({ ...d, imagenUrl: foto.url, ...fotoGeoPayload(foto) }))
                        }
                        onClear={() => setEntregaDraft((d) => ({ ...d, imagenUrl: '', ...clearFotoGeoPayload() }))}
                        onPreview={setRegistroFotoPreviewUrl}
                      />
                      <div className="personal-form-actions">
                        <button type="button" className="btn-primary" onClick={commitEntregaDraft}>
                          {entregaEditingIndex !== null ? 'Guardar cambios' : 'Agregar a la lista'}
                        </button>
                        {entregaEditingIndex !== null && (
                          <button type="button" className="btn-secondary" onClick={cancelEntregaDraft}>
                            Cancelar edición
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="section-divider">
                      <h2 className="section-title">Entregas en lista ({entregaRows.length})</h2>
                    </div>
                    {entregaRows.length === 0 ? (
                      <p className="shell-text-muted">
                        No hay entregas. Use el formulario y «Agregar a la lista»; luego «Guardar entregas».
                      </p>
                    ) : (
                      <div className="personal-list">
                        {entregaRows.map((r, idx) => (
                          <div
                            key={r.id ?? `entrega-${idx}`}
                            className={`personal-list-card${
                              entregaEditingIndex === idx ? ' personal-list-card-editing' : ''
                            }`}
                          >
                            <div className="personal-list-card-head">
                              <div className="personal-list-card-name">
                                {r.tipoMaterial.trim() || `Entrega ${idx + 1}`}
                              </div>
                              <div className="personal-list-card-actions">
                                <button
                                  type="button"
                                  className="suspensiones-icon-btn"
                                  title="Editar"
                                  aria-label="Editar"
                                  onClick={() => startEditEntrega(idx)}
                                >
                                  <IconEdit />
                                </button>
                                <button
                                  type="button"
                                  className="suspensiones-icon-btn suspensiones-icon-btn-danger"
                                  title="Quitar"
                                  aria-label="Quitar"
                                  onClick={() => removeEntregaRow(idx)}
                                >
                                  <IconTrash />
                                </button>
                              </div>
                            </div>
                            <div className="personal-list-card-meta">
                              <div>
                                <strong>Cantidad:</strong> {r.cantidad}{' '}
                                {r.unidad.trim() ? r.unidad.trim() : ''}
                              </div>
                              <div>
                                <strong>Contratista:</strong> {r.contratista.trim() || '—'}
                              </div>
                              <div>
                                <strong>Firma recibido:</strong> {r.firmaRecibido ? 'Sí' : 'No'}
                              </div>
                              <div>
                                <strong>Observación:</strong> {r.observacion.trim() || '—'}
                              </div>
                              <div>
                                <strong>Registro fotográfico:</strong>{' '}
                                {r.imagenUrl ? (
                                  <img
                                    src={r.imagenUrl}
                                    alt="Registro fotográfico de la entrega"
                                    className="calidad-table-thumb"
                                  />
                                ) : (
                                  '—'
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '1rem' }}
                  disabled={savingEntrega || informeBloqueado || !selectedObraId || !selectedJornadaId}
                  onClick={saveEntregas}
                >
                  {savingEntrega ? 'Guardando...' : 'Guardar entregas'}
                </button>
              </fieldset>
            )}
          </section>
        )}

        {activeSection === 'actividades' && (
          <section className="shell-card shell-card-wide">
            <fieldset disabled={informeBloqueado} style={informeFieldsetStyle}>
            <div className="personal-header">
              <div>
                <h1 className="shell-title">Actividades desarrolladas</h1>
              </div>
            </div>

            {actividadMessage && <p className="feedback feedback-success">{actividadMessage}</p>}
            {actividadError && <p className="feedback feedback-error">{actividadError}</p>}

            {loadingActividad ? (
              <p className="shell-text-muted">Cargando actividades...</p>
            ) : (
              <>
                <div className="personal-form-panel">
                  <div className="calidad-mobile-grid" style={{ marginBottom: 0 }}>
                    <div className="informe-field">
                      <label className="informe-label" htmlFor="actividad-draft-pk">
                        PK *
                      </label>
                      <input
                        id="actividad-draft-pk"
                        className="personal-input"
                        type="text"
                        placeholder="Ej. K0"
                        value={actividadDraft.pk}
                        onChange={(e) => updateActividadDraft({ pk: e.target.value })}
                      />
                    </div>
                    <div className="informe-field">
                      <label className="informe-label" htmlFor="actividad-draft-abscisado">
                        Abscisado *
                      </label>
                      <input
                        id="actividad-draft-abscisado"
                        className="personal-input"
                        type="text"
                        placeholder="Ej. +000"
                        value={actividadDraft.abscisado}
                        onChange={(e) => updateActividadDraft({ abscisado: e.target.value })}
                      />
                    </div>
                    <div className="informe-field">
                      <label className="informe-label" htmlFor="actividad-draft-item">
                        Ítem contractual *
                      </label>
                      <InformeSearchableSelect
                        id="actividad-draft-item"
                        value={actividadDraft.itemContractual}
                        options={itemsCatalogOptions.map((it) => ({
                          value: it.codigo,
                          label: `${it.codigo} - ${it.descripcion}${it.unidad ? ` (${it.unidad})` : ''}${it.rubro ? ` — ${it.rubro}` : ''}`,
                        }))}
                        onChange={(codigo) => {
                          if (!codigo) {
                            updateActividadDraft({
                              itemContractual: '',
                              descripcion: '',
                              unidadMedida: '',
                              largo: 0,
                              ancho: 0,
                              altura: 0,
                            });
                            return;
                          }
                          const selected = itemsCatalogOptions.find((it) => it.codigo === codigo);
                          updateActividadDraft({
                            itemContractual: codigo,
                            descripcion: selected?.descripcion ?? actividadDraft.descripcion,
                            unidadMedida: selected?.unidad ?? actividadDraft.unidadMedida,
                            largo: selected?.largo != null ? Number(selected.largo) : 0,
                            ancho: selected?.ancho != null ? Number(selected.ancho) : 0,
                            altura: selected?.altura != null ? Number(selected.altura) : 0,
                            cantidadTotal:
                              selected?.cantidad != null && Number.isFinite(Number(selected.cantidad))
                                ? Number(selected.cantidad)
                                : Number(actividadDraft.cantidadTotal ?? 0),
                          });
                        }}
                        disabled={!selectedObraId}
                        emptyOptionLabel={selectedObraId ? 'Seleccione ítem...' : 'Seleccione una obra arriba'}
                        searchPlaceholder="Buscar ítem por código o descripción…"
                        className="actividad-item-select"
                      />
                    </div>
                    <div className="informe-field">
                      <label className="informe-label" htmlFor="actividad-draft-descripcion">
                        Descripción
                      </label>
                      <input
                        id="actividad-draft-descripcion"
                        className="personal-input personal-input-readonly"
                        type="text"
                        placeholder="Descripción heredada del ítem"
                        value={actividadDraft.descripcion}
                        readOnly
                      />
                    </div>
                    <div className="informe-field">
                      <label className="informe-label" htmlFor="actividad-draft-cantidad">
                        Cantidad *
                      </label>
                      <input
                        id="actividad-draft-cantidad"
                        className="personal-input"
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="Cantidad"
                        value={Number.isFinite(Number(actividadDraft.cantidadTotal)) ? String(actividadDraft.cantidadTotal) : ''}
                        onChange={(e) => updateActividadDraft({ cantidadTotal: Number(e.target.value || 0) })}
                      />
                    </div>
                    <div className="informe-field">
                      <label className="informe-label" htmlFor="actividad-draft-observacion">
                        Observación
                      </label>
                      <div className="actividad-observacion-wrap">
                        <textarea
                          id="actividad-draft-observacion"
                          className="personal-input actividad-observacion-textarea"
                          placeholder="Observación de la actividad"
                          value={actividadDraft.observacion}
                          onChange={(e) => updateActividadDraft({ observacion: e.target.value })}
                          rows={3}
                        />
                        <button
                          type="button"
                          className="btn-voice-inline"
                          onClick={() => startVoiceCapture('actividadDraftObservacion')}
                          title="Dictar observación"
                          aria-label="Dictar observación"
                        >
                          <IconMic />
                        </button>
                      </div>
                    </div>
                    <RegistroFotograficoInput
                      idBase="actividad-draft-imagen"
                      imageUrl={actividadDraft.imagenUrl}
                      disabled={informeBloqueado || !selectedObraId}
                      onFileSelected={async (file) => {
                        setActividadError(null);
                        try {
                          return await uploadRegistroFotografico(file);
                        } catch (err) {
                          setActividadError(err instanceof Error ? err.message : 'Error al subir imagen.');
                          return null;
                        }
                      }}
                      onUploaded={(foto) =>
                        updateActividadDraft({ imagenUrl: foto.url, ...fotoGeoPayload(foto) })
                      }
                      onClear={() => updateActividadDraft({ imagenUrl: null, ...clearFotoGeoPayload() })}
                      onPreview={setRegistroFotoPreviewUrl}
                    />
                  </div>
                  <div className="personal-form-actions">
                    <button type="button" className="btn-add-personal" onClick={commitActividadDraft}>
                      {actividadEditingIndex !== null ? 'Actualizar actividad' : '+ Agregar actividad'}
                    </button>
                    {actividadEditingIndex !== null ? (
                      <button type="button" className="btn-secondary" onClick={cancelActividadDraft}>
                        Cancelar edición
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="personal-list">
                  {actividadRows.map((r, idx) => (
                    <article
                      key={r.id ?? idx}
                      className={`personal-list-card ${actividadEditingIndex === idx ? 'personal-list-card-editing' : ''}`}
                    >
                      <div className="personal-list-card-head">
                        <div className="personal-list-card-name">
                          {r.pk.trim() || '—'} · {r.abscisado.trim() || '—'}
                        </div>
                        <div className="personal-list-card-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ width: 'auto' }}
                            onClick={() => startEditActividad(idx)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn-secondary btn-actividad-detalle"
                            style={{ width: 'auto' }}
                            onClick={() => setActividadDetalleModalIndex(idx)}
                          >
                            Ver detalle
                          </button>
                          <button
                            type="button"
                            className="btn-delete-personal"
                            aria-label="Eliminar fila"
                            onClick={() => removeActividadRow(idx)}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </div>
                      <div className="personal-list-card-meta">
                        <div><strong>Ítem:</strong> {r.itemContractual || '—'}</div>
                        <div><strong>Descripción:</strong> {r.descripcion || '—'}</div>
                        <div><strong>Cantidad:</strong> {Number(r.cantidadTotal ?? 0).toLocaleString('es-CO')}</div>
                        <div><strong>Observación:</strong> {r.observacion || '—'}</div>
                      </div>
                    </article>
                  ))}
                </div>
                {actividadRows.length === 0 && (
                  <p className="shell-text-muted" style={{ padding: '0.35rem 0.2rem' }}>
                    No hay actividades registradas.
                  </p>
                )}
              </>
            )}

            <button
              type="button"
              className="btn-primary"
              disabled={savingActividad || informeBloqueado || !selectedObraId || !selectedJornadaId}
              onClick={saveActividades}
            >
              {savingActividad ? 'Guardando...' : 'Guardar actividades'}
            </button>
            {actividadDetalleModalIndex !== null && actividadRows[actividadDetalleModalIndex] ? (
              <div
                className="sigocc-alert-modal-backdrop"
                role="dialog"
                aria-modal="true"
                aria-label="Detalle de actividad"
                onClick={() => setActividadDetalleModalIndex(null)}
              >
                <div className="sigocc-alert-modal actividad-detalle-modal" onClick={(e) => e.stopPropagation()}>
                  <h3 className="sigocc-alert-modal-title">Detalle de actividad</h3>
                  {(() => {
                    const row = actividadRows[actividadDetalleModalIndex];
                    const item = itemsCatalogOptions.find((it) => it.codigo === row.itemContractual);
                    const unidad = String(item?.unidad ?? row.unidadMedida ?? '').trim();
                    const largo = item?.largo != null ? Number(item.largo) : row.largo;
                    const ancho = item?.ancho != null ? Number(item.ancho) : row.ancho;
                    const altura = item?.altura != null ? Number(item.altura) : row.altura;
                    const imagenUrl = String(item?.imagenUrl ?? row.imagenUrl ?? '').trim();
                    const precioCat = item?.precioUnitario != null ? Number(item.precioUnitario) : NaN;
                    const cantidadCat = item?.cantidad != null ? Number(item.cantidad) : NaN;
                    const subtotalCat = formatItemCatalogSubtotal(precioCat, cantidadCat);
                    const cantidadTotal =
                      Number.isFinite(largo * ancho * altura) && largo > 0 && ancho > 0 && altura > 0
                        ? largo * ancho * altura
                        : 0;
                    return (
                      <div className="actividad-detalle-grid">
                        {unidad ? (
                          <label className="actividad-detalle-field">
                            <span>Unidad de medida</span>
                            <input className="personal-input personal-input-readonly" type="text" value={unidad} readOnly />
                          </label>
                        ) : null}
                        {largo > 0 ? (
                          <label className="actividad-detalle-field">
                            <span>Largo (m)</span>
                            <input className="personal-input personal-input-readonly" type="text" value={String(largo)} readOnly />
                          </label>
                        ) : null}
                        {ancho > 0 ? (
                          <label className="actividad-detalle-field">
                            <span>Ancho (m)</span>
                            <input className="personal-input personal-input-readonly" type="text" value={String(ancho)} readOnly />
                          </label>
                        ) : null}
                        {altura > 0 ? (
                          <label className="actividad-detalle-field">
                            <span>Altura (m)</span>
                            <input className="personal-input personal-input-readonly" type="text" value={String(altura)} readOnly />
                          </label>
                        ) : null}
                        {cantidadTotal > 0 ? (
                          <label className="actividad-detalle-field">
                            <span>Cantidad total</span>
                            <input
                              className="personal-input personal-input-readonly"
                              type="text"
                              readOnly
                              value={`${cantidadTotal.toFixed(2)} ${unidad || 'm3'}`}
                            />
                          </label>
                        ) : null}
                        {Number.isFinite(precioCat) && precioCat > 0 ? (
                          <label className="actividad-detalle-field">
                            <span>Precio unitario</span>
                            <input
                              className="personal-input personal-input-readonly"
                              type="text"
                              readOnly
                              value={precioCat.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            />
                          </label>
                        ) : null}
                        {Number.isFinite(cantidadCat) && cantidadCat > 0 ? (
                          <label className="actividad-detalle-field">
                            <span>Cantidad (catálogo)</span>
                            <input
                              className="personal-input personal-input-readonly"
                              type="text"
                              readOnly
                              value={cantidadCat.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            />
                          </label>
                        ) : null}
                        {subtotalCat ? (
                          <label className="actividad-detalle-field">
                            <span>Subtotal (cantidad × precio)</span>
                            <input className="personal-input personal-input-readonly" type="text" readOnly value={subtotalCat} />
                          </label>
                        ) : null}
                        {imagenUrl ? <img src={imagenUrl} alt="Imagen de ítem contractual" className="calidad-mobile-thumb" /> : null}
                        {!unidad &&
                        largo <= 0 &&
                        ancho <= 0 &&
                        altura <= 0 &&
                        !imagenUrl &&
                        !(Number.isFinite(precioCat) && precioCat > 0) &&
                        !(Number.isFinite(cantidadCat) && cantidadCat > 0) ? (
                          <p className="shell-text-muted">Este ítem no tiene detalles configurados.</p>
                        ) : null}
                      </div>
                    );
                  })()}
                  <button
                    type="button"
                    className="btn-primary sigocc-alert-modal-btn"
                    onClick={() => setActividadDetalleModalIndex(null)}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : null}
            </fieldset>
          </section>
        )}

        {activeSection === 'calidad' && (
          <section className="shell-card shell-card-wide">
            <h1 className="shell-title">Informe diario - Calidad e incidentes</h1>

            <div className="users-tabs">
              <button
                type="button"
                className={`users-tab ${calidadTab === 'ensayos' ? 'users-tab-active' : ''}`}
                onClick={() => setCalidadTab('ensayos')}
              >
                Ensayos realizados
              </button>
              <button
                type="button"
                className={`users-tab ${calidadTab === 'danos' ? 'users-tab-active' : ''}`}
                onClick={() => setCalidadTab('danos')}
              >
                Daños a redes de servicios públicos
              </button>
              <button
                type="button"
                className={`users-tab ${calidadTab === 'noConformidades' ? 'users-tab-active' : ''}`}
                onClick={() => setCalidadTab('noConformidades')}
              >
                No conformidades / reprocesos
              </button>
            </div>

            {calidadTab === 'ensayos' && (
              <fieldset disabled={informeBloqueado} style={informeFieldsetStyle}>
                {ensayosMessage && <p className="feedback feedback-success">{ensayosMessage}</p>}
                {ensayosError && <p className="feedback feedback-error">{ensayosError}</p>}

                <div className="personal-header" style={{ marginBottom: '0.75rem' }}>
                  <button type="button" className="btn-add-personal calidad-desktop-only" onClick={addEnsayoRow}>
                    + AGREGAR ENSAYO
                  </button>
                </div>

                {loadingEnsayos ? (
                  <p className="shell-text-muted">Cargando ensayos...</p>
                ) : (
                  <>
                    <div className="calidad-mobile-only">
                      <div className="calidad-mobile-form">
                        <div className="calidad-mobile-grid">
                          <input className="personal-input" type="text" placeholder="Material / actividad" value={ensayoDraft.materialActividad} onChange={(e) => setEnsayoDraft((prev) => ({ ...prev, materialActividad: e.target.value }))} />
                          <input className="personal-input" type="text" placeholder="Tipo de ensayo" value={ensayoDraft.tipoEnsayo} onChange={(e) => setEnsayoDraft((prev) => ({ ...prev, tipoEnsayo: e.target.value }))} />
                          <input className="personal-input" type="text" placeholder="ID muestra" value={ensayoDraft.idMuestra} onChange={(e) => setEnsayoDraft((prev) => ({ ...prev, idMuestra: e.target.value }))} />
                          <input className="personal-input" type="text" placeholder="Laboratorio" value={ensayoDraft.laboratorio} onChange={(e) => setEnsayoDraft((prev) => ({ ...prev, laboratorio: e.target.value }))} />
                          <input className="personal-input" type="text" placeholder="Localización" value={ensayoDraft.localizacion} onChange={(e) => setEnsayoDraft((prev) => ({ ...prev, localizacion: e.target.value }))} />
                          <input className="personal-input" type="text" placeholder="Resultado" value={ensayoDraft.resultado} onChange={(e) => setEnsayoDraft((prev) => ({ ...prev, resultado: e.target.value }))} />
                          <input className="personal-input" type="text" placeholder="Observación (opcional)" value={ensayoDraft.observacion} onChange={(e) => setEnsayoDraft((prev) => ({ ...prev, observacion: e.target.value }))} />
                          <div>
                            <input
                              className="personal-input calidad-file-input"
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={async (e) => {
                                const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                                try {
                                  setEnsayosError(null);
                                  const foto = await uploadRegistroFotografico(file);
                                  if (foto) setEnsayoDraft((prev) => ({ ...prev, imagenUrl: foto.url, ...fotoGeoPayload(foto) }));
                                } catch (err) {
                                  setEnsayosError(err instanceof Error ? err.message : 'Error al subir imagen.');
                                } finally {
                                  e.target.value = '';
                                }
                              }}
                            />
                            {ensayoDraft.imagenUrl ? (
                              <img src={ensayoDraft.imagenUrl} alt="Registro fotográfico ensayo" className="calidad-mobile-thumb" />
                            ) : null}
                          </div>
                        </div>
                        <button type="button" className="btn-add-personal" onClick={addEnsayoFromDraft}>
                          + AGREGAR ENSAYO
                        </button>
                      </div>
                      <div className="calidad-mobile-list">
                        {ensayosRows.map((r, idx) => (
                          <div key={r.id ?? idx} className="calidad-mobile-card">
                            <div className="calidad-mobile-card-head">
                              <strong>{r.materialActividad || 'Sin material'}</strong>
                              <button type="button" className="btn-delete-personal" aria-label="Eliminar fila" onClick={() => removeEnsayoRow(idx)}>
                                <IconTrash />
                              </button>
                            </div>
                            <p><strong>Tipo:</strong> {r.tipoEnsayo}</p>
                            <p><strong>ID:</strong> {r.idMuestra}</p>
                            <p><strong>Laboratorio:</strong> {r.laboratorio}</p>
                            <p><strong>Localización:</strong> {r.localizacion}</p>
                            <p><strong>Resultado:</strong> {r.resultado}</p>
                            {r.observacion && <p><strong>Observación:</strong> {r.observacion}</p>}
                            {r.imagenUrl ? (
                              <p>
                                <img src={r.imagenUrl} alt="Registro fotográfico ensayo" className="calidad-mobile-thumb" />
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="users-table-wrap calidad-desktop-only">
                      <table className="users-table">
                        <thead>
                          <tr>
                            <th>MATERIAL / ACTIVIDAD</th>
                            <th>TIPO DE ENSAYO</th>
                            <th>ID MUESTRA</th>
                            <th>LABORATORIO</th>
                            <th>LOCALIZACIÓN</th>
                            <th>RESULTADO</th>
                            <th>OBSERVACIÓN</th>
                            <th>REGISTRO FOTOGRÁFICO</th>
                            <th>ACCIÓN</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ensayosRows.map((r, idx) => (
                            <tr key={r.id ?? idx}>
                              <td><input className="personal-input" type="text" placeholder="Material" value={r.materialActividad} onChange={(e) => updateEnsayoRow(idx, { materialActividad: e.target.value })} /></td>
                              <td><input className="personal-input" type="text" placeholder="Ensayo" value={r.tipoEnsayo} onChange={(e) => updateEnsayoRow(idx, { tipoEnsayo: e.target.value })} /></td>
                              <td><input className="personal-input" type="text" placeholder="ID" value={r.idMuestra} onChange={(e) => updateEnsayoRow(idx, { idMuestra: e.target.value })} /></td>
                              <td><input className="personal-input" type="text" placeholder="Laboratorio" value={r.laboratorio} onChange={(e) => updateEnsayoRow(idx, { laboratorio: e.target.value })} /></td>
                              <td><input className="personal-input" type="text" placeholder="Localización" value={r.localizacion} onChange={(e) => updateEnsayoRow(idx, { localizacion: e.target.value })} /></td>
                              <td><input className="personal-input" type="text" placeholder="Resultado" value={r.resultado} onChange={(e) => updateEnsayoRow(idx, { resultado: e.target.value })} /></td>
                              <td><input className="personal-input" type="text" placeholder="Observación" value={r.observacion} onChange={(e) => updateEnsayoRow(idx, { observacion: e.target.value })} /></td>
                              <td>
                                <input
                                  className="personal-input calidad-file-input"
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={async (e) => {
                                    const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                                    try {
                                      setEnsayosError(null);
                                      const foto = await uploadRegistroFotografico(file);
                                      if (foto) updateEnsayoRow(idx, { imagenUrl: foto.url, ...fotoGeoPayload(foto) });
                                    } catch (err) {
                                      setEnsayosError(err instanceof Error ? err.message : 'Error al subir imagen.');
                                    } finally {
                                      e.target.value = '';
                                    }
                                  }}
                                />
                                {r.imagenUrl ? (
                                  <img src={r.imagenUrl} alt="Registro fotográfico ensayo" className="calidad-table-thumb" />
                                ) : null}
                              </td>
                              <td>
                                <button type="button" className="btn-delete-personal" aria-label="Eliminar fila" onClick={() => removeEnsayoRow(idx)}>
                                  <IconTrash />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {ensayosRows.length === 0 && (
                      <p className="shell-text-muted" style={{ padding: '1rem' }}>
                        No hay ensayos registrados. Usa “Agregar ensayo”.
                      </p>
                    )}
                  </>
                )}

                <button
                  type="button"
                  className="btn-primary"
                  disabled={savingEnsayos || informeBloqueado || !selectedObraId || !selectedJornadaId}
                  onClick={saveEnsayos}
                  style={{ marginTop: '0.9rem' }}
                >
                  {savingEnsayos ? 'Guardando...' : 'Guardar ensayos'}
                </button>
              </fieldset>
            )}

            {calidadTab === 'danos' && (
              <fieldset disabled={informeBloqueado} style={informeFieldsetStyle}>
                {danosMessage && <p className="feedback feedback-success">{danosMessage}</p>}
                {danosError && <p className="feedback feedback-error">{danosError}</p>}

                <div className="personal-header" style={{ marginBottom: '0.75rem' }}>
                  <button type="button" className="btn-add-personal calidad-desktop-only" onClick={addDanoRow}>
                    + REGISTRAR DAÑO
                  </button>
                </div>

                {loadingDanos ? (
                  <p className="shell-text-muted">Cargando daños...</p>
                ) : (
                  <>
                  <div className="calidad-mobile-only">
                    <div className="calidad-mobile-form">
                      <div className="calidad-mobile-grid">
                        <input className="personal-input" type="time" value={danoDraft.horaReporte} onChange={(e) => setDanoDraft((prev) => ({ ...prev, horaReporte: e.target.value }))} />
                        <input className="personal-input" type="text" placeholder="Dirección" value={danoDraft.direccion} onChange={(e) => setDanoDraft((prev) => ({ ...prev, direccion: e.target.value }))} />
                        <input className="personal-input" type="text" placeholder="Tipo daño" value={danoDraft.tipoDano} onChange={(e) => setDanoDraft((prev) => ({ ...prev, tipoDano: e.target.value }))} />
                        <input className="personal-input" type="text" placeholder="Entidad" value={danoDraft.entidad} onChange={(e) => setDanoDraft((prev) => ({ ...prev, entidad: e.target.value }))} />
                        <input className="personal-input" type="text" placeholder="No. reporte" value={danoDraft.noReporte} onChange={(e) => setDanoDraft((prev) => ({ ...prev, noReporte: e.target.value }))} />
                        <input className="personal-input" type="text" placeholder="Observación (opcional)" value={danoDraft.observacion} onChange={(e) => setDanoDraft((prev) => ({ ...prev, observacion: e.target.value }))} />
                        <div>
                          <input
                            className="personal-input calidad-file-input"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={async (e) => {
                              const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                              try {
                                setDanosError(null);
                                const foto = await uploadRegistroFotografico(file);
                                if (foto) setDanoDraft((prev) => ({ ...prev, imagenUrl: foto.url, ...fotoGeoPayload(foto) }));
                              } catch (err) {
                                setDanosError(err instanceof Error ? err.message : 'Error al subir imagen.');
                              } finally {
                                e.target.value = '';
                              }
                            }}
                          />
                          {danoDraft.imagenUrl ? (
                            <img src={danoDraft.imagenUrl} alt="Registro fotográfico daño" className="calidad-mobile-thumb" />
                          ) : null}
                        </div>
                      </div>
                      <button type="button" className="btn-add-personal" onClick={addDanoFromDraft}>
                        + REGISTRAR DAÑO
                      </button>
                    </div>
                    <div className="calidad-mobile-list">
                      {danosRows.map((r, idx) => (
                        <div key={r.id ?? idx} className="calidad-mobile-card">
                          <div className="calidad-mobile-card-head">
                            <strong>{r.tipoDano || 'Sin tipo de daño'}</strong>
                            <button type="button" className="btn-delete-personal" aria-label="Eliminar fila" onClick={() => removeDanoRow(idx)}>
                              <IconTrash />
                            </button>
                          </div>
                          {r.horaReporte && <p><strong>Hora:</strong> {r.horaReporte}</p>}
                          <p><strong>Dirección:</strong> {r.direccion}</p>
                          <p><strong>Entidad:</strong> {r.entidad}</p>
                          <p><strong>No. reporte:</strong> {r.noReporte}</p>
                          {r.observacion && <p><strong>Observación:</strong> {r.observacion}</p>}
                          {r.imagenUrl ? (
                            <p>
                              <img src={r.imagenUrl} alt="Registro fotográfico daño" className="calidad-mobile-thumb" />
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="users-table-wrap calidad-desktop-only">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>HORA REPORTE</th>
                          <th>DIRECCIÓN</th>
                          <th>TIPO DAÑO</th>
                          <th>ENTIDAD</th>
                          <th>NO. REPORTE</th>
                          <th>OBSERVACIÓN</th>
                          <th>REGISTRO FOTOGRÁFICO</th>
                          <th>ACCIÓN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {danosRows.map((r, idx) => (
                          <tr key={r.id ?? idx}>
                            <td>
                              <input
                                className="personal-input"
                                type="time"
                                value={r.horaReporte}
                                onChange={(e) => updateDanoRow(idx, { horaReporte: e.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                className="personal-input"
                                type="text"
                                placeholder="Dirección"
                                value={r.direccion}
                                onChange={(e) => updateDanoRow(idx, { direccion: e.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                className="personal-input"
                                type="text"
                                placeholder="Tipo"
                                value={r.tipoDano}
                                onChange={(e) => updateDanoRow(idx, { tipoDano: e.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                className="personal-input"
                                type="text"
                                placeholder="Entidad"
                                value={r.entidad}
                                onChange={(e) => updateDanoRow(idx, { entidad: e.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                className="personal-input"
                                type="text"
                                placeholder="No. reporte"
                                value={r.noReporte}
                                onChange={(e) => updateDanoRow(idx, { noReporte: e.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                className="personal-input"
                                type="text"
                                placeholder="Observación"
                                value={r.observacion}
                                onChange={(e) => updateDanoRow(idx, { observacion: e.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                className="personal-input calidad-file-input"
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={async (e) => {
                                  const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                                  try {
                                    setDanosError(null);
                                    const foto = await uploadRegistroFotografico(file);
                                    if (foto) updateDanoRow(idx, { imagenUrl: foto.url, ...fotoGeoPayload(foto) });
                                  } catch (err) {
                                    setDanosError(err instanceof Error ? err.message : 'Error al subir imagen.');
                                  } finally {
                                    e.target.value = '';
                                  }
                                }}
                              />
                              {r.imagenUrl ? (
                                <img src={r.imagenUrl} alt="Registro fotográfico daño" className="calidad-table-thumb" />
                              ) : null}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn-delete-personal"
                                aria-label="Eliminar fila"
                                onClick={() => removeDanoRow(idx)}
                              >
                                <IconTrash />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {danosRows.length === 0 && (
                      <p className="shell-text-muted" style={{ padding: '1rem' }}>
                        No hay daños registrados. Usa “Registrar daño”.
                      </p>
                    )}
                  </div>
                  </>
                )}

                <button
                  type="button"
                  className="btn-primary"
                  disabled={savingDanos || informeBloqueado || !selectedObraId || !selectedJornadaId}
                  onClick={saveDanos}
                  style={{ marginTop: '0.9rem' }}
                >
                  {savingDanos ? 'Guardando...' : 'Guardar daños'}
                </button>
              </fieldset>
            )}

            {calidadTab === 'noConformidades' && (
              <fieldset disabled={informeBloqueado} style={informeFieldsetStyle}>
                {noConformidadesMessage && (
                  <p className="feedback feedback-success">{noConformidadesMessage}</p>
                )}
                {noConformidadesError && (
                  <p className="feedback feedback-error">{noConformidadesError}</p>
                )}

                <div className="personal-header" style={{ marginBottom: '0.75rem' }}>
                  <button type="button" className="btn-add-personal calidad-desktop-only" onClick={addNoConformidadRow}>
                    + AGREGAR NO CONFORMIDAD
                  </button>
                </div>

                {loadingNoConformidades ? (
                  <p className="shell-text-muted">Cargando no conformidades...</p>
                ) : (
                  <>
                  <div className="calidad-mobile-only">
                    <div className="calidad-mobile-form">
                      <div className="calidad-mobile-grid">
                        <input className="personal-input" type="text" placeholder="No. no conformidad" value={noConformidadDraft.noConformidad} onChange={(e) => setNoConformidadDraft((prev) => ({ ...prev, noConformidad: e.target.value }))} />
                        <input className="personal-input" type="text" placeholder="Detalle" value={noConformidadDraft.detalle} onChange={(e) => setNoConformidadDraft((prev) => ({ ...prev, detalle: e.target.value }))} />
                        <select className="personal-input" value={noConformidadDraft.estado} onChange={(e) => setNoConformidadDraft((prev) => ({ ...prev, estado: e.target.value }))}>
                          <option value="">Seleccione estado...</option>
                          <option value="PENDIENTE">Pendiente</option>
                          <option value="EN_PROCESO">En proceso</option>
                          <option value="CERRADA">Cerrada</option>
                        </select>
                        <div>
                          <input
                            className="personal-input calidad-file-input"
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={async (e) => {
                              const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                              try {
                                setNoConformidadesError(null);
                                const foto = await uploadRegistroFotografico(file);
                                if (foto) setNoConformidadDraft((prev) => ({ ...prev, imagenUrl: foto.url, ...fotoGeoPayload(foto) }));
                              } catch (err) {
                                setNoConformidadesError(err instanceof Error ? err.message : 'Error al subir imagen.');
                              } finally {
                                e.target.value = '';
                              }
                            }}
                          />
                          {noConformidadDraft.imagenUrl ? (
                            <img src={noConformidadDraft.imagenUrl} alt="Registro fotográfico no conformidad" className="calidad-mobile-thumb" />
                          ) : null}
                        </div>
                      </div>
                      <button type="button" className="btn-add-personal" onClick={addNoConformidadFromDraft}>
                        + AGREGAR NO CONFORMIDAD
                      </button>
                    </div>
                    <div className="calidad-mobile-list">
                      {noConformidadesRows.map((r, idx) => (
                        <div key={r.id ?? idx} className="calidad-mobile-card">
                          <div className="calidad-mobile-card-head">
                            <strong>{r.noConformidad || 'Sin consecutivo'}</strong>
                            <button type="button" className="btn-delete-personal" aria-label="Eliminar fila" onClick={() => removeNoConformidadRow(idx)}>
                              <IconTrash />
                            </button>
                          </div>
                          <p><strong>Detalle:</strong> {r.detalle}</p>
                          <p><strong>Estado:</strong> {r.estado}</p>
                          {r.imagenUrl ? (
                            <p>
                              <img src={r.imagenUrl} alt="Registro fotográfico no conformidad" className="calidad-mobile-thumb" />
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="users-table-wrap calidad-desktop-only">
                    <table className="users-table">
                      <thead>
                        <tr>
                          <th>NO. DE NO CONFORMIDAD</th>
                          <th>DETALLE</th>
                          <th>ESTADO</th>
                          <th>REGISTRO FOTOGRÁFICO</th>
                          <th>ACCIÓN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {noConformidadesRows.map((r, idx) => (
                          <tr key={r.id ?? idx}>
                            <td>
                              <input
                                className="personal-input"
                                type="text"
                                placeholder="NC-001"
                                value={r.noConformidad}
                                onChange={(e) => updateNoConformidadRow(idx, { noConformidad: e.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                className="personal-input"
                                type="text"
                                placeholder="Detalle"
                                value={r.detalle}
                                onChange={(e) => updateNoConformidadRow(idx, { detalle: e.target.value })}
                              />
                            </td>
                            <td>
                              <select
                                className="personal-input"
                                value={r.estado}
                                onChange={(e) => updateNoConformidadRow(idx, { estado: e.target.value })}
                              >
                                <option value="">Seleccione...</option>
                                <option value="PENDIENTE">Pendiente</option>
                                <option value="EN_PROCESO">En proceso</option>
                                <option value="CERRADA">Cerrada</option>
                              </select>
                            </td>
                            <td>
                              <input
                                className="personal-input calidad-file-input"
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={async (e) => {
                                  const file = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                                  try {
                                    setNoConformidadesError(null);
                                    const foto = await uploadRegistroFotografico(file);
                                    if (foto) updateNoConformidadRow(idx, { imagenUrl: foto.url, ...fotoGeoPayload(foto) });
                                  } catch (err) {
                                    setNoConformidadesError(err instanceof Error ? err.message : 'Error al subir imagen.');
                                  } finally {
                                    e.target.value = '';
                                  }
                                }}
                              />
                              {r.imagenUrl ? (
                                <img src={r.imagenUrl} alt="Registro fotográfico no conformidad" className="calidad-table-thumb" />
                              ) : null}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn-delete-personal"
                                aria-label="Eliminar fila"
                                onClick={() => removeNoConformidadRow(idx)}
                              >
                                <IconTrash />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {noConformidadesRows.length === 0 && (
                      <p className="shell-text-muted" style={{ padding: '1rem' }}>
                        No hay no conformidades. Usa “Agregar no conformidad”.
                      </p>
                    )}
                  </div>
                  </>
                )}

                <button
                  type="button"
                  className="btn-primary"
                  disabled={savingNoConformidades || informeBloqueado || !selectedObraId || !selectedJornadaId}
                  onClick={saveNoConformidades}
                  style={{ marginTop: '0.9rem' }}
                >
                  {savingNoConformidades ? 'Guardando...' : 'Guardar no conformidades'}
                </button>
              </fieldset>
            )}
          </section>
        )}

        {activeSection === 'evidencias' && (
          <section className="shell-card shell-card-wide">
            <h1 className="shell-title">Informe diario - Evidencias y cierre</h1>

            {evidenciasMessage && <p className="feedback feedback-success">{evidenciasMessage}</p>}
            {evidenciasError && <p className="feedback feedback-error">{evidenciasError}</p>}

            {loadingEvidencias ? (
              <p className="shell-text-muted">Cargando evidencias...</p>
            ) : (
              <fieldset disabled={informeBloqueado} style={informeFieldsetStyle}>
                <div style={{ marginTop: '0.75rem' }}>
                  <div className="section-title" style={{ marginTop: 0 }}>
                    ¿SE CARGÓ REGISTRO FOTOGRÁFICO?
                  </div>
                  <div className="toggle-group" aria-label="Registro fotográfico">
                    <button
                      type="button"
                      className={`toggle-button ${!registroFotografico ? 'toggle-active' : ''}`}
                      onClick={() => setRegistroFotografico(false)}
                    >
                      NO
                    </button>
                    <button
                      type="button"
                      className={`toggle-button ${registroFotografico ? 'toggle-active' : ''}`}
                      onClick={() => setRegistroFotografico(true)}
                    >
                      SÍ
                    </button>
                  </div>
                </div>

                <div className="section-divider" />

                {registroFotografico && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div className="section-title" style={{ marginTop: 0 }}>CARGA DE FOTOGRAFÍAS</div>
                    <p className="shell-text-muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                      Tres bloques independientes (antes, durante, después). Pulsa <strong>Elegir fotos</strong> en cada
                      fase. JPG, PNG · máx. 5 MB por archivo.
                    </p>
                    <div className="evidencias-fases-grid">
                      {EVIDENCIA_FASES.map(({ key, label }) => {
                        const items = evidenciaUrlsPorFase[key];
                        const n = items.length;
                        const rawIdx = evidenciaCarouselIndex[key];
                        const slideIdx =
                          n === 0 ? 0 : Math.min(Math.max(0, rawIdx), n - 1);
                        const currentItem = n > 0 ? items[slideIdx] : null;
                        const src = currentItem ? evidenciaCarouselImgSrc(currentItem) : '';
                        const href = currentItem ? evidenciaItemUrl(currentItem) : '';
                        return (
                          <div key={key} className="evidencias-fase-card">
                            <div className="evidencias-fase-title">{label}</div>
                            <button
                              type="button"
                              className="evidencias-fase-choose-btn"
                              onClick={() => evidenciaFileInputRefs.current[key]?.click()}
                            >
                              Elegir fotos
                            </button>
                            <p className="evidencias-fase-hint">JPG, PNG · máx. 5 MB por archivo</p>
                            <input
                              ref={(el) => {
                                evidenciaFileInputRefs.current[key] = el;
                              }}
                              type="file"
                              accept="image/png,image/jpeg"
                              multiple
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                void uploadEvidenciasFotos(e.target.files, key);
                                e.target.value = '';
                              }}
                            />
                            {n > 0 && currentItem && (
                              <div className="evidencias-carousel">
                                <div className="evidencias-carousel-slide">
                                  <img
                                    src={src}
                                    alt={`${label} ${slideIdx + 1} de ${n}`}
                                    className="evidencias-carousel-img"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.alt = 'No se pudo cargar la vista previa';
                                    }}
                                  />
                                  <button
                                    type="button"
                                    className="evidencias-fase-thumb-remove"
                                    aria-label={`Eliminar esta foto (${label})`}
                                    onClick={() => removeEvidenciaUrl(key, slideIdx)}
                                  >
                                    <IconTrash />
                                  </button>
                                </div>
                                {n > 1 && (
                                  <div className="evidencias-carousel-controls">
                                    <button
                                      type="button"
                                      className="evidencias-carousel-nav"
                                      aria-label="Foto anterior"
                                      disabled={slideIdx <= 0}
                                      onClick={() =>
                                        setEvidenciaCarouselIndex((prev) => ({
                                          ...prev,
                                          [key]: Math.max(0, prev[key] - 1),
                                        }))
                                      }
                                    >
                                      <span className="evidencias-carousel-chevron evidencias-carousel-chevron-prev">
                                        <IconChevronRight />
                                      </span>
                                    </button>
                                    <span className="evidencias-carousel-counter">
                                      {slideIdx + 1} / {n}
                                    </span>
                                    <button
                                      type="button"
                                      className="evidencias-carousel-nav"
                                      aria-label="Foto siguiente"
                                      disabled={slideIdx >= n - 1}
                                      onClick={() =>
                                        setEvidenciaCarouselIndex((prev) => ({
                                          ...prev,
                                          [key]: Math.min(n - 1, prev[key] + 1),
                                        }))
                                      }
                                    >
                                      <span className="evidencias-carousel-chevron">
                                        <IconChevronRight />
                                      </span>
                                    </button>
                                  </div>
                                )}
                                {n > 1 && (
                                  <div className="evidencias-carousel-dots" role="tablist" aria-label={`Fotos ${label}`}>
                                    {items.map((_, dotIdx) => (
                                      <button
                                        key={`${key}-dot-${dotIdx}`}
                                        type="button"
                                        role="tab"
                                        aria-selected={dotIdx === slideIdx}
                                        className={`evidencias-carousel-dot ${dotIdx === slideIdx ? 'evidencias-carousel-dot-active' : ''}`}
                                        aria-label={`Ir a foto ${dotIdx + 1}`}
                                        onClick={() =>
                                          setEvidenciaCarouselIndex((prev) => ({
                                            ...prev,
                                            [key]: dotIdx,
                                          }))
                                        }
                                      />
                                    ))}
                                  </div>
                                )}
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="evidencias-carousel-open-link"
                                >
                                  Abrir en el navegador
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {uploadingEvidencia && (
                      <p className="shell-text-muted" style={{ marginTop: '0.5rem' }}>
                        Subiendo...
                      </p>
                    )}
                  </div>
                )}

                <div className="section-divider" />

                <div style={{ marginTop: '0.75rem' }}>
                  <div className="section-title" style={{ marginTop: 0 }}>OBSERVACIONES GENERALES</div>
                  <textarea
                    className="textarea-input personal-input"
                    placeholder="Escribe observaciones generales..."
                    value={observacionesGenerales}
                    onChange={(e) => setObservacionesGenerales(e.target.value)}
                    style={{ width: '100%', marginTop: '0.4rem', minHeight: 110 }}
                  />
                </div>

                <div className="section-divider" />

                <div style={{ marginTop: '0.75rem' }}>
                  <div className="section-title" style={{ marginTop: 0 }}>FIRMAS Y RESPONSABLES</div>

                  <div
                    style={{
                      marginTop: '0.75rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.25rem',
                    }}
                  >
                    {FIRMAS_EVIDENCIAS_CONFIG.map(({ key, label }) => {
                      const f = firmasEvidencias[key];
                      const puedeFirmarAqui = firmaSlotPermissions?.[key] === true;
                      const bloquearEdicion = !puedeFirmarAqui || informeBloqueado;
                      const mostrarAvisoRol = firmaSlotPermissions !== null && !puedeFirmarAqui;
                      return (
                        <div
                          key={key}
                          style={{
                            padding: '1rem',
                            borderRadius: 12,
                            border: '1px solid rgba(209, 213, 219, 0.95)',
                            background: '#f9fafb',
                            opacity: mostrarAvisoRol ? 0.92 : 1,
                          }}
                        >
                          <div style={{ fontWeight: 700, color: '#111827', marginBottom: '0.65rem' }}>{label}</div>
                          {mostrarAvisoRol && (
                            <p className="shell-text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.65rem' }}>
                              Tu rol no puede registrar firmas en esta fila. Solo usuarios autorizados ven el código y
                              pueden validar la firma.
                            </p>
                          )}

                          {f.firmado ? (
                            <div className="firma-completa-box">
                              <div className="firma-completa-header">
                                <span className="firma-completa-badge">Firma completa</span>
                              </div>
                              {f.firmadoEn ? (
                                <p className="firma-completa-fecha">
                                  Registrada el{' '}
                                  {new Date(f.firmadoEn).toLocaleString('es-CO', {
                                    dateStyle: 'long',
                                    timeStyle: 'short',
                                  })}
                                </p>
                              ) : (
                                <p className="firma-completa-fecha shell-text-muted">Firma registrada (sin fecha en historial)</p>
                              )}
                            </div>
                          ) : (
                            <>
                              <div className="form-field">
                                <div className="firma-codigo-label-row">
                                  <label className="form-label" htmlFor={`firma-codigo-${key}`}>
                                    Código <span className="firma-required-star">*</span>
                                  </label>
                                  {firmaToken && puedeFirmarAqui && (
                                    <button
                                      type="button"
                                      className="firma-usar-mi-codigo"
                                      onClick={() =>
                                        setFirmasEvidencias((prev) => ({
                                          ...prev,
                                          [key]: { ...prev[key], codigo: firmaToken ?? '' },
                                        }))
                                      }
                                    >
                                      Usar mi código
                                    </button>
                                  )}
                                </div>
                                <input
                                  id={`firma-codigo-${key}`}
                                  className="form-input"
                                  type="text"
                                  placeholder={firmaToken ? 'Código de la barra superior' : 'Código'}
                                  value={f.codigo}
                                  disabled={bloquearEdicion}
                                  onChange={(e) =>
                                    setFirmasEvidencias((prev) => ({
                                      ...prev,
                                      [key]: { ...prev[key], codigo: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="form-field" style={{ marginTop: '0.5rem' }}>
                                <label className="form-label" htmlFor={`firma-obs-${key}`}>
                                  Observación <span className="firma-required-star">*</span>
                                </label>
                                <textarea
                                  id={`firma-obs-${key}`}
                                  className="textarea-input personal-input"
                                  placeholder="Describe la observación antes de firmar"
                                  value={f.observacion}
                                  disabled={bloquearEdicion}
                                  onChange={(e) =>
                                    setFirmasEvidencias((prev) => ({
                                      ...prev,
                                      [key]: { ...prev[key], observacion: e.target.value },
                                    }))
                                  }
                                  style={{ width: '100%', marginTop: '0.25rem', minHeight: 72 }}
                                />
                              </div>
                              <div
                                style={{
                                  marginTop: '0.65rem',
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  gap: '0.65rem',
                                }}
                              >
                                <button
                                  type="button"
                                  className="btn-primary"
                                  disabled={
                                    savingEvidencias ||
                                    bloquearEdicion ||
                                    !puedeFirmarAqui ||
                                    !String(f.codigo).trim() ||
                                    !String(f.observacion).trim()
                                  }
                                  onClick={async () => {
                                    const ts = new Date().toISOString();
                                    const nextFirmas: Record<FirmaEvidenciaKey, FirmaEvidenciaState> = {
                                      ...firmasEvidencias,
                                      [key]: { ...firmasEvidencias[key], firmado: true, firmadoEn: ts },
                                    };
                                    const ok = await persistEvidenciasApi(nextFirmas, {
                                      skipPhotoValidation: true,
                                    });
                                    if (ok) {
                                      setFirmasEvidencias(nextFirmas);
                                      setEvidenciasMessage('Firma guardada en la base de datos.');
                                      setTimeout(() => setEvidenciasMessage(null), 2500);
                                    }
                                  }}
                                >
                                  {savingEvidencias ? 'Guardando firma…' : 'Firmar'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  disabled={savingEvidencias || informeBloqueado || !selectedObraId || !selectedJornadaId}
                  onClick={saveEvidencias}
                  style={{ marginTop: '1rem' }}
                >
                  {savingEvidencias ? 'Guardando...' : 'Guardar evidencias y cierre'}
                </button>
              </fieldset>
            )}
          </section>
        )}

        {activeSection === 'tabulacion' && (
          <section className="shell-card shell-card-wide">
            <h1 className="shell-title" style={{ textAlign: 'center' }}>
              Formato de tabulación
            </h1>
            {tabulacionExportError ? <p className="feedback feedback-error">{tabulacionExportError}</p> : null}
            <button
              type="button"
              className="btn-primary"
              disabled={
                tabulacionExporting || !selectedObraId || !selectedJornadaId || !datosGeneralesForm.fechaReporte
              }
              onClick={async () => {
                setTabulacionExportError(null);
                setTabulacionExporting(true);
                try {
                  const q = new URLSearchParams({
                    projectId: selectedObraId,
                    date: datosGeneralesForm.fechaReporte,
                    jornadaId: selectedJornadaId,
                  });
                  const res = await fetch(`/api/informes/formato-tabulacion?${q}`, { credentials: 'include' });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    setTabulacionExportError(
                      typeof (err as { error?: string }).error === 'string'
                        ? (err as { error: string }).error
                        : 'No se pudo generar el Excel.',
                    );
                    return;
                  }
                  const blob = await res.blob();
                  const cd = res.headers.get('Content-Disposition');
                  const m = cd && /filename="([^"]+)"/.exec(cd);
                  const name = m ? m[1] : 'Formato_Tabulacion.xlsx';
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = name;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  setTabulacionExportError('Error de conexión.');
                } finally {
                  setTabulacionExporting(false);
                }
              }}
            >
              {tabulacionExporting ? 'Generando…' : 'Descargar Excel (.xlsx)'}
            </button>
          </section>
        )}
      </main>

      {jornadaRangoAlert && (
        <div
          className="sigocc-alert-modal-backdrop"
          role="presentation"
          onClick={() => setJornadaRangoAlert(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sigocc-jornada-rango-titulo"
            className="sigocc-alert-modal"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="sigocc-jornada-rango-titulo" className="sigocc-alert-modal-title">
              Horas fuera del rango de la jornada
            </h2>
            <p className="sigocc-alert-modal-text">{jornadaRangoAlert}</p>
            <button type="button" className="btn-primary sigocc-alert-modal-btn" onClick={() => setJornadaRangoAlert(null)}>
              Entendido
            </button>
          </div>
        </div>
      )}
      {registroFotoPreviewUrl ? (
        <div
          className="registro-foto-modal-backdrop"
          role="presentation"
          onClick={() => setRegistroFotoPreviewUrl(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Previsualización de registro fotográfico"
            className="registro-foto-modal"
            onClick={(ev) => ev.stopPropagation()}
          >
            <img src={registroFotoPreviewUrl} alt="Previsualización del registro fotográfico" />
            <button type="button" className="btn-primary" onClick={() => setRegistroFotoPreviewUrl(null)}>
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

