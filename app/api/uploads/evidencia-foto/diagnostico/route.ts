import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../../src/lib/prisma';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import { oneDriveConfigured } from '../../../../../src/lib/evidenciaStorage';
import {
  getGraphAppOnlyToken,
  resolveFolderFromShareLink,
} from '../../../../../src/lib/onedriveGraphUpload';
import { isSharePointOrOneDriveShareUrl } from '../../../../../src/lib/obraCarpetaNube';

/**
 * Diagnóstico de OneDrive/SharePoint (solo usuarios autenticados).
 * GET /api/uploads/evidencia-foto/diagnostico?projectId=...
 */
export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim() || null;

    const env = {
      ONEDRIVE_ENABLED: process.env.ONEDRIVE_ENABLED === 'true',
      ONEDRIVE_TENANT_ID: Boolean(process.env.ONEDRIVE_TENANT_ID?.trim()),
      ONEDRIVE_CLIENT_ID: Boolean(process.env.ONEDRIVE_CLIENT_ID?.trim()),
      ONEDRIVE_CLIENT_SECRET: Boolean(process.env.ONEDRIVE_CLIENT_SECRET?.trim()),
      ONEDRIVE_FOLDER_SHARE_URL: Boolean(process.env.ONEDRIVE_FOLDER_SHARE_URL?.trim()),
    };

    const configured = oneDriveConfigured();
    const steps: Array<{ step: string; ok: boolean; message: string }> = [];

    steps.push({
      step: 'variables_env',
      ok: configured,
      message: configured
        ? 'Variables ONEDRIVE_* presentes en el servidor.'
        : 'Faltan variables: active ONEDRIVE_ENABLED=true y Tenant ID, Client ID y Client Secret.',
    });

    let tokenOk = false;
    let tokenError: string | null = null;
    if (configured) {
      try {
        await getGraphAppOnlyToken(
          process.env.ONEDRIVE_TENANT_ID!.trim(),
          process.env.ONEDRIVE_CLIENT_ID!.trim(),
          process.env.ONEDRIVE_CLIENT_SECRET!.trim(),
        );
        tokenOk = true;
        steps.push({
          step: 'token_azure',
          ok: true,
          message: 'Microsoft aceptó las credenciales (token obtenido).',
        });
      } catch (e) {
        tokenError = e instanceof Error ? e.message : String(e);
        steps.push({
          step: 'token_azure',
          ok: false,
          message: `Azure rechazó las credenciales: ${tokenError.slice(0, 300)}`,
        });
      }
    }

    let obraShareUrl: string | null = null;
    if (projectId) {
      const project = await prisma.project.findFirst({
        where: { id: projectId, isActive: true },
        select: { evidenciasOnedriveShareUrl: true, evidenciasGoogleDriveFolderId: true, name: true },
      });
      if (!project) {
        steps.push({ step: 'obra', ok: false, message: 'Obra no encontrada o inactiva.' });
      } else {
        const onedriveCol = project.evidenciasOnedriveShareUrl?.trim() || '';
        const gdriveCol = project.evidenciasGoogleDriveFolderId?.trim() || '';
        obraShareUrl =
          onedriveCol ||
          (gdriveCol && isSharePointOrOneDriveShareUrl(gdriveCol) ? gdriveCol : null) ||
          null;
        steps.push({
          step: 'obra_carpeta',
          ok: Boolean(obraShareUrl),
          message: obraShareUrl
            ? `Obra "${project.name}" tiene enlace de carpeta configurado.`
            : `Obra "${project.name}" no tiene enlace SharePoint/OneDrive (usará carpeta por defecto del .env).`,
        });
      }
    }

    const shareToTest =
      obraShareUrl ||
      process.env.ONEDRIVE_FOLDER_SHARE_URL?.trim() ||
      null;

    if (configured && tokenOk && shareToTest) {
      try {
        const token = await getGraphAppOnlyToken(
          process.env.ONEDRIVE_TENANT_ID!.trim(),
          process.env.ONEDRIVE_CLIENT_ID!.trim(),
          process.env.ONEDRIVE_CLIENT_SECRET!.trim(),
        );
        await resolveFolderFromShareLink(shareToTest, token);
        steps.push({
          step: 'carpeta_sharepoint',
          ok: true,
          message: 'Se pudo leer la carpeta compartida desde Microsoft Graph.',
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        steps.push({
          step: 'carpeta_sharepoint',
          ok: false,
          message: `No se pudo abrir la carpeta: ${msg.slice(0, 400)}`,
        });
      }
    }

    const allOk = steps.every((s) => s.ok);

    return NextResponse.json({
      ok: allOk,
      resumen: allOk
        ? 'OneDrive/SharePoint listo para subir fotos.'
        : 'Hay problemas de configuración. Revise cada paso.',
      env,
      steps,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error de diagnóstico';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
