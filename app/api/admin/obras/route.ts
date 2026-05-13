import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import { ensureDefaultBudgetHierarchy } from '../../../../src/lib/budgetHierarchy';

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
    const obras = await prisma.project.findMany({
      orderBy: [{ consecutivo: 'asc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json({
      obras: obras.map((o) => ({
        id: o.id,
        consecutivo: o.consecutivo,
        name: o.name,
        description: o.description,
        code: o.code,
        startDate: o.startDate,
        endDate: o.endDate,
        evidenciasOnedriveShareUrl: o.evidenciasOnedriveShareUrl,
        evidenciasGoogleDriveFolderId: o.evidenciasGoogleDriveFolderId,
        logoUrl: o.logoUrl,
        isActive: o.isActive,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al listar obras' }, { status: 500 });
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
    const body = (await req.json()) as {
      name?: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      evidenciasOnedriveShareUrl?: string | null;
      evidenciasGoogleDriveFolderId?: string | null;
      logoUrl?: string | null;
    };
    const { name, description, startDate, endDate, evidenciasOnedriveShareUrl, evidenciasGoogleDriveFolderId } =
      body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'El nombre de la obra es requerido' }, { status: 400 });
    }

    const max = await prisma.project.aggregate({ _max: { consecutivo: true } });
    const nextConsecutivo = (max._max.consecutivo ?? 0) + 1;
    const code = `OB-${String(nextConsecutivo).padStart(4, '0')}`;

    const obra = await prisma.project.create({
      data: {
        consecutivo: nextConsecutivo,
        name: name.trim(),
        description: description?.trim() || null,
        code,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        evidenciasOnedriveShareUrl:
          evidenciasOnedriveShareUrl != null && String(evidenciasOnedriveShareUrl).trim()
            ? String(evidenciasOnedriveShareUrl).trim()
            : null,
        evidenciasGoogleDriveFolderId:
          evidenciasGoogleDriveFolderId != null && String(evidenciasGoogleDriveFolderId).trim()
            ? String(evidenciasGoogleDriveFolderId).trim()
            : null,
      },
    });

    await ensureDefaultBudgetHierarchy(prisma, obra.id);

    return NextResponse.json(
      {
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
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al crear obra' }, { status: 500 });
  }
}
