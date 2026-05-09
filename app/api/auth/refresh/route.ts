import { NextRequest, NextResponse } from 'next/server';
import { signAccessToken, verifyRefreshToken } from '../../../../src/infrastructure/auth/tokens';

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json({ error: 'No hay token de sesión' }, { status: 401 });
    }

    const payload = verifyRefreshToken(refreshToken);
    const newAccessToken = signAccessToken(payload);

    const response = NextResponse.json({ ok: true }, { status: 200 });
    const isProd = process.env.NODE_ENV === 'production';

    response.cookies.set('access_token', newAccessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
  }
}

