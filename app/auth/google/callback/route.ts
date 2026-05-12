import { NextRequest, NextResponse } from 'next/server';

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

function googleRedirectUri(req: NextRequest): string {
  const configured = process.env.GOOGLE_DRIVE_REDIRECT_URI?.trim();
  if (configured) return configured;
  return new URL('/auth/google/callback', req.url).toString();
}

function htmlPage(title: string, body: string, status = 200): NextResponse {
  return new NextResponse(
    `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f8fafc; color: #111827; }
    main { max-width: 760px; margin: 6vh auto; padding: 24px; background: white; border: 1px solid #e5e7eb; border-radius: 16px; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08); }
    h1 { margin-top: 0; font-size: 1.4rem; }
    p { line-height: 1.55; color: #374151; }
    textarea { width: 100%; min-height: 110px; padding: 12px; border-radius: 10px; border: 1px solid #d1d5db; font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
    .warning { color: #92400e; background: #fffbeb; border: 1px solid #fde68a; padding: 10px 12px; border-radius: 10px; }
  </style>
</head>
<body><main>${body}</main></body>
</html>`,
    {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  );
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const error = url.searchParams.get('error');
  if (error) {
    return htmlPage(
      'Google OAuth cancelado',
      `<h1>Google no autorizó la conexión</h1><p>${error}</p>`,
      400,
    );
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return htmlPage(
      'Código faltante',
      '<h1>Falta el código de Google</h1><p>Inicia el flujo desde <code>/auth/google/start</code>.</p>',
      400,
    );
  }

  const expectedState = req.cookies.get('google_oauth_state')?.value;
  const receivedState = url.searchParams.get('state');
  if (expectedState && expectedState !== receivedState) {
    return htmlPage(
      'Estado inválido',
      '<h1>Validación OAuth fallida</h1><p>El estado de seguridad no coincide. Vuelve a iniciar desde <code>/auth/google/start</code>.</p>',
      400,
    );
  }

  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return htmlPage(
      'Configuración incompleta',
      '<h1>Faltan credenciales</h1><p>Configura <code>GOOGLE_DRIVE_CLIENT_ID</code> y <code>GOOGLE_DRIVE_CLIENT_SECRET</code>.</p>',
      500,
    );
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: googleRedirectUri(req),
    }).toString(),
  });
  const token = (await tokenRes.json()) as GoogleTokenResponse;

  if (!tokenRes.ok) {
    return htmlPage(
      'Error al generar token',
      `<h1>No se pudo generar el token</h1><p>${token.error_description || token.error || 'Error desconocido de Google.'}</p><p>Verifica que el redirect URI registrado en Google sea exactamente <code>${googleRedirectUri(req)}</code>.</p>`,
      502,
    );
  }

  const response = htmlPage(
    'Token Google Drive generado',
    token.refresh_token
      ? `<h1>Refresh token generado</h1>
<p>Copia este valor en la variable <code>GOOGLE_DRIVE_REFRESH_TOKEN</code> del servidor y reinicia/redespliega la app.</p>
<textarea readonly>${token.refresh_token}</textarea>
<p class="warning">Guarda este valor como secreto. No lo compartas por chat ni lo subas al repositorio.</p>
<p>Scope autorizado: <code>${token.scope || 'drive.file'}</code></p>`
      : `<h1>Google no devolvió refresh token</h1>
<p>Vuelve a iniciar desde <code>/auth/google/start</code>. Si ya habías autorizado antes, revoca el acceso de la app en tu cuenta Google y prueba de nuevo.</p>`,
  );
  response.cookies.set('google_oauth_state', '', {
    path: '/auth/google',
    maxAge: 0,
  });
  return response;
}
