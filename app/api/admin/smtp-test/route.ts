import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import { getSmtpDiagnostic, isEmailConfigured, sendPlainTextEmail, verifySmtpConnection } from '../../../../src/infrastructure/email/mailer';

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const diagnostic = getSmtpDiagnostic();
    return NextResponse.json({ diagnostic });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al diagnosticar SMTP' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'SMTP no configurado en el servidor (.env).' },
        { status: 503 },
      );
    }

    const body = (await req.json()) as { testEmail?: string };
    const testEmail = String(body.testEmail ?? payload.email ?? '').trim();
    if (!testEmail) {
      return NextResponse.json({ error: 'Indique testEmail en el cuerpo' }, { status: 400 });
    }

    await verifySmtpConnection();
    await sendPlainTextEmail({
      to: testEmail,
      subject: 'SIGOCC Camacon - Prueba SMTP',
      text: 'Correo de prueba desde el panel de administración. Si lo recibe, Gmail SMTP está correcto.',
    });

    return NextResponse.json({
      ok: true,
      message: `Correo de prueba enviado a ${testEmail}. Revise bandeja y spam.`,
      diagnostic: getSmtpDiagnostic(),
    });
  } catch (error: unknown) {
    const err = error as { name?: string; message?: string; code?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error('[smtp-test]', error);
    const hint =
      err.code === 'EAUTH' || String(err.message ?? '').includes('535')
        ? 'Google rechazó usuario/contraseña. Use contraseña de aplicación (16 caracteres) con verificación en 2 pasos.'
        : 'Revise SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS y MAIL_FROM en el servidor.';
    return NextResponse.json(
      {
        ok: false,
        error: 'No se pudo conectar o enviar por SMTP.',
        hint,
        diagnostic: getSmtpDiagnostic(),
      },
      { status: 503 },
    );
  }
}
