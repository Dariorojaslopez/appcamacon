import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import {
  googleDriveErrorMessage,
  resolveGoogleDriveFolderId,
  uploadEvidenciaToGoogleDrive,
} from '../../../../src/lib/googleDriveUpload';
import { uploadEvidenciaToOneDrive } from '../../../../src/lib/onedriveGraphUpload';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const DEFAULT_ONEDRIVE_FOLDER_SHARE_URL =
  'https://1drv.ms/f/c/607528d0aacd0fd0/IgDxIqdQArk9QLHfJYGLaYYlATP9KVwdHtQVHrBzaMojIB4?e=lWh18E';

function oneDriveConfigured(): boolean {
  return (
    process.env.ONEDRIVE_ENABLED === 'true' &&
    Boolean(process.env.ONEDRIVE_TENANT_ID?.trim()) &&
    Boolean(process.env.ONEDRIVE_CLIENT_ID?.trim()) &&
    Boolean(process.env.ONEDRIVE_CLIENT_SECRET?.trim())
  );
}

function googleDriveConfigured(): boolean {
  return (
    process.env.GOOGLE_DRIVE_ENABLED === 'true' &&
    Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID?.trim()) &&
    Boolean(process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim()) &&
    Boolean(process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim())
  );
}

function resolveShareUrlForProject(obraUrl: string | null | undefined): string {
  const fromObra = obraUrl?.trim();
  if (fromObra) return fromObra;
  const fromEnv = process.env.ONEDRIVE_FOLDER_SHARE_URL?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_ONEDRIVE_FOLDER_SHARE_URL;
}

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
      return NextResponse.json({ error: 'El logo no debe superar 2MB' }, { status: 400 });
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

    if (googleDriveConfigured()) {
      let projectFolderRaw: string | null = null;
      const p = await prisma.project.findFirst({
        where: { id: projectId },
        select: {
          evidenciasGoogleDriveFolderId: true,
          evidenciasOnedriveShareUrl: true,
        },
      });
      if (p) {
        projectFolderRaw =
          p.evidenciasGoogleDriveFolderId?.trim() || p.evidenciasOnedriveShareUrl?.trim() || null;
      }

      const folderId = resolveGoogleDriveFolderId(
        projectFolderRaw,
        process.env.GOOGLE_DRIVE_FOLDER_ID,
      );
      if (!folderId) {
        return NextResponse.json(
          {
            error:
              'Configura carpeta de Google Drive en la obra o GOOGLE_DRIVE_FOLDER_ID en el servidor.',
          },
          { status: 400 },
        );
      }

      const contentType = mime || 'application/octet-stream';
      let uploaded: Awaited<ReturnType<typeof uploadEvidenciaToGoogleDrive>>;
      try {
        uploaded = await uploadEvidenciaToGoogleDrive(folderId, fileName, buffer, contentType);
      } catch (error) {
        const detail = googleDriveErrorMessage(error);
        console.error('obra-logo Google Drive:', detail);
        return NextResponse.json({ error: `No se pudo subir a Google Drive. ${detail}` }, { status: 502 });
      }
      const { fileId, webUrl, thumbnailUrl } = uploaded;
      const url = `/api/uploads/drive-image?fileId=${encodeURIComponent(fileId)}`;
      return NextResponse.json(
        { url, webUrl, previewUrl: thumbnailUrl, storage: 'gdrive' as const },
        { status: 200 },
      );
    }

    if (oneDriveConfigured()) {
      const p = await prisma.project.findFirst({
        where: { id: projectId },
        select: { evidenciasOnedriveShareUrl: true },
      });
      const shareUrl = resolveShareUrlForProject(p?.evidenciasOnedriveShareUrl);
      const tenantId = process.env.ONEDRIVE_TENANT_ID!.trim();
      const clientId = process.env.ONEDRIVE_CLIENT_ID!.trim();
      const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET!.trim();
      const contentType = mime || 'application/octet-stream';

      const { webUrl } = await uploadEvidenciaToOneDrive(
        shareUrl,
        tenantId,
        clientId,
        clientSecret,
        fileName,
        buffer,
        contentType,
      );
      return NextResponse.json({ url: webUrl, storage: 'onedrive' as const }, { status: 200 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'obras-logos');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, fileName);
    await fs.writeFile(filePath, buffer);

    return NextResponse.json(
      { url: `/uploads/obras-logos/${fileName}`, storage: 'local' as const },
      { status: 200 },
    );
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al subir logo' }, { status: 500 });
  }
}
