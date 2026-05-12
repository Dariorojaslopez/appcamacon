import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import { resolveJornadaCatalogoId } from '../../../../src/lib/informeDailyScope';
import { syncBitacoraFromInforme } from '../../../../src/lib/bitacora';

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
    const payload = verifyAccessToken(authCookie);

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const dateStr = searchParams.get('date');
    const jornadaId = searchParams.get('jornadaId');
    const includeReplaced = searchParams.get('includeReplaced') === 'true';
    const modulo = searchParams.get('modulo');
    const q = searchParams.get('q')?.trim();

    if (!projectId) return NextResponse.json({ error: 'projectId es requerido' }, { status: 400 });

    let date: Date | null = null;
    let informeId: string | null = null;
    let jr: Awaited<ReturnType<typeof resolveJornadaCatalogoId>> | null = null;

    if (dateStr) {
      date = normalizeDate(dateStr);
      if (!date) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });
      jr = await resolveJornadaCatalogoId(jornadaId);
      if (jr.valid === false) return NextResponse.json({ error: jr.error }, { status: jr.status });

      const informe = await prisma.informeDiario.findFirst({
        where: { projectId, date, jornadaCatalogoId: jr.id },
        select: { id: true },
      });
      informeId = informe?.id ?? null;
      if (informeId) {
        await syncBitacoraFromInforme({
          informeId,
          req,
          userId: payload.sub as string,
          userRole: payload.role,
        });
      }
    }

    const eventos = await prisma.bitacoraEvento.findMany({
      where: {
        projectId,
        ...(date ? { fecha: date } : {}),
        ...(informeId ? { informeId } : {}),
        ...(includeReplaced ? {} : { deletedAt: null }),
        ...(modulo ? { moduloOrigen: modulo } : {}),
        ...(q
          ? {
              OR: [
                { descripcion: { contains: q, mode: 'insensitive' } },
                { usuario: { contains: q, mode: 'insensitive' } },
                { moduloOrigen: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        evidencias: true,
        firmas: true,
        auditorias: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
      orderBy: [{ fecha: 'asc' }, { hora: 'asc' }, { timestampUtc: 'asc' }],
      take: 500,
    });

    return NextResponse.json({
      ok: true,
      synced: Boolean(informeId),
      eventos,
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar bitácora' }, { status: 500 });
  }
}
