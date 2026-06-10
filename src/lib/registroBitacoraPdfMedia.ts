import fs from 'fs/promises';
import path from 'path';
import {
  extractGoogleDriveFileIdFromStoredUrl,
  storedMediaImgSrc,
} from './evidenciasUrlPayload';
import { isAllowedInlineImageUrl, localUploadPathFromUrl } from './firmaImageSrc';
import { getGoogleDriveAccessToken } from './googleDriveUpload';
import { isSharePointOrOneDriveShareUrl } from './obraCarpetaNube';

function absMediaPdfFallback(origin: string, stored: string): string {
  const rel = storedMediaImgSrc(stored) ?? stored.trim();
  if (!rel) return '';
  if (rel.startsWith('http')) return rel;
  return `${origin}${rel.startsWith('/') ? '' : '/'}${rel}`;
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

  const localRel = localUploadPathFromUrl(s);
  if (localRel) {
    try {
      const filePath = path.join(process.cwd(), 'public', localRel);
      const buf = await fs.readFile(filePath);
      return toDataUri(mimeFromExt(path.extname(filePath)), buf);
    } catch {
      /* continuar con otros métodos */
    }
  }

  const driveId = resolveDriveFileId(s);
  if (driveId) {
    const fetched = await fetchGoogleDriveImageBuffer(driveId);
    if (fetched) return toDataUri(fetched.mime, fetched.buffer);
  }

  if (/^https?:\/\//i.test(s) && isAllowedInlineImageUrl(s)) {
    const fetched = await fetchRemoteImageBuffer(s);
    if (fetched) return toDataUri(fetched.mime, fetched.buffer);
  }

  if (/^https?:\/\//i.test(s) && isSharePointOrOneDriveShareUrl(s)) {
    const fetched = await fetchRemoteImageBuffer(s);
    if (fetched) return toDataUri(fetched.mime, fetched.buffer);
  }

  return absMediaPdfFallback(origin, s);
}
