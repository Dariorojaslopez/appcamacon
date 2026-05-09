import { NextRequest, NextResponse } from 'next/server';
import { LoginUserUseCase } from '../../../../src/domain/useCases/auth/loginUser';
import { UserRepository } from '../../../../src/infrastructure/repositories/UserRepository';
import { initDatabase } from '../../../../src/infrastructure/db/init';
import { signAccessToken, signRefreshToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';

const userRepository = new UserRepository();
const loginUserUseCase = new LoginUserUseCase(userRepository);

export async function POST(req: NextRequest) {
  try {
    await initDatabase();
    const body = await req.json();
    const { identification, password } = body as { identification?: string; password?: string };

    if (!identification || !password) {
      return NextResponse.json({ error: 'Número de identificación y contraseña son requeridos' }, { status: 400 });
    }

    const result = await loginUserUseCase.execute({ identification, password });

    let allowedMenus: string[] = [];
    try {
      const permissions = await prisma.roleMenuPermission.findMany({
        where: { role: result.user.role },
        select: { menuKey: true },
      });
      allowedMenus = permissions.map((p) => p.menuKey);
    } catch {
      // Si falla la tabla de permisos, dejamos array vacío
    }

    const payload = {
      sub: result.user.id,
      identification: result.user.identification,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const response = NextResponse.json(
      {
        user: {
          id: result.user.id,
          identification: result.user.identification,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
        },
        allowedMenus,
      },
      { status: 200 },
    );

    const isProd = process.env.NODE_ENV === 'production';

    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        error: error?.message ?? 'Error al iniciar sesión',
      },
      {
        status: 401,
      },
    );
  }
}

