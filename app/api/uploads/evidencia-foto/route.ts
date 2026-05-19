import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import { uploadEvidenciaBuffer, oneDriveConfigured } from '../../../../src/lib/evidenciaStorage';
import { logUploadFailure } from '../../../../src/lib/uploadErrorLog';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

type UploadFailContext = {
  projectId?: string | null;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
};

function uploadHint(raw: string): string | undefined {
  if (/Token Microsoft Graph|invalid_client|unauthorized_client/i.test(raw)) {
    return 'Revise ONEDRIVE_TENANT_ID, ONEDRIVE_CLIENT_ID y ONEDRIVE_CLIENT_SECRET en el .env del servidor.';
  }
  if (/shares\/driveItem/i.test(raw) && /403|404/.test(raw)) {
    return 'Revise el enlace de carpeta en la obra y permisos Graph (Files.ReadWrite.All, Sites.ReadWrite.All, admin consent).';
  }
  if (/Upload OneDrive \(403\)/i.test(raw)) {
    return 'Microsoft rechazó la subida: falta consentimiento de administrador o permisos sobre la carpeta.';
  }
  return undefined;
}

function uploadErrorResponse(error: unknown, ctx: UploadFailContext = {}): NextResponse {
  const message = logUploadFailure('evidencia-foto', ctx, error);

  const isAuth =
    error instanceof Error &&
    (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError');
  if (isAuth) {
    return NextResponse.json({ error: 'Sesión expirada', code: 'auth' }, { status: 401 });
  }

  const isClient =
    /Obra no encontrada|Archivo|vacío|excede|Solo JPG/i.test(message) ||
    /Configura la carpeta/i.test(message);
  if (isClient) {
    return NextResponse.json({ error: message, code: 'upload_validation' }, { status: 400 });
  }

  const isStorage =
    /SharePoint|OneDrive|Graph|Google Drive|Microsoft|Token Microsoft|credenciales Azure|shares\/driveItem|Upload OneDrive/i.test(
      message,
    );
  const hint = uploadHint(message);

  if (isStorage) {
    return NextResponse.json(
      {
        error: message,
        code: 'storage_error',
        hint,
        onedriveConfigured: oneDriveConfigured(),
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      error: message,
      code: 'upload_failed',
      hint,
    },
    { status: 500 },
  );
}

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
    ctx.contentType = blob.type || undefined;

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
    ctx.fileName = fileName;

    console.info(
      '[evidencia-foto] inicio',
      JSON.stringify({
        projectId: ctx.projectId,
        fileName,
        bytes: buffer.length,
        onedrive: oneDriveConfigured(),
      }),
    );

    const uploaded = await uploadEvidenciaBuffer(
      ctx.projectId ?? null,
      fileName,
      buffer,
      mime || 'application/octet-stream',
      'evidencias',
      { driveUrlMode: 'direct' },
    );

    console.info(
      '[evidencia-foto] ok',
      JSON.stringify({ projectId: ctx.projectId, storage: uploaded.storage, url: uploaded.url?.slice(0, 120) }),
    );

    return NextResponse.json(
      {
        url: uploaded.url,
        previewUrl: uploaded.previewUrl,
        storage: uploaded.storage,
        warning: uploaded.warning,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return uploadErrorResponse(error, ctx);
  }
}
