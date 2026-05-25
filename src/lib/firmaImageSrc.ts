import { storedMediaImgSrc } from './evidenciasUrlPayload';

/** URL segura para mostrar o cargar una firma/archivo de imagen guardado. */
export function firmaImageDisplaySrc(storedUrl: string | null | undefined): string | null {
  if (storedUrl == null || !String(storedUrl).trim()) return null;
  const s = String(storedUrl).trim();
  const driveProxy = storedMediaImgSrc(s);
  if (driveProxy) return driveProxy;
  if (s.startsWith('/')) return s;
  if (/^https?:\/\//i.test(s)) {
    return `/api/uploads/inline-image?url=${encodeURIComponent(s)}`;
  }
  return s;
}

export function isAllowedInlineImageUrl(url: string): boolean {
  const s = url.trim();
  if (!s) return false;
  if (s.startsWith('/uploads/') && !s.includes('..')) return true;
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
    return (
      host.endsWith('sharepoint.com') ||
      host.includes('sharepoint') ||
      host.endsWith('onedrive.com') ||
      host.includes('1drv.ms') ||
      host.endsWith('googleusercontent.com') ||
      host.endsWith('drive.google.com') ||
      host.endsWith('docs.google.com')
    );
  } catch {
    return false;
  }
}

export function localUploadPathFromUrl(url: string): string | null {
  const s = url.trim();
  if (!s.startsWith('/uploads/') || s.includes('..')) return null;
  return s.replace(/^\//, '');
}
