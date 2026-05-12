import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/drive.file';

function googleRedirectUri(req: NextRequest): string {
  const configured = process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim();
  if (configured) return configured;
  return new URL('/auth/google/callback', req.url).toString();
}

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  if (!clientId) {
    return new NextResponse('GOOGLE_DRIVE_CLIENT_ID no está configurado.', { status: 500 });
  }

  const state = randomBytes(24).toString('hex');
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', googleRedirectUri(req));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', process.env.GOOGLE_DRIVE_SCOPE?.trim() || DEFAULT_SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(req.url).protocol === 'https:',
    path: '/auth/google',
    maxAge: 10 * 60,
  });
  return response;
}
