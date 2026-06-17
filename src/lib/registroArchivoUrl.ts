import { extractGoogleDriveFileIdFromStoredUrl } from './evidenciasUrlPayload';
import { localUploadPathFromUrl } from './firmaImageSrc';
import { isSharePointOrOneDriveShareUrl } from './obraCarpetaNube';
import { isImageContentType } from '../shared/registroBitacoraFirmaDocs';

export function registroDocEsImagen(url: string, contentType?: string): boolean {
  const s = url.trim();
  if (!s) return false;
  if (isImageContentType(contentType)) return true;
  return s.startsWith('data:image/') || /\.(jpe?g|png|gif|webp)(\?|$)/i.test(s);
}

/** Solo URLs que el servidor puede resolver (local, OneDrive, Google Drive). */
export function isAllowedRegistroArchivoUrl(url: string): boolean {
  const s = url.trim();
  if (!s) return false;
  if (localUploadPathFromUrl(s)) return true;
  if (!/^https?:\/\//i.test(s)) return false;
  if (isSharePointOrOneDriveShareUrl(s)) return true;
  if (extractGoogleDriveFileIdFromStoredUrl(s)) return true;
  return /drive\.google\.com|googleusercontent\.com/i.test(s);
}

/**
 * Enlace para ver o descargar el archivo desde la app (evita redirigir a OneDrive/Drive).
 * Los archivos en `/uploads/…` se sirven directamente.
 */
export function registroArchivoAppHref(
  storedUrl: string,
  fileName?: string,
  origin = '',
): string {
  const s = storedUrl.trim();
  if (!s) return '';
  if (s.startsWith('/uploads/')) return origin ? `${origin}${s}` : s;
  if (s.startsWith('data:')) return s;
  const qs = new URLSearchParams({ url: s });
  if (fileName?.trim()) qs.set('name', fileName.trim());
  const path = `/api/uploads/archivo?${qs}`;
  return origin ? `${origin}${path}` : path;
}
