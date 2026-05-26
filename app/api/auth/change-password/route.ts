import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';

const MIN_PASSWORD_LEN = 8;

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    let payload;
    try {
      payload = verifyAccessToken(authCookie);
    } catch {
      return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
    }

    const body = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    const newPassword = String(body.newPassword ?? '').trim();
    const confirmPassword = String(body.confirmPassword ?? newPassword).trim();
    const currentPassword = String(body.currentPassword ?? '').trim();

    if (newPassword.length < MIN_PASSWORD_LEN) {
      return NextResponse.json(
        { error: `La nueva contraseña debe tener al menos ${MIN_PASSWORD_LEN} caracteres.` },
        { status: 400 },
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'La confirmación no coincide con la nueva contraseña.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, password: true, mustChangePassword: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!user.mustChangePassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Indique su contraseña actual.' }, { status: 400 });
      }
      const currentOk = await bcrypt.compare(currentPassword, user.password);
      if (!currentOk) {
        return NextResponse.json({ error: 'La contraseña actual no es correcta.' }, { status: 400 });
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(newPassword, 10),
        mustChangePassword: false,
      },
    });

    return NextResponse.json({
      ok: true,
      message: 'Contraseña actualizada correctamente.',
    });
  } catch (e) {
    console.error('[change-password]', e);
    return NextResponse.json({ error: 'Error al actualizar la contraseña' }, { status: 500 });
  }
}
