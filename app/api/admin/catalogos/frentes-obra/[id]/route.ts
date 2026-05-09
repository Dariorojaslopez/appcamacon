import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../../src/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const data: Record<string, unknown> = {};
    if (body.nombre !== undefined) {
      const nombre = String(body.nombre).trim();
      if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
      data.nombre = nombre;
    }
    if (body.orden !== undefined) {
      data.orden =
        typeof body.orden === 'number' && Number.isFinite(body.orden) ? Math.trunc(body.orden) : 0;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
    }

    try {
      const updated = await prisma.frenteObraCatalog.update({
        where: { id },
        data: data as any,
      });
      return NextResponse.json({
        item: {
          id: updated.id,
          nombre: updated.nombre,
          orden: updated.orden,
          isActive: updated.isActive,
          projectId: updated.projectId,
        },
      });
    } catch (e: unknown) {
      const pe = e as { code?: string };
      if (pe.code === 'P2002') {
        return NextResponse.json({ error: 'Ya existe un frente con ese nombre en esta obra' }, { status: 409 });
      }
      if (pe.code === 'P2025') {
        return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
      }
      throw e;
    }
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar frente de obra' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authCookie = _req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { id } = await params;
    await prisma.$transaction([
      prisma.informeDiario.updateMany({
        where: { frenteObraCatalogoId: id },
        data: { frenteObraCatalogoId: null },
      }),
      prisma.frenteObraCatalog.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const err = error as { name?: string; code?: string };
    if (err?.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al eliminar frente de obra' }, { status: 500 });
  }
}
