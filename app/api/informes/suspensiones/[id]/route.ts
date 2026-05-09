import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../src/lib/prisma';
import { informeCerradoJsonResponse } from '../../../../../src/lib/informeCerrado';

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const body = (await req.json()) as {
      motivoSuspension?: string;
      horaSuspension?: string;
      horaReinicio?: string;
      tipoClima?: string;
      horasClima?: number;
    };

    const row = await prisma.informeSuspension.findFirst({
      where: { id },
      include: { informeDiario: { select: { informeCerrado: true } } },
    });
    if (!row) return NextResponse.json({ error: 'Suspensión no encontrada' }, { status: 404 });
    if (row.informeDiario.informeCerrado) return informeCerradoJsonResponse();

    const motivo = body.motivoSuspension != null ? String(body.motivoSuspension).trim() : row.motivoSuspension;
    const hS = body.horaSuspension != null ? String(body.horaSuspension).trim() : row.horaSuspension;
    const hR = body.horaReinicio != null ? String(body.horaReinicio).trim() : row.horaReinicio;
    if (!motivo || !hS || !hR) {
      return NextResponse.json({ error: 'Motivo y horas son requeridos.' }, { status: 400 });
    }

    const updated = await prisma.informeSuspension.update({
      where: { id },
      data: {
        motivoSuspension: motivo,
        horaSuspension: hS,
        horaReinicio: hR,
        tipoClima: body.tipoClima !== undefined ? body.tipoClima?.trim() || null : row.tipoClima,
        horasClima:
          body.horasClima !== undefined
            ? typeof body.horasClima === 'number'
              ? body.horasClima
              : null
            : row.horasClima,
      },
    });

    return NextResponse.json({
      item: {
        id: updated.id,
        motivoSuspension: updated.motivoSuspension,
        horaSuspension: updated.horaSuspension,
        horaReinicio: updated.horaReinicio,
        tipoClima: updated.tipoClima ?? '',
        horasClima: updated.horasClima ?? 0,
        orden: updated.orden,
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  try {
    const cookie = req.cookies.get('access_token')?.value;
    if (!cookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(cookie);

    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

    const row = await prisma.informeSuspension.findFirst({
      where: { id },
      include: { informeDiario: { select: { informeCerrado: true } } },
    });
    if (!row) return NextResponse.json({ error: 'Suspensión no encontrada' }, { status: 404 });
    if (row.informeDiario.informeCerrado) return informeCerradoJsonResponse();

    await prisma.informeSuspension.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
