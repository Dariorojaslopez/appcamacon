import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { UserRepository } from '../../../../../src/infrastructure/repositories/UserRepository';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../src/lib/prisma';

const userRepository = new UserRepository();

function toPublicUser(u: { id: string; identification: string; email: string; name: string; role: string; isActive: boolean; createdAt: Date; updatedAt: Date }) {
  return { id: u.id, identification: u.identification, email: u.email, name: u.name, role: u.role, isActive: u.isActive, createdAt: u.createdAt, updatedAt: u.updatedAt };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json() as { name?: string; email?: string; role?: string; isActive?: boolean; password?: string };
    const updateData: { name?: string; email?: string; role?: string; isActive?: boolean; passwordHash?: string } = {};
    if (body.name != null) updateData.name = body.name;
    if (body.email != null) updateData.email = body.email;
    if (body.role != null) {
      const roleExists = await prisma.roleLabel.findUnique({ where: { role: body.role } });
      if (!roleExists) {
        return NextResponse.json({ error: 'Rol no válido. Cree el rol en Administrar roles.' }, { status: 400 });
      }
      updateData.role = body.role;
    }
    if (body.isActive != null) updateData.isActive = Boolean(body.isActive);
    if (body.password != null && body.password !== '') {
      updateData.passwordHash = await hash(body.password, 10);
    }
    const user = await userRepository.update(id, updateData);
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error: unknown) {
    const err = error as { name?: string; code?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (err.code === 'P2025') return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authCookie = _req.cookies.get('access_token')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const { id } = await params;
    if (payload.sub === id) {
      return NextResponse.json({ error: 'No puede eliminar su propio usuario' }, { status: 400 });
    }
    await userRepository.delete(id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const err = error as { name?: string; code?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (err.code === 'P2025') return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    console.error(error);
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 });
  }
}
