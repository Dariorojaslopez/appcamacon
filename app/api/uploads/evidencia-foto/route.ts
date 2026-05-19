import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import { uploadEvidenciaBuffer } from '../../../../src/lib/evidenciaStorage';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const formData = await req.formData();
    const file = formData.get('file');
    const projectIdRaw = formData.get('projectId');
    const projectId =
      typeof projectIdRaw === 'string' && projectIdRaw.trim() ? projectIdRaw.trim() : null;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    const blob = file as File;
    if (blob.size === 0) {
      return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
    }
    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: 'El archivo excede 10MB' }, { status: 400 });
    }

    const mime = blob.type || '';
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    if (mime && !allowed.includes(mime)) {
      return NextResponse.json({ error: 'Solo JPG/JPEG/PNG' }, { status: 400 });
    }

    const safeName = (blob.name || 'foto')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `${Date.now()}_${safeName}`;
    const contentType = mime || 'application/octet-stream';

    const uploaded = await uploadEvidenciaBuffer(projectId, fileName, buffer, contentType, 'evidencias', {
      driveUrlMode: 'direct',
    });
    return NextResponse.json(
      {
        url: uploaded.url,
        previewUrl: uploaded.previewUrl,
        storage: uploaded.storage,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    const msg = err?.message?.trim();
    if (msg?.includes('Obra no encontrada') || msg?.includes('Configura la carpeta')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg?.includes('Google Drive') || msg?.includes('OneDrive') || msg?.includes('Graph')) {
      console.error('Upload evidencia:', msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 });
  }
}
