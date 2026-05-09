import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { UserRepository } from '../../../../src/infrastructure/repositories/UserRepository';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';

const userRepository = new UserRepository();

function toPublicUser(u: { id: string; identification: string; email: string; name: string; role: string; isActive: boolean; createdAt: Date; updatedAt: Date }) {
  return { id: u.id, identification: u.identification, email: u.email, name: u.name, role: u.role, isActive: u.isActive, createdAt: u.createdAt, updatedAt: u.updatedAt };
}

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const users = await userRepository.findAll();
    return NextResponse.json({ users: users.map(toPublicUser) });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al listar usuarios' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const payload = verifyAccessToken(authCookie);

    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const {
      identification,
      email,
      name,
      role,
      password,
    } = body as { identification?: string; email?: string; name?: string; role?: string; password?: string };

    if (!identification || !email || !name || !role || !password) {
      return NextResponse.json(
        { error: 'Identificación, correo, nombre, rol y contraseña son requeridos' },
        { status: 400 },
      );
    }
    const roleExists = await prisma.roleLabel.findUnique({ where: { role } });
    if (!roleExists) {
      return NextResponse.json(
        { error: 'Rol no válido. Cree el rol en Administrar roles.' },
        { status: 400 },
      );
    }

    const passwordHash = await hash(password, 10);

    const user = await userRepository.create({
      identification,
      email,
      name,
      passwordHash,
      role: role as any,
    });

    return NextResponse.json(
      {
        user,
      },
      { status: 201 },
    );
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      {
        error: error?.message ?? 'Error al crear usuario',
      },
      { status: 500 },
    );
  }
}

