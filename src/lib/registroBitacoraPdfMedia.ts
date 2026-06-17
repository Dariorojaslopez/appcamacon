import fs from 'fs/promises';
import path from 'path';
import {
  extractGoogleDriveFileIdFromStoredUrl,
  storedMediaImgSrc,
} from './evidenciasUrlPayload';
import { isAllowedInlineImageUrl, localUploadPathFromUrl } from './firmaImageSrc';
import { getGoogleDriveAccessToken } from './googleDriveUpload';
import {
  downloadOneDriveFileFromShareLink,
  oneDriveGraphCredentials,
} from './onedriveGraphUpload';
import { isSharePointOrOneDriveShareUrl } from './obraCarpetaNube';

const embedCache = new Map<string, string>();

export function clearRegistroBitacoraPdfMediaCache(): void {
  embedCache.clear();
}

function localRelFromStored(stored: string): string | null {
  const direct = localUploadPathFromUrl(stored);
  if (direct) return direct;
  try {
    return localUploadPathFromUrl(new URL(stored).pathname);
  } catch {
    return null;
  }
}

function absMediaPdfFallback(_origin: string, stored: string): string {
  const rel = storedMediaImgSrc(stored) ?? stored.trim();
  if (!rel) return '';
  if (rel.startsWith('http')) return rel;
  if (rel.startsWith('/')) return rel;
  return `${_origin}/${rel}`;
}

function mimeFromExt(ext: string): string {
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

function toDataUri(mime: string, buffer: Buffer): string {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

function extractDriveFileIdFromApiPath(stored: string): string | null {
  const m = stored.match(/\/api\/uploads\/drive-image\?fileId=([a-zA-Z0-9_-]+)/);
  return m?.[1] ?? null;
}

function resolveDriveFileId(stored: string): string | null {
  return (
    extractDriveFileIdFromApiPath(stored) ??
    extractGoogleDriveFileIdFromStoredUrl(stored) ??
    (() => {
      const proxy = storedMediaImgSrc(stored);
      if (!proxy) return null;
      return extractDriveFileIdFromApiPath(proxy) ?? extractGoogleDriveFileIdFromStoredUrl(proxy);
    })()
  );
}

async function fetchGoogleDriveImageBuffer(fileId: string): Promise<{ buffer: Buffer; mime: string } | null> {
  if (process.env.GOOGLE_DRIVE_ENABLED !== 'true') return null;
  try {
    const accessToken = await getGoogleDriveAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const mime = res.headers.get('content-type') || 'image/jpeg';
    return { buffer: Buffer.from(await res.arrayBuffer()), mime };
  } catch {
    return null;
  }
}

async function fetchRemoteImageBuffer(url: string): Promise<{ buffer: Buffer; mime: string } | null> {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return null;
    const mime = res.headers.get('content-type') || '';
    if (!mime.startsWith('image/')) return null;
    return { buffer: Buffer.from(await res.arrayBuffer()), mime };
  } catch {
    return null;
  }
}

async function fetchOneDriveImageBuffer(url: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const creds = oneDriveGraphCredentials();
  if (!creds) return null;
  const fetched = await downloadOneDriveFileFromShareLink(
    url,
    creds.tenantId,
    creds.clientId,
    creds.clientSecret,
  );
  if (!fetched) return null;
  if (!fetched.mime.startsWith('image/')) return null;
  return fetched;
}

async function resolveMediaParaPdfEmbedInner(
  origin: string,
  stored: string,
): Promise<string> {
  const localRel = localRelFromStored(stored);
  if (localRel) {
    try {
      const filePath = path.join(process.cwd(), 'public', localRel);
      const buf = await fs.readFile(filePath);
      return toDataUri(mimeFromExt(path.extname(filePath)), buf);
    } catch {
      /* continuar con otros métodos */
    }
  }

  const driveId = resolveDriveFileId(stored);
  if (driveId) {
    const fetched = await fetchGoogleDriveImageBuffer(driveId);
    if (fetched) return toDataUri(fetched.mime, fetched.buffer);
  }

  if (/^https?:\/\//i.test(stored) && isSharePointOrOneDriveShareUrl(stored)) {
    const fetched = await fetchOneDriveImageBuffer(stored);
    if (fetched) return toDataUri(fetched.mime, fetched.buffer);
  }

  if (/^https?:\/\//i.test(stored) && isAllowedInlineImageUrl(stored)) {
    const fetched = await fetchRemoteImageBuffer(stored);
    if (fetched) return toDataUri(fetched.mime, fetched.buffer);
  }

  return absMediaPdfFallback(origin, stored);
}

/**
 * Resuelve una URL guardada en BD a un src embebible en HTML/PDF (data URI o URL absoluta).
 * Evita depender de cookies del navegador para /api/uploads/drive-image al imprimir.
 */
export async function resolveMediaParaPdfEmbed(
  origin: string,
  stored: string | null | undefined,
): Promise<string> {
  if (stored == null || !String(stored).trim()) return '';
  const s = String(stored).trim();
  const cacheKey = `${origin}\0${s}`;
  const cached = embedCache.get(cacheKey);
  if (cached !== undefined) return cached;
  const resolved = await resolveMediaParaPdfEmbedInner(origin, s);
  embedCache.set(cacheKey, resolved);
  return resolved;
}
