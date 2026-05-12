type GoogleTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

function parseGoogleFolderId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Accept direct folder ID.
  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) return raw;

  // Accept common Google Drive folder URL formats.
  const folderPathMatch = raw.match(/\/folders\/([a-zA-Z0-9_-]{20,})/);
  if (folderPathMatch?.[1]) return folderPathMatch[1];

  const idParamMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (idParamMatch?.[1]) return idParamMatch[1];

  return null;
}

export function resolveGoogleDriveFolderId(
  projectFolderValue: string | null | undefined,
  envDefaultFolderValue: string | null | undefined,
): string | null {
  const fromProject = projectFolderValue ? parseGoogleFolderId(projectFolderValue) : null;
  if (fromProject) return fromProject;

  const fromEnv = envDefaultFolderValue ? parseGoogleFolderId(envDefaultFolderValue) : null;
  if (fromEnv) return fromEnv;

  return null;
}

export function googleDriveErrorMessage(error: unknown): string {
  const message = String((error as { message?: unknown })?.message ?? '');
  if (!message) return 'Error desconocido de Google Drive.';
  if (message.includes('unauthorized_client')) {
    return 'Google rechazó el cliente OAuth. Verifica que GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET y GOOGLE_DRIVE_REFRESH_TOKEN pertenezcan al mismo OAuth Client, y reinicia el contenedor para cargar el .env actualizado.';
  }
  if (message.includes('invalid_grant')) {
    return 'Google Drive rechazó el refresh token. Regenera GOOGLE_DRIVE_REFRESH_TOKEN.';
  }
  if (message.includes('insufficient') || message.includes('insufficientPermissions')) {
    return 'La cuenta autorizada de Google Drive no tiene permisos suficientes para subir archivos.';
  }
  if (message.includes('File not found') || message.includes('notFound')) {
    return 'Google Drive no encontró la carpeta o la cuenta autorizada no tiene acceso a ella. Verifica el ID y comparte la carpeta con esa cuenta.';
  }
  if (message.includes('cannotDownloadFile') || message.includes('forbidden') || message.includes('"code": 403')) {
    return 'Google Drive denegó el acceso a la carpeta. Comparte la carpeta con permiso de editor para la cuenta autorizada.';
  }
  return message.slice(0, 700);
}

/** Token OAuth para llamadas a la API de Drive (subida, lectura de archivos). */
export async function getGoogleDriveAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN?.trim();

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google Drive no está configurado correctamente');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudo obtener token de Google Drive: ${text}`);
  }

  const data = (await res.json()) as GoogleTokenResponse;
  if (!data?.access_token) {
    throw new Error('Respuesta inválida al solicitar token de Google Drive');
  }

  return data.access_token;
}

export async function uploadEvidenciaToGoogleDrive(
  folderId: string,
  fileName: string,
  buffer: Buffer,
  contentType: string,
): Promise<{ fileId: string; webUrl: string; thumbnailUrl?: string }> {
  const accessToken = await getGoogleDriveAccessToken();
  const boundary = `----sigocc-gdrive-${Date.now()}`;

  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const preamble =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;

  const multipartBody = Buffer.concat([
    Buffer.from(preamble, 'utf-8'),
    buffer,
    Buffer.from(closing, 'utf-8'),
  ]);

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink,thumbnailLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    },
  );

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Error al subir archivo a Google Drive: ${text}`);
  }

  const uploadData = (await uploadRes.json()) as {
    id?: string;
    webViewLink?: string;
    thumbnailLink?: string;
  };
  if (!uploadData?.id) {
    throw new Error('Google Drive no devolvió el id del archivo');
  }

  const webUrl = uploadData.webViewLink ?? `https://drive.google.com/file/d/${uploadData.id}/view`;
  const thumbnailUrl = uploadData.thumbnailLink?.trim() || undefined;
  return { fileId: uploadData.id, webUrl, thumbnailUrl };
}
