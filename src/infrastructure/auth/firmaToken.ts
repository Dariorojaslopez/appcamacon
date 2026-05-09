import crypto from 'crypto';

/**
 * Token determinístico por usuario, rol y día UTC (cambia cada medianoche UTC).
 * Usa FIRMA_TOKEN_SECRET o, en su defecto, JWT_ACCESS_SECRET.
 */
export function generarTokenFirma(userId: string, role: string): string {
  const utcYmd = new Date().toISOString().slice(0, 10);
  const secret =
    process.env.FIRMA_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
  return crypto
    .createHmac('sha256', secret)
    .update(`${userId}|${role}|${utcYmd}`)
    .digest('hex')
    .slice(0, 14)
    .toUpperCase();
}
