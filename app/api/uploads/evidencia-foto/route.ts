import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import { uploadEvidenciaBuffer } from '../../../../src/lib/evidenciaStorage';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

function uploadErrorResponse(error: unknown): NextResponse {
  const msg =
    error instanceof Error && error.message?.trim()
      ? error.message.trim()
      : 'Error al subir imagen';

  const isAuth =
    error instanceof Error &&
    (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError');
  if (isAuth) {
    return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
  }

  const isClient =
    /Obra no encontrada|Archivo|vacío|excede|Solo JPG/i.test(msg) ||
    /Configura la carpeta/i.test(msg);
  if (isClient) {
    return NextResponse.json({ error: msg, code: 'upload_validation' }, { status: 400 });
  }

  const isStorage =
    /SharePoint|OneDrive|Graph|Google Drive|Microsoft|Token Microsoft|credenciales Azure|shares\/driveItem|Upload OneDrive/i.test(
      msg,
    );
  if (isStorage) {
    console.error('Upload evidencia-foto (almacenamiento):', msg);
    return NextResponse.json(
      {
        error: humanizeStorageError(msg),
        code: 'storage_error',
        detail: msg.length > 280 ? `${msg.slice(0, 280)}…` : msg,
      },
      { status: 502 },
    );
  }

  console.error('Upload evidencia-foto:', error);
  return NextResponse.json(
    { error: msg, code: 'upload_failed', detail: msg },
    { status: 500 },
  );
}

function humanizeStorageError(raw: string): string {
  if (/Token Microsoft Graph|invalid_client|unauthorized_client/i.test(raw)) {
    return 'Credenciales de Azure incorrectas (Tenant ID, Client ID o secreto). Revise el .env del servidor.';
  }
  if (/shares\/driveItem|403|404/.test(raw) && /SharePoint|driveItem|OneDrive/i.test(raw)) {
    return 'No se pudo acceder a la carpeta de SharePoint/OneDrive. Verifique el enlace en la obra y los permisos de la app en Azure (Files.ReadWrite.All, Sites.ReadWrite.All, consentimiento admin).';
  }
  if (/Upload OneDrive \(403\)/i.test(raw)) {
    return 'Microsoft rechazó la subida (403). La app de Azure necesita permisos y consentimiento de administrador sobre esa carpeta.';
  }
  if (/SharePoint|OneDrive/i.test(raw)) {
    return raw.length <= 220 ? raw : `${raw.slice(0, 220)}…`;
  }
  return raw.length <= 220 ? raw : `${raw.slice(0, 220)}…`;
}

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
        warning: uploaded.warning,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    return uploadErrorResponse(error);
  }
}
