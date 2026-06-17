import type { NextRequest } from 'next/server';

/** Dominio público de la app en producción (sin depender del .env). */
export const PRODUCTION_APP_ORIGIN = 'https://appinformediario.camacon.com.co';

/**
 * Origen para enlaces del PDF de bitácora y medios embebidos en el servidor.
 * En producción el contenedor solo ve localhost:3000; se usa el dominio público fijo.
 */
export function resolvePublicAppOrigin(req: NextRequest): string {
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_APP_ORIGIN;
  }

  const host = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || req.headers.get('host')?.trim();
  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http';
    return `${proto}://${host}`;
  }

  return new URL(req.url).origin;
}

/** Enlace absoluto de descarga en el PDF (siempre dominio de producción). */
export function registroArchivoPdfHref(storedUrl: string, fileName?: string): string {
  const s = storedUrl.trim();
  if (!s) return '';
  if (s.startsWith('data:')) return s;
  const qs = new URLSearchParams({ url: s });
  if (fileName?.trim()) qs.set('name', fileName.trim());
  return `${PRODUCTION_APP_ORIGIN}/api/uploads/archivo?${qs}`;
}
