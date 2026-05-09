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
    const body = (await req.json()) as { cedula?: string; nombre?: string; isActive?: boolean };

    const data: Record<string, unknown> = {};
    if (body.cedula !== undefined) {
      const cedula = String(body.cedula).trim();
      if (!cedula) return NextResponse.json({ error: 'La cédula es requerida' }, { status: 400 });
      data.cedula = cedula;
    }
    if (body.nombre !== undefined) {
      const nombre = String(body.nombre).trim();
      if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
      data.nombre = nombre;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });
    }

    try {
      const updated = await prisma.encargadoReporteCatalog.update({
        where: { id },
        data: data as any,
      });

      return NextResponse.json(
        {
          item: {
            id: updated.id,
            cedula: updated.cedula,
            nombre: updated.nombre,
            isActive: updated.isActive,
            projectId: updated.projectId,
          },
        },
        { status: 200 },
      );
    } catch (e: unknown) {
      const pe = e as { code?: string };
      if (pe.code === 'P2002') {
        return NextResponse.json({ error: 'Ya existe un encargado con esa cédula en esta obra' }, { status: 409 });
      }
      throw e;
    }
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar encargado' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authCookie = _req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const { id } = await params;
    await prisma.$transaction([
      prisma.informeDiario.updateMany({
        where: { encargadoReporteCatalogoId: id },
        data: { encargadoReporteCatalogoId: null },
      }),
      prisma.encargadoReporteCatalog.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al eliminar encargado' }, { status: 500 });
  }
}
