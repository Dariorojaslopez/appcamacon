import { NextRequest, NextResponse } from 'next/server';
import { buildContentSecurityPolicy, generateNonce } from './src/lib/csp';

const PUBLIC_PATHS = [
  '/',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/emergency-reset',
  '/offline.html',
];

function nextWithCsp(req: NextRequest, attachCspOnResponse = true): NextResponse {
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV === 'development';
  const csp = buildContentSecurityPolicy(nonce, isDev);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  if (attachCspOnResponse) {
    requestHeaders.set('Content-Security-Policy', csp);
  }
  const res = NextResponse.next({
    request: { headers: requestHeaders },
  });
  if (attachCspOnResponse) {
    res.headers.set('Content-Security-Policy', csp);
  }
  return res;
}

/** La vista HTML del PDF define su propia CSP (script con nonce para imprimir). */
function isPdfPreviewPath(pathname: string): boolean {
  return pathname === '/api/registro-bitacora/pdf';
}

function jsonWithCsp(body: unknown, status: number): NextResponse {
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV === 'development';
  const csp = buildContentSecurityPolicy(nonce, isDev);
  const res = NextResponse.json(body, { status });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'));

  const skipCspOnResponse = isPdfPreviewPath(pathname);

  if (isPublic) {
    return nextWithCsp(req, !skipCspOnResponse);
  }

  const accessToken = req.cookies.get('access_token')?.value;

  if (!accessToken) {
    if (pathname.startsWith('/api/')) {
      return jsonWithCsp({ error: 'No autenticado' }, 401);
    }
    // No redirigimos fuera de API para evitar cierres de sesión forzados en navegación.
    return nextWithCsp(req, !skipCspOnResponse);
  }

  // En middleware solo comprobamos presencia del token para ser
  // compatibles con el runtime Edge. La verificación completa se
  // hace en los endpoints protegidos del backend.
  return nextWithCsp(req, !skipCspOnResponse);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|images).*)'],
};

