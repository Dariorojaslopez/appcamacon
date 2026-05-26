import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import prisma from '../../../../src/lib/prisma';
import { isSuperAdminRole } from '../../../../src/lib/authRoles';

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Restablecimiento de contraseña de super administrador sin correo.
 * Requiere ADMIN_EMERGENCY_SECRET en el servidor (.env).
 * Quitar o rotar el secret después de usarlo.
 */
export async function POST(request: NextRequest) {
  const configuredSecret = process.env.ADMIN_EMERGENCY_SECRET?.trim();
  if (!configuredSecret) {
    return NextResponse.json({ error: 'No disponible' }, { status: 404 });
  }

  try {
    const body = (await request.json()) as {
      identification?: string;
      password?: string;
      secret?: string;
    };

    const secret = String(body.secret ?? '').trim();
    if (!secret || !secretsMatch(secret, configuredSecret)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const identification = String(body.identification ?? '').trim();
    const password = String(body.password ?? '').trim();
    if (!identification || password.length < 8) {
      return NextResponse.json(
        { error: 'Identificación y contraseña (mín. 8 caracteres) requeridas' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findFirst({
      where: { identification },
      select: { id: true, role: true, email: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    if (!isSuperAdminRole(user.role)) {
      return NextResponse.json(
        { error: 'Solo se puede restablecer la cuenta de super administrador por esta vía' },
        { status: 403 },
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(password, 10),
        isActive: true,
      },
    });

    console.info('[emergency-reset] Contraseña restablecida para', user.email);

    return NextResponse.json({
      message: `Contraseña restablecida para ${user.name}. Inicie sesión y cambie la contraseña.`,
    });
  } catch (e) {
    console.error('[emergency-reset]', e);
    return NextResponse.json({ error: 'Error al procesar' }, { status: 500 });
  }
}
