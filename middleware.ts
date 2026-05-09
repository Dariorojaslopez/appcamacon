import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/api/auth/login', '/api/auth/forgot-password', '/offline.html'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'));

  if (isPublic) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get('access_token')?.value;

  if (!accessToken) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const loginUrl = new URL('/', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // En middleware solo comprobamos presencia del token para ser
  // compatibles con el runtime Edge. La verificación completa se
  // hace en los endpoints protegidos del backend.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|images).*)'],
};

