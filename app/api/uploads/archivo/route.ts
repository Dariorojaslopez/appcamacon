import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import {
  isAllowedRegistroArchivoUrl,
  registroDocEsImagen,
} from '../../../../src/lib/registroArchivoUrl';
import { fetchArchivoBuffer } from '../../../../src/lib/servirArchivoRemoto';

function safeFileName(name: string): string {
  return name.replace(/[^\w.\-()áéíóúñÁÉÍÓÚÑ ]/g, '_').slice(0, 180) || 'archivo';
}

/** Sirve documentos de bitácora (local o nube) sin redirigir a OneDrive/Drive. */
export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const storedUrl = req.nextUrl.searchParams.get('url')?.trim() ?? '';
    const fileName = req.nextUrl.searchParams.get('name')?.trim() ?? '';
    const dispositionParam = req.nextUrl.searchParams.get('disposition')?.trim().toLowerCase();

    if (!storedUrl) {
      return NextResponse.json({ error: 'url requerida' }, { status: 400 });
    }
    if (!isAllowedRegistroArchivoUrl(storedUrl)) {
      return NextResponse.json({ error: 'URL no permitida' }, { status: 400 });
    }

    const fetched = await fetchArchivoBuffer(storedUrl);
    if (!fetched) {
      return NextResponse.json(
        { error: 'No se pudo obtener el archivo. Si está en OneDrive, verifique la configuración del servidor.' },
        { status: 502 },
      );
    }

    const mime = fetched.mime || 'application/octet-stream';
    const downloadName = safeFileName(fileName || 'documento');
    const inline =
      dispositionParam === 'inline' ||
      (dispositionParam !== 'attachment' &&
        (mime === 'application/pdf' || registroDocEsImagen(storedUrl, mime)));
    const disposition = `${inline ? 'inline' : 'attachment'}; filename="${downloadName}"`;

    return new NextResponse(fetched.buffer, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': disposition,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error('GET /api/uploads/archivo', error);
    return NextResponse.json({ error: 'Error al cargar el archivo' }, { status: 500 });
  }
}
