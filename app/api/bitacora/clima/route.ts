import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import { resolveJornadaCatalogoId } from '../../../../src/lib/informeDailyScope';
import { getBitacoraRequestContext, syncBitacoraFromInforme } from '../../../../src/lib/bitacora';

function normalizeDate(date: string): Date | null {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const dateStr = searchParams.get('date');
    const jornadaId = searchParams.get('jornadaId');
    if (!projectId || !dateStr) {
      return NextResponse.json({ error: 'projectId y date son requeridos' }, { status: 400 });
    }
    const date = normalizeDate(dateStr);
    if (!date) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });
    const jr = await resolveJornadaCatalogoId(jornadaId);
    if (jr.valid === false) return NextResponse.json({ error: jr.error }, { status: jr.status });

    const informe = await prisma.informeDiario.findFirst({
      where: { projectId, date, jornadaCatalogoId: jr.id },
      select: { id: true },
    });
    const clima = await prisma.bitacoraClima.findFirst({
      where: { projectId, fecha: date, informeId: informe?.id ?? undefined },
      orderBy: { updatedAt: 'desc' },
    });
    return NextResponse.json({ ok: true, clima });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar clima de bitácora' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    const body = (await req.json()) as {
      projectId?: string;
      date?: string;
      jornadaId?: string;
      tipo?: string;
      temperatura?: number | null;
      humedad?: number | null;
      observaciones?: string | null;
      latitud?: number | null;
      longitud?: number | null;
      precisionGps?: number | null;
    };

    if (!body.projectId || !body.date) {
      return NextResponse.json({ error: 'projectId y date son requeridos' }, { status: 400 });
    }
    const date = normalizeDate(body.date);
    if (!date) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });
    const tipo = String(body.tipo ?? '').trim();
    if (!tipo) return NextResponse.json({ error: 'Seleccione el tipo de clima' }, { status: 400 });
    const jr = await resolveJornadaCatalogoId(body.jornadaId);
    if (jr.valid === false) return NextResponse.json({ error: jr.error }, { status: jr.status });

    const informe = await prisma.informeDiario.findFirst({
      where: { projectId: body.projectId, date, jornadaCatalogoId: jr.id },
      select: { id: true },
    });
    const reqCtx = getBitacoraRequestContext(req);
    const latitud =
      typeof body.latitud === 'number' && Number.isFinite(body.latitud) ? body.latitud : reqCtx.latitud;
    const longitud =
      typeof body.longitud === 'number' && Number.isFinite(body.longitud) ? body.longitud : reqCtx.longitud;
    const precisionGps =
      typeof body.precisionGps === 'number' && Number.isFinite(body.precisionGps)
        ? body.precisionGps
        : reqCtx.precisionGps;

    const clima = informe
      ? await prisma.bitacoraClima.upsert({
          where: { informeId: informe.id },
          create: {
            projectId: body.projectId,
            informeId: informe.id,
            fecha: date,
            tipo,
            temperatura: typeof body.temperatura === 'number' ? body.temperatura : null,
            humedad: typeof body.humedad === 'number' ? body.humedad : null,
            observaciones: body.observaciones ? String(body.observaciones).trim() : null,
            latitud,
            longitud,
            precisionGps,
          },
          update: {
            tipo,
            temperatura: typeof body.temperatura === 'number' ? body.temperatura : null,
            humedad: typeof body.humedad === 'number' ? body.humedad : null,
            observaciones: body.observaciones ? String(body.observaciones).trim() : null,
            latitud,
            longitud,
            precisionGps,
          },
        })
      : await prisma.bitacoraClima.create({
          data: {
            projectId: body.projectId,
            fecha: date,
            tipo,
            temperatura: typeof body.temperatura === 'number' ? body.temperatura : null,
            humedad: typeof body.humedad === 'number' ? body.humedad : null,
            observaciones: body.observaciones ? String(body.observaciones).trim() : null,
            latitud,
            longitud,
            precisionGps,
          },
        });

    if (informe) {
      await prisma.informeDiario.update({
        where: { id: informe.id },
        data: { tipoClima: tipo, condiciones: body.observaciones ? String(body.observaciones).trim() : undefined },
      });
      await syncBitacoraFromInforme({
        informeId: informe.id,
        req,
        userId: payload.sub as string,
        userRole: payload.role,
      });
    }

    return NextResponse.json({ ok: true, clima });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al guardar clima de bitácora' }, { status: 500 });
  }
}
