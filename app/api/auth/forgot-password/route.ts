import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '../../../../src/lib/prisma';
import { sendPasswordResetEmail, isEmailConfigured } from '../../../../src/infrastructure/email/mailer';
import { isSuperAdminRole } from '../../../../src/lib/authRoles';

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

/** No exponer detalles de Gmail/SMTP al cliente. */
function publicEmailErrorMessage(): string {
  return 'No se pudo enviar el correo de restablecimiento. El administrador del sistema debe revisar la configuración SMTP (correo de Google con contraseña de aplicación). Su contraseña no fue modificada.';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identification = String(body?.identification ?? '').trim();
    if (!identification) {
      return NextResponse.json({ error: 'Identificación requerida' }, { status: 400 });
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          error:
            'El servicio de correo no está configurado en el servidor. Contacte al administrador del sistema.',
        },
        { status: 503 },
      );
    }

    const user = await prisma.user.findFirst({
      where: { identification },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    });

    if (!user?.email) {
      return NextResponse.json({
        message:
          'Si la identificación está registrada, recibirá un correo con instrucciones para restablecer su contraseña.',
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    const newPasswordHash = await bcrypt.hash(temporaryPassword, 10);

    try {
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        temporaryPassword,
      });
    } catch (mailErr) {
      console.error('[forgot-password] Error SMTP:', mailErr);
      return NextResponse.json({ error: publicEmailErrorMessage() }, { status: 503 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: newPasswordHash,
        ...(isSuperAdminRole(user.role) ? { isActive: true } : {}),
      },
    });

    return NextResponse.json({
      message:
        'Si la identificación está registrada, recibirá un correo con su contraseña temporal. Revise también la carpeta de spam.',
    });
  } catch (e) {
    console.error('[forgot-password]', e);
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
  }
}
