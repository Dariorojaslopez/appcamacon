import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../src/lib/prisma';

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
    const body = (await req.json()) as {
      name?: string;
      description?: string;
      startDate?: string | null;
      endDate?: string | null;
      isActive?: boolean;
      evidenciasOnedriveShareUrl?: string | null;
      evidenciasGoogleDriveFolderId?: string | null;
      logoUrl?: string | null;
    };
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.description !== undefined) data.description = body.description?.trim() || null;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.evidenciasOnedriveShareUrl !== undefined) {
      const s = body.evidenciasOnedriveShareUrl;
      data.evidenciasOnedriveShareUrl =
        s != null && String(s).trim() ? String(s).trim() : null;
    }
    if (body.evidenciasGoogleDriveFolderId !== undefined) {
      const s = body.evidenciasGoogleDriveFolderId;
      data.evidenciasGoogleDriveFolderId =
        s != null && String(s).trim() ? String(s).trim() : null;
    }
    if (body.logoUrl !== undefined) {
      const s = body.logoUrl;
      data.logoUrl = s != null && String(s).trim() ? String(s).trim() : null;
    }

    const obra = await prisma.project.update({
      where: { id },
      data: data as any,
    });
    return NextResponse.json({
      obra: {
        id: obra.id,
        consecutivo: obra.consecutivo,
        name: obra.name,
        description: obra.description,
        code: obra.code,
        startDate: obra.startDate,
        endDate: obra.endDate,
        evidenciasOnedriveShareUrl: obra.evidenciasOnedriveShareUrl,
        evidenciasGoogleDriveFolderId: obra.evidenciasGoogleDriveFolderId,
        logoUrl: obra.logoUrl,
        isActive: obra.isActive,
        createdAt: obra.createdAt,
        updatedAt: obra.updatedAt,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string; code?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Obra no encontrada' }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar obra' }, { status: 500 });
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
    const informesCount = await prisma.informeDiario.count({ where: { projectId: id } });
    if (informesCount > 0) {
      return NextResponse.json(
        { error: `No se puede eliminar: hay ${informesCount} informe(s) asociado(s). Elimine o reasigne los informes primero.` },
        { status: 400 },
      );
    }
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const err = error as { name?: string; code?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (err.code === 'P2025') {
      return NextResponse.json({ error: 'Obra no encontrada' }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al eliminar obra' }, { status: 500 });
  }
}
