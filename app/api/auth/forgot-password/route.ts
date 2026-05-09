import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '../../../../src/infrastructure/repositories/UserRepository';
import { hash } from 'bcryptjs';
import { initDatabase } from '../../../../src/infrastructure/db/init';
import { sendPasswordResetEmail } from '../../../../src/infrastructure/email/mailer';

const userRepository = new UserRepository();

export async function POST(req: NextRequest) {
  try {
    await initDatabase();

    const body = await req.json();
    const { identification } = body as { identification?: string };

    if (!identification) {
      return NextResponse.json(
        { error: 'El número de identificación es requerido' },
        { status: 400 },
      );
    }

    const user = await userRepository.findByIdentification(identification);

    if (!user) {
      // No filtramos si existe o no, para no dar pistas
      return NextResponse.json(
        { message: 'Si el usuario existe, se ha restablecido la contraseña.' },
        { status: 200 },
      );
    }

    // Generamos una contraseña temporal aleatoria
    const temporaryPassword = Math.random().toString(36).slice(-8);
    const newPasswordHash = await hash(temporaryPassword, 10);

    await (async () => {
      // update directo vía prisma porque el repositorio no tiene update aún
      const prismaModule = await import('../../../../src/lib/prisma');
      const prisma = prismaModule.default;

      await prisma.user.update({
        where: { identification },
        data: {
          password: newPasswordHash,
        },
      });
    })();

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      temporaryPassword,
    });

    return NextResponse.json(
      {
        message:
          'Hemos generado una nueva contraseña temporal y la hemos enviado al correo registrado.',
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      {
        error: error?.message ?? 'Error al restablecer contraseña',
      },
      { status: 500 },
    );
  }
}

