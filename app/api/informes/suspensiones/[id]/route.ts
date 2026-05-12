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
      imagenUrl?: string | null;
      imagenLatitud?: number | null;
      imagenLongitud?: number | null;
      imagenPrecision?: number | null;
      imagenGeoEstado?: string | null;
      imagenTomadaEn?: string | null;
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
        imagenUrl:
          body.imagenUrl !== undefined
            ? typeof body.imagenUrl === 'string' && body.imagenUrl.trim()
              ? body.imagenUrl.trim()
              : null
            : row.imagenUrl,
        imagenLatitud:
          body.imagenLatitud !== undefined
            ? typeof body.imagenLatitud === 'number' && Number.isFinite(body.imagenLatitud)
              ? body.imagenLatitud
              : null
            : row.imagenLatitud,
        imagenLongitud:
          body.imagenLongitud !== undefined
            ? typeof body.imagenLongitud === 'number' && Number.isFinite(body.imagenLongitud)
              ? body.imagenLongitud
              : null
            : row.imagenLongitud,
        imagenPrecision:
          body.imagenPrecision !== undefined
            ? typeof body.imagenPrecision === 'number' && Number.isFinite(body.imagenPrecision)
              ? body.imagenPrecision
              : null
            : row.imagenPrecision,
        imagenGeoEstado:
          body.imagenGeoEstado !== undefined
            ? body.imagenGeoEstado
              ? String(body.imagenGeoEstado).trim()
              : null
            : row.imagenGeoEstado,
        imagenTomadaEn:
          body.imagenTomadaEn !== undefined
            ? body.imagenTomadaEn
              ? new Date(body.imagenTomadaEn)
              : null
            : row.imagenTomadaEn,
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
        imagenUrl: updated.imagenUrl ?? null,
        imagenLatitud: updated.imagenLatitud,
        imagenLongitud: updated.imagenLongitud,
        imagenPrecision: updated.imagenPrecision,
        imagenGeoEstado: updated.imagenGeoEstado,
        imagenTomadaEn: updated.imagenTomadaEn ? updated.imagenTomadaEn.toISOString() : null,
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
