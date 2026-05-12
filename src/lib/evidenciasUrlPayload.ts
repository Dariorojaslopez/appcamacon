export type EvidenciaFase = 'antes' | 'durante' | 'despues';

/** URL principal (informe / enlace). Opcionalmente miniatura y GPS capturado al cargar/tomar foto. */
export type EvidenciaItem =
  | string
  | {
      url: string;
      previewUrl?: string;
      imagenLatitud?: number | null;
      imagenLongitud?: number | null;
      imagenPrecision?: number | null;
      imagenGeoEstado?: string | null;
      imagenTomadaEn?: string | null;
    };

export type EvidenciaUrlsPorFase = Record<EvidenciaFase, EvidenciaItem[]>;

export const EVIDENCIA_FASES: { key: EvidenciaFase; label: string }[] = [
  { key: 'antes', label: 'Antes' },
  { key: 'durante', label: 'Durante' },
  { key: 'despues', label: 'Después' },
];

export function emptyEvidenciaUrlsPorFase(): EvidenciaUrlsPorFase {
  return { antes: [], durante: [], despues: [] };
}

export function evidenciaItemUrl(item: EvidenciaItem): string {
  return typeof item === 'string' ? item : item.url;
}

/** Extrae el ID de archivo de un enlace tipo /file/d/ID/ de Google Drive. */
export function extractGoogleDriveFileIdFromViewUrl(url: string): string | null {
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

/**
 * URL usable en <img src>. Para Drive, la webViewLink no sirve; usamos thumbnail de la API o fallback.
 */
export function evidenciaPreviewSrcForStoredUrl(storedUrl: string): string {
  const id = extractGoogleDriveFileIdFromViewUrl(storedUrl);
  if (id) {
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w800`;
  }
  return storedUrl;
}

export function evidenciaItemPreviewForImg(item: EvidenciaItem): string {
  if (typeof item === 'object' && item.previewUrl?.trim()) return item.previewUrl.trim();
  return evidenciaPreviewSrcForStoredUrl(evidenciaItemUrl(item));
}

/**
 * URL para el carrusel: las imágenes en Google Drive no se pueden mostrar con webViewLink ni thumbnail público;
 * el cliente usa `/api/uploads/drive-image` (sesión + token servidor).
 */
export function evidenciaCarouselImgSrc(item: EvidenciaItem): string {
  const mainUrl = evidenciaItemUrl(item);
  const driveId = extractGoogleDriveFileIdFromViewUrl(mainUrl);
  if (driveId) {
    return `/api/uploads/drive-image?fileId=${encodeURIComponent(driveId)}`;
  }
  if (mainUrl.startsWith('/')) {
    return mainUrl;
  }
  if (typeof item === 'object' && item.previewUrl?.trim()) {
    return item.previewUrl.trim();
  }
  return mainUrl;
}

function parseEvidenciaItem(item: unknown): EvidenciaItem {
  if (item == null) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null && 'url' in item) {
    const o = item as {
      url: unknown;
      previewUrl?: unknown;
      imagenLatitud?: unknown;
      imagenLongitud?: unknown;
      imagenPrecision?: unknown;
      imagenGeoEstado?: unknown;
      imagenTomadaEn?: unknown;
    };
    return {
      url: String(o.url ?? ''),
      previewUrl: o.previewUrl != null && String(o.previewUrl).trim() ? String(o.previewUrl).trim() : undefined,
      imagenLatitud: typeof o.imagenLatitud === 'number' && Number.isFinite(o.imagenLatitud) ? o.imagenLatitud : null,
      imagenLongitud: typeof o.imagenLongitud === 'number' && Number.isFinite(o.imagenLongitud) ? o.imagenLongitud : null,
      imagenPrecision: typeof o.imagenPrecision === 'number' && Number.isFinite(o.imagenPrecision) ? o.imagenPrecision : null,
      imagenGeoEstado:
        o.imagenGeoEstado != null && String(o.imagenGeoEstado).trim()
          ? String(o.imagenGeoEstado).trim()
          : null,
      imagenTomadaEn:
        o.imagenTomadaEn != null && String(o.imagenTomadaEn).trim()
          ? String(o.imagenTomadaEn).trim()
          : null,
    };
  }
  return String(item);
}

/** Parsea el JSON guardado en InformeDiario.evidenciasUrl (legacy: array plano → solo en "antes"). */
export function parseEvidenciasStored(raw: string | null | undefined): EvidenciaUrlsPorFase {
  const empty = emptyEvidenciaUrlsPorFase();
  if (!raw || !String(raw).trim()) return empty;
  try {
    const p = JSON.parse(raw) as unknown;
    if (Array.isArray(p)) {
      return { ...empty, antes: p.map(parseEvidenciaItem) };
    }
    if (p && typeof p === 'object') {
      const o = p as Record<string, unknown>;
      const arr = (k: EvidenciaFase) =>
        Array.isArray(o[k]) ? (o[k] as unknown[]).map(parseEvidenciaItem) : [];
      return {
        antes: arr('antes'),
        durante: arr('durante'),
        despues: arr('despues'),
      };
    }
  } catch {
    if (raw.includes(',')) {
      return { ...empty, antes: raw.split(',').map((s) => s.trim()).filter(Boolean) };
    }
    return { ...empty, antes: [raw] };
  }
  return empty;
}

/** Normaliza el body del POST (array legacy u objeto por fase). */
export function normalizeEvidenciasBody(input: unknown): EvidenciaUrlsPorFase {
  const empty = emptyEvidenciaUrlsPorFase();
  if (input == null) return empty;
  if (Array.isArray(input)) {
    return { ...empty, antes: input.map(parseEvidenciaItem) };
  }
  if (typeof input === 'object') {
    const o = input as Record<string, unknown>;
    const arr = (k: EvidenciaFase) =>
      Array.isArray(o[k]) ? (o[k] as unknown[]).map(parseEvidenciaItem) : [];
    return {
      antes: arr('antes'),
      durante: arr('durante'),
      despues: arr('despues'),
    };
  }
  return empty;
}

export function serializeEvidenciasForDb(data: EvidenciaUrlsPorFase): string {
  return JSON.stringify(data);
}

export function totalEvidenciasCount(data: EvidenciaUrlsPorFase): number {
  return data.antes.length + data.durante.length + data.despues.length;
}
