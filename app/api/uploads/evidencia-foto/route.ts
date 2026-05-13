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

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

/** Carpeta destino por defecto (puede sobrescribirse con ONEDRIVE_FOLDER_SHARE_URL). */
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

/** URL efectiva: primero la de la obra, luego .env, luego constante por defecto. */
function resolveShareUrlForProject(obraUrl: string | null | undefined): string {
  const fromObra = obraUrl?.trim();
  if (fromObra) return fromObra;
  const fromEnv = process.env.ONEDRIVE_FOLDER_SHARE_URL?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_ONEDRIVE_FOLDER_SHARE_URL;
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

    if (googleDriveConfigured()) {
      let projectFolderRaw: string | null = null;
      if (projectId) {
        const project = await prisma.project.findFirst({
          where: { id: projectId, isActive: true },
          select: {
            evidenciasGoogleDriveFolderId: true,
            evidenciasOnedriveShareUrl: true,
          },
        });
        if (!project) {
          return NextResponse.json(
            { error: 'Obra no encontrada o inactiva' },
            { status: 400 },
          );
        }
        projectFolderRaw =
          project.evidenciasGoogleDriveFolderId?.trim() ||
          project.evidenciasOnedriveShareUrl?.trim() ||
          null;
      }

      const folderId = resolveGoogleDriveFolderId(
        projectFolderRaw,
        process.env.GOOGLE_DRIVE_FOLDER_ID,
      );
      if (!folderId) {
        return NextResponse.json(
          {
            error:
              'Configura la carpeta de Google Drive: en la obra (ID o URL) o GOOGLE_DRIVE_FOLDER_ID en el servidor.',
          },
          { status: 400 },
        );
      }

      const contentType = mime || 'application/octet-stream';
      let uploaded: Awaited<ReturnType<typeof uploadEvidenciaToGoogleDrive>>;
      try {
        uploaded = await uploadEvidenciaToGoogleDrive(
          folderId,
          fileName,
          buffer,
          contentType,
        );
      } catch (error) {
        const detail = googleDriveErrorMessage(error);
        console.error('Google Drive upload failed:', detail);
        return NextResponse.json(
          { error: `No se pudo subir a Google Drive. ${detail}` },
          { status: 502 },
        );
      }
      const { webUrl, thumbnailUrl } = uploaded;
      return NextResponse.json(
        {
          url: webUrl,
          previewUrl: thumbnailUrl,
          storage: 'gdrive' as const,
        },
        { status: 200 },
      );
    }

    if (oneDriveConfigured()) {
      let obraShare: string | null = null;
      if (projectId) {
        const project = await prisma.project.findFirst({
          where: { id: projectId, isActive: true },
          select: { evidenciasOnedriveShareUrl: true },
        });
        if (!project) {
          return NextResponse.json(
            { error: 'Obra no encontrada o inactiva' },
            { status: 400 },
          );
        }
        obraShare = project.evidenciasOnedriveShareUrl ?? null;
      }
      const shareUrl = resolveShareUrlForProject(obraShare);
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

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'evidencias');
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.join(uploadsDir, fileName);
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({ url: `/uploads/evidencias/${fileName}`, storage: 'local' as const }, { status: 200 });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 });
  }
}

