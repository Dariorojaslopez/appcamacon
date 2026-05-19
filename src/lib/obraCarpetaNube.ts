/** Detecta enlace compartido de SharePoint o OneDrive (carpeta). */
export function isSharePointOrOneDriveShareUrl(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  if (!t.startsWith('http')) return false;
  return t.includes('sharepoint.com') || t.includes('1drv.ms');
}

/**
 * Normaliza lo pegado en "Carpeta SharePoint / OneDrive" de la obra:
 * - URL http(s) SharePoint/OneDrive → evidenciasOnedriveShareUrl
 * - ID u otro texto → evidenciasGoogleDriveFolderId (compatibilidad Google Drive)
 */
export function normalizeObraCarpetaInput(raw: string): {
  evidenciasOnedriveShareUrl: string | null;
  evidenciasGoogleDriveFolderId: string | null;
} {
  const t = raw.trim();
  if (!t) {
    return { evidenciasOnedriveShareUrl: null, evidenciasGoogleDriveFolderId: null };
  }
  if (isSharePointOrOneDriveShareUrl(t)) {
    return { evidenciasOnedriveShareUrl: t, evidenciasGoogleDriveFolderId: null };
  }
  return { evidenciasOnedriveShareUrl: null, evidenciasGoogleDriveFolderId: t };
}

/** Valor a mostrar en el formulario de obra (prioriza enlace OneDrive). */
export function obraCarpetaInputFromDb(
  onedrive: string | null | undefined,
  gdrive: string | null | undefined,
): string {
  const o = onedrive?.trim() || '';
  if (o) return o;
  const g = gdrive?.trim() || '';
  if (g && isSharePointOrOneDriveShareUrl(g)) return g;
  return g;
}
