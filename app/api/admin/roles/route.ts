import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';

const ROLE_KEY_REGEX = /^[A-Z0-9_]+$/i;

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
    const roles = await prisma.roleLabel.findMany({
      orderBy: { role: 'asc' },
    });
    return NextResponse.json({
      roles: roles.map((r) => ({ role: r.role, label: r.label })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al listar roles' }, { status: 500 });
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
    const body = (await req.json()) as { role?: string; label?: string };
    const { role, label } = body;
    if (!role || typeof label !== 'string') {
      return NextResponse.json(
        { error: 'Se requieren role (clave) y label (nombre a mostrar)' },
        { status: 400 },
      );
    }
    const key = role.trim().toUpperCase();
    if (!ROLE_KEY_REGEX.test(key)) {
      return NextResponse.json(
        { error: 'La clave del rol solo puede contener letras, números y guión bajo' },
        { status: 400 },
      );
    }
    const existing = await prisma.roleLabel.findUnique({ where: { role: key } });
    if (existing) {
      return NextResponse.json({ error: 'Ya existe un rol con esa clave' }, { status: 400 });
    }
    await prisma.roleLabel.create({
      data: { role: key, label: label.trim() || key },
    });
    return NextResponse.json({ role: key, label: label.trim() || key }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al crear rol' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const body = (await req.json()) as { role?: string; label?: string };
    const { role, label } = body;
    if (!role || typeof label !== 'string') {
      return NextResponse.json(
        { error: 'Se requieren role y label' },
        { status: 400 },
      );
    }
    const existing = await prisma.roleLabel.findUnique({ where: { role } });
    if (!existing) {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
    }
    await prisma.roleLabel.update({
      where: { role },
      data: { label: label.trim() },
    });
    return NextResponse.json({ role, label: label.trim() });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar rol' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    if (!role) {
      return NextResponse.json({ error: 'Se requiere el parámetro role' }, { status: 400 });
    }
    const usersWithRole = await prisma.user.count({ where: { role } });
    if (usersWithRole > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: ${usersWithRole} usuario(s) tienen este rol. Reasigne o elimine esos usuarios primero.` },
        { status: 400 },
      );
    }
    await prisma.roleMenuPermission.deleteMany({ where: { role } });
    await prisma.roleFirmaPermission.deleteMany({ where: { role } });
    await prisma.roleLabel.delete({ where: { role } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const err = error as { name?: string; code?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al eliminar rol' }, { status: 500 });
  }
}
