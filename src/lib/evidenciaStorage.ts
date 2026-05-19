/**
 * Almacenamiento de imágenes: SharePoint/OneDrive (producción) → Google Drive (opcional) → disco local.
 */

import path from 'path';
import fs from 'fs/promises';
import prisma from './prisma';
import {
  googleDriveErrorMessage,
  resolveGoogleDriveFolderId,
  uploadEvidenciaToGoogleDrive,
} from './googleDriveUpload';
import { uploadEvidenciaToOneDrive } from './onedriveGraphUpload';
import { isSharePointOrOneDriveShareUrl } from './obraCarpetaNube';

const DEFAULT_ONEDRIVE_FOLDER_SHARE_URL =
  'https://1drv.ms/f/c/607528d0aacd0fd0/IgDxIqdQArk9QLHfJYGLaYYlATP9KVwdHtQVHrBzaMojIB4?e=lWh18E';

export type EvidenciaStorageKind = 'onedrive' | 'gdrive' | 'local';

export type EvidenciaUploadResult = {
  url: string;
  previewUrl?: string;
  storage: EvidenciaStorageKind;
  fileId?: string;
};

export function oneDriveConfigured(): boolean {
  return (
    process.env.ONEDRIVE_ENABLED === 'true' &&
    Boolean(process.env.ONEDRIVE_TENANT_ID?.trim()) &&
    Boolean(process.env.ONEDRIVE_CLIENT_ID?.trim()) &&
    Boolean(process.env.ONEDRIVE_CLIENT_SECRET?.trim())
  );
}

export function googleDriveConfigured(): boolean {
  return (
    process.env.GOOGLE_DRIVE_ENABLED === 'true' &&
    Boolean(process.env.GOOGLE_DRIVE_CLIENT_ID?.trim()) &&
    Boolean(process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim()) &&
    Boolean(process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim())
  );
}

/** Enlace de carpeta SharePoint/OneDrive para una obra (campo de obra o .env). */
export function resolveShareUrlForProject(obraUrl: string | null | undefined): string {
  const fromObra = obraUrl?.trim();
  if (fromObra) return fromObra;
  const fromEnv = process.env.ONEDRIVE_FOLDER_SHARE_URL?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_ONEDRIVE_FOLDER_SHARE_URL;
}

async function loadProjectFolderRefs(projectId: string | null) {
  if (!projectId) return null;
  const project = await prisma.project.findFirst({
    where: { id: projectId, isActive: true },
    select: {
      evidenciasOnedriveShareUrl: true,
      evidenciasGoogleDriveFolderId: true,
    },
  });
  if (!project) {
    throw new Error('Obra no encontrada o inactiva');
  }
  const onedriveCol = project.evidenciasOnedriveShareUrl?.trim() || '';
  const gdriveCol = project.evidenciasGoogleDriveFolderId?.trim() || '';
  const shareUrl =
    onedriveCol ||
    (gdriveCol && isSharePointOrOneDriveShareUrl(gdriveCol) ? gdriveCol : null) ||
    null;
  const googleFolderRaw =
    gdriveCol && !isSharePointOrOneDriveShareUrl(gdriveCol) ? gdriveCol : null;
  return {
    onedriveShareUrl: shareUrl,
    googleFolderRaw,
  };
}

export async function uploadEvidenciaBuffer(
  projectId: string | null,
  fileName: string,
  buffer: Buffer,
  contentType: string,
  localSubdir: 'evidencias' | 'obras-logos' = 'evidencias',
  options?: { driveUrlMode?: 'direct' | 'proxy' },
): Promise<EvidenciaUploadResult> {
  const driveUrlMode = options?.driveUrlMode ?? 'direct';

  const refs = projectId ? await loadProjectFolderRefs(projectId) : null;
  const obraShare = refs?.onedriveShareUrl ?? null;

  if (obraShare && isSharePointOrOneDriveShareUrl(obraShare) && !oneDriveConfigured()) {
    throw new Error(
      'Esta obra usa carpeta SharePoint/OneDrive, pero el servidor no tiene OneDrive configurado (ONEDRIVE_ENABLED y credenciales Azure). Pida a soporte el Tenant ID, Client ID y secreto de aplicación.',
    );
  }

  if (oneDriveConfigured()) {
    const shareUrl = resolveShareUrlForProject(obraShare);
    const tenantId = process.env.ONEDRIVE_TENANT_ID!.trim();
    const clientId = process.env.ONEDRIVE_CLIENT_ID!.trim();
    const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET!.trim();
    const { webUrl } = await uploadEvidenciaToOneDrive(
      shareUrl,
      tenantId,
      clientId,
      clientSecret,
      fileName,
      buffer,
      contentType,
    );
    return { url: webUrl, storage: 'onedrive' };
  }

  if (googleDriveConfigured()) {
    const projectFolderRaw = refs?.googleFolderRaw ?? null;
    const folderId = resolveGoogleDriveFolderId(
      projectFolderRaw,
      process.env.GOOGLE_DRIVE_FOLDER_ID,
    );
    if (!folderId) {
      throw new Error(
        'Configura la carpeta: en la obra (enlace SharePoint/OneDrive o ID Google Drive) o variables en el servidor.',
      );
    }
    try {
      const uploaded = await uploadEvidenciaToGoogleDrive(folderId, fileName, buffer, contentType);
      const url =
        driveUrlMode === 'proxy'
          ? `/api/uploads/drive-image?fileId=${encodeURIComponent(uploaded.fileId)}`
          : uploaded.webUrl;
      return {
        url,
        previewUrl: uploaded.thumbnailUrl,
        storage: 'gdrive',
        fileId: uploaded.fileId,
      };
    } catch (error) {
      throw new Error(`No se pudo subir a Google Drive. ${googleDriveErrorMessage(error)}`);
    }
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads', localSubdir);
  await fs.mkdir(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, fileName);
  await fs.writeFile(filePath, buffer);
  return { url: `/uploads/${localSubdir}/${fileName}`, storage: 'local' };
}
