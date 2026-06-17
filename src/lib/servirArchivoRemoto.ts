import fs from 'fs/promises';
import path from 'path';
import { extractGoogleDriveFileIdFromStoredUrl } from './evidenciasUrlPayload';
import { localUploadPathFromUrl } from './firmaImageSrc';
import { getGoogleDriveAccessToken } from './googleDriveUpload';
import {
  downloadOneDriveFileFromShareLink,
  oneDriveGraphCredentials,
} from './onedriveGraphUpload';
import { isSharePointOrOneDriveShareUrl } from './obraCarpetaNube';

function mimeFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.doc')) return 'application/msword';
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (n.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (n.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

async function fetchGoogleDriveFileBuffer(fileId: string): Promise<{ buffer: Buffer; mime: string } | null> {
  if (process.env.GOOGLE_DRIVE_ENABLED !== 'true') return null;
  try {
    const accessToken = await getGoogleDriveAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return null;
    const mime = res.headers.get('content-type') || 'application/octet-stream';
    return { buffer: Buffer.from(await res.arrayBuffer()), mime };
  } catch {
    return null;
  }
}

/**
 * Obtiene el contenido de un archivo guardado en disco local, OneDrive o Google Drive.
 */
export async function fetchArchivoBuffer(
  storedUrl: string,
): Promise<{ buffer: Buffer; mime: string } | null> {
  const s = storedUrl.trim();
  if (!s) return null;

  const localRel = localUploadPathFromUrl(s);
  if (localRel) {
    try {
      const filePath = path.join(process.cwd(), 'public', localRel);
      const buf = await fs.readFile(filePath);
      return { buffer: buf, mime: mimeFromName(path.basename(filePath)) };
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(s) && isSharePointOrOneDriveShareUrl(s)) {
    const creds = oneDriveGraphCredentials();
    if (creds) {
      return downloadOneDriveFileFromShareLink(s, creds.tenantId, creds.clientId, creds.clientSecret);
    }
  }

  const driveId = extractGoogleDriveFileIdFromStoredUrl(s);
  if (driveId) {
    return fetchGoogleDriveFileBuffer(driveId);
  }

  return null;
}
