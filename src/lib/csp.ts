/**
 * CSP por petición (nonce + strict-dynamic) para evitar unsafe-inline/unsafe-eval en producción.
 * Ver: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** CSP relajado solo para la vista HTML imprimible de bitácora (estilos con nonce + inline mínimo). */
export function buildPdfPreviewContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    "script-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
  ].join('; ');
}

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const scriptDev = isDev ? " 'unsafe-eval'" : '';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${scriptDev}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}
