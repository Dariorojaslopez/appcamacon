/**
 * Subida de archivos a una carpeta de OneDrive / SharePoint usando Microsoft Graph.
 * Requiere una aplicación en Azure AD con permisos de aplicación (p. ej. Files.ReadWrite.All)
 * y consentimiento del administrador en el inquilino de Microsoft 365.
 *
 * OneDrive personal (cuenta @outlook.com) a menudo no admite solo flujo de credenciales de cliente;
 * en ese caso use una cuenta de organización o configure permisos delegados.
 */

const GRAPH = 'https://graph.microsoft.com/v1.0';
const LOGIN = 'https://login.microsoftonline.com';

function encodeSharingUrlForGraph(shareUrl: string): string {
  const u = shareUrl.trim();
  const base64 = Buffer.from(u, 'utf8')
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\//g, '_')
    .replace(/\+/g, '-');
  return `u!${base64}`;
}

export async function getGraphAppOnlyToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const url = `${LOGIN}/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token Microsoft Graph (${res.status}): ${t.slice(0, 800)}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

type DriveFolderRef = { driveId: string; itemId: string };

export async function resolveFolderFromShareLink(
  shareUrl: string,
  accessToken: string,
): Promise<DriveFolderRef> {
  const shareId = encodeSharingUrlForGraph(shareUrl);
  const res = await fetch(`${GRAPH}/shares/${encodeURIComponent(shareId)}/driveItem`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`shares/driveItem (${res.status}): ${t.slice(0, 800)}`);
  }
  const item = (await res.json()) as {
    id: string;
    parentReference?: { driveId?: string };
  };
  const driveId = item.parentReference?.driveId;
  if (!driveId || !item.id) {
    throw new Error('Respuesta Graph sin driveId o id de carpeta');
  }
  return { driveId, itemId: item.id };
}

export async function uploadBytesToOneDriveFolder(
  driveId: string,
  folderItemId: string,
  fileName: string,
  buffer: Buffer,
  contentType: string,
  accessToken: string,
): Promise<{ webUrl: string }> {
  const enc = encodeURIComponent(fileName);
  const url = `${GRAPH}/drives/${driveId}/items/${folderItemId}:/${enc}:/content`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body: new Uint8Array(buffer),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upload OneDrive (${res.status}): ${t.slice(0, 800)}`);
  }
  const data = (await res.json()) as { webUrl?: string };
  if (!data.webUrl) {
    throw new Error('Graph no devolvió webUrl de la carpeta');
  }
  return { webUrl: data.webUrl };
}

/** Cache por enlace de carpeta (cada obra puede tener su propia URL). */
const folderCacheByShareUrl = new Map<string, DriveFolderRef>();

export function clearOneDriveFolderCache() {
  folderCacheByShareUrl.clear();
}

export async function uploadEvidenciaToOneDrive(
  shareUrl: string,
  tenantId: string,
  clientId: string,
  clientSecret: string,
  fileName: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ webUrl: string }> {
  const token = await getGraphAppOnlyToken(tenantId, clientId, clientSecret);
  const key = shareUrl.trim();
  let folder = folderCacheByShareUrl.get(key);
  if (!folder) {
    folder = await resolveFolderFromShareLink(shareUrl, token);
    folderCacheByShareUrl.set(key, folder);
  }
  return uploadBytesToOneDriveFolder(
    folder.driveId,
    folder.itemId,
    fileName,
    buffer,
    contentType,
    token,
  );
}
