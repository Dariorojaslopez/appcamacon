import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import { uploadEvidenciaBuffer, oneDriveConfigured } from '../../../../src/lib/evidenciaStorage';
import { logUploadFailure } from '../../../../src/lib/uploadErrorLog';

const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);

const ALLOWED_EXT = /\.(jpe?g|png|gif|webp|pdf|doc|docx|xls|xlsx)$/i;

function mimeFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.doc')) return 'application/msword';
  if (n.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (n.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (n.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.gif')) return 'image/gif';
  if (n.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function isAllowedUpload(mime: string, fileName: string): boolean {
  const m = mime.trim().toLowerCase();
  if (m && ALLOWED_MIME.has(m)) return true;
  return ALLOWED_EXT.test(fileName);
}

type UploadFailContext = {
  projectId?: string | null;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
};

function uploadErrorResponse(error: unknown, ctx: UploadFailContext = {}): NextResponse {
  const message = logUploadFailure('registro-documento', ctx, error);
  const isAuth =
    error instanceof Error &&
    (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError');
  if (isAuth) {
    return NextResponse.json({ error: 'Sesión expirada', code: 'auth' }, { status: 401 });
  }
  const isClient =
    /Archivo|vacío|excede|no permitido|Solo/i.test(message) || /Configura la carpeta/i.test(message);
  if (isClient) {
    return NextResponse.json({ error: message, code: 'upload_validation' }, { status: 400 });
  }
  return NextResponse.json({ error: message, code: 'upload_failed' }, { status: 500 });
}

/** Subida de documentos para firma / registro de bitácora (imágenes, PDF, Word, Excel). */
export async function POST(req: NextRequest) {
  const ctx: UploadFailContext = {};
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const formData = await req.formData();
    const file = formData.get('file');
    const projectIdRaw = formData.get('projectId');
    ctx.projectId =
      typeof projectIdRaw === 'string' && projectIdRaw.trim() ? projectIdRaw.trim() : null;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    const blob = file as File;
    ctx.fileSize = blob.size;
    const mime = (blob.type || mimeFromName(blob.name || '')).trim();
    ctx.contentType = mime;

    if (blob.size === 0) {
      return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
    }
    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: 'El archivo excede 10 MB' }, { status: 400 });
    }
    if (!isAllowedUpload(mime, blob.name || '')) {
      return NextResponse.json(
        {
          error:
            'Tipo de archivo no permitido. Use imagen (JPG, PNG), PDF, Word (.doc, .docx) o Excel (.xls, .xlsx).',
        },
        { status: 400 },
      );
    }

    const safeName = (blob.name || 'documento')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
    const buffer = Buffer.from(await blob.arrayBuffer());
    const fileName = `${Date.now()}_${safeName}`;
    ctx.fileName = fileName;

    const uploaded = await uploadEvidenciaBuffer(
      ctx.projectId ?? null,
      fileName,
      buffer,
      mime || 'application/octet-stream',
      'evidencias',
      { driveUrlMode: 'direct' },
    );

    return NextResponse.json({
      url: uploaded.url,
      previewUrl: uploaded.previewUrl,
      storage: uploaded.storage,
      contentType: mime,
      name: blob.name || safeName,
      warning: uploaded.warning,
      onedriveConfigured: oneDriveConfigured(),
    });
  } catch (error: unknown) {
    return uploadErrorResponse(error, ctx);
  }
}
