/** Documento adjunto en la sección firma del registro de bitácora (por perfil). */
export type RegistroBitacoraFirmaDoc = {
  url: string;
  name: string;
  contentType?: string;
};

export const MAX_REGISTRO_FIRMA_DOCS = 20;

export function isImageContentType(ct: string | undefined): boolean {
  if (!ct) return false;
  return ct.startsWith('image/');
}

export function parseFirmaDocsJson(raw: unknown): RegistroBitacoraFirmaDoc[] {
  if (!Array.isArray(raw)) return [];
  const out: RegistroBitacoraFirmaDoc[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const url = typeof o.url === 'string' ? o.url.trim() : '';
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!url || !/^https?:\/\//i.test(url)) continue;
    out.push({
      url,
      name: name || 'Documento',
      contentType: typeof o.contentType === 'string' ? o.contentType : undefined,
    });
    if (out.length >= MAX_REGISTRO_FIRMA_DOCS) break;
  }
  return out;
}

/** Si solo existía firmaUrl (imagen única legacy), la incluye en la lista. */
export function mergeLegacyFirmaUrl(
  firmaUrl: string | null | undefined,
  docs: RegistroBitacoraFirmaDoc[],
): RegistroBitacoraFirmaDoc[] {
  const url = firmaUrl?.trim() ?? '';
  if (!url) return docs;
  if (docs.some((d) => d.url === url)) return docs;
  return [{ url, name: 'Firma (imagen)', contentType: 'image/png' }, ...docs];
}

export function normalizeFirmaDocsForSave(input: unknown): RegistroBitacoraFirmaDoc[] {
  return parseFirmaDocsJson(input);
}
