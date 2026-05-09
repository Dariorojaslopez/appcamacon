import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import { getGoogleDriveAccessToken } from '../../../../src/lib/googleDriveUpload';

/**
 * Sirve el contenido de un archivo de Google Drive para <img src> (la webViewLink no es una imagen).
 * Requiere sesión y GOOGLE_DRIVE_* configurado.
 */
export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    verifyAccessToken(authCookie);

    if (process.env.GOOGLE_DRIVE_ENABLED !== 'true') {
      return NextResponse.json({ error: 'Google Drive no está activo' }, { status: 503 });
    }

    const fileId = req.nextUrl.searchParams.get('fileId')?.trim();
    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
      return NextResponse.json({ error: 'fileId inválido' }, { status: 400 });
    }

    const accessToken = await getGoogleDriveAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error('Drive alt=media', res.status, text.slice(0, 400));
      return NextResponse.json({ error: 'No se pudo obtener la imagen desde Drive' }, { status: 502 });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar imagen' }, { status: 500 });
  }
}
