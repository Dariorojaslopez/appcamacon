import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../../src/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { id } = await params;
    const body = (await req.json()) as {
      nombre?: string;
      orden?: number;
      isActive?: boolean;
    };

    const data: { nombre?: string; orden?: number; isActive?: boolean } = {};

    if (body.nombre !== undefined) {
      const nombre = String(body.nombre).trim();
      if (!nombre) return NextResponse.json({ error: 'El nombre no puede quedar vacío' }, { status: 400 });
      data.nombre = nombre;
    }
    if (body.orden !== undefined && Number.isFinite(body.orden)) data.orden = Number(body.orden);
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
    }

    const updated = await prisma.tipoCondicionCatalog.update({ where: { id }, data });
    return NextResponse.json({ item: updated }, { status: 200 });
  } catch (error: unknown) {
    const err = error as { name?: string; code?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (err?.code === 'P2025') {
      return NextResponse.json({ error: 'Tipo no encontrado' }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar tipo de condición' }, { status: 500 });
  }
}
