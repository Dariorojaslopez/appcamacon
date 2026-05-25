import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import {
  isAllowedInlineImageUrl,
  localUploadPathFromUrl,
} from '../../../../src/lib/firmaImageSrc';

/** Sirve imágenes guardadas (local o URL remota) para vista previa / pad de firma sin CORS. */
export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const raw = req.nextUrl.searchParams.get('url')?.trim() ?? '';
    if (!raw) return NextResponse.json({ error: 'url requerida' }, { status: 400 });

    const localRel = localUploadPathFromUrl(raw);
    if (localRel) {
      const filePath = path.join(process.cwd(), 'public', localRel);
      const buffer = await fs.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const type =
        ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return new NextResponse(buffer, {
        status: 200,
        headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=300' },
      });
    }

    if (!/^https?:\/\//i.test(raw) || !isAllowedInlineImageUrl(raw)) {
      return NextResponse.json({ error: 'URL no permitida' }, { status: 400 });
    }

    const remote = await fetch(raw, { redirect: 'follow' });
    if (!remote.ok) {
      return NextResponse.json({ error: 'No se pudo obtener la imagen' }, { status: 502 });
    }
    const contentType = remote.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await remote.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=300' },
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error('GET /api/uploads/inline-image', error);
    return NextResponse.json({ error: 'Error al cargar imagen' }, { status: 500 });
  }
}
