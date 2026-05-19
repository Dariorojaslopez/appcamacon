import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import { uploadEvidenciaBuffer } from '../../../../src/lib/evidenciaStorage';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

/** Logo por obra: solo super administrador. */
export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const projectIdRaw = formData.get('projectId');
    const projectId =
      typeof projectIdRaw === 'string' && projectIdRaw.trim() ? projectIdRaw.trim() : null;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId es requerido' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Obra no encontrada' }, { status: 404 });
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    const blob = file as File;
    if (blob.size === 0) {
      return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
    }
    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: 'El logo no debe superar 4MB' }, { status: 400 });
    }

    const mime = blob.type || '';
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
    if (mime && !allowed.includes(mime)) {
      return NextResponse.json({ error: 'Solo imágenes JPG, PNG, WEBP o GIF' }, { status: 400 });
    }

    const safeName = (blob.name || 'logo')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80);

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileName = `logo_${projectId.slice(0, 8)}_${Date.now()}_${safeName}`;
    const contentType = mime || 'application/octet-stream';

    const uploaded = await uploadEvidenciaBuffer(projectId, fileName, buffer, contentType, 'obras-logos', {
      driveUrlMode: 'proxy',
    });
    return NextResponse.json(
      {
        url: uploaded.url,
        webUrl: uploaded.storage === 'onedrive' ? uploaded.url : undefined,
        previewUrl: uploaded.previewUrl,
        storage: uploaded.storage,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    const msg = err?.message?.trim();
    if (msg?.includes('Configura la carpeta') || msg?.includes('Google Drive') || msg?.includes('Graph')) {
      return NextResponse.json({ error: msg ?? 'Error al subir logo' }, { status: 502 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al subir logo' }, { status: 500 });
  }
}
