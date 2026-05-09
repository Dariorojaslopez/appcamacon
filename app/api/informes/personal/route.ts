import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import { resolveJornadaCatalogoId } from '../../../../src/lib/informeDailyScope';
import { informeCerradoJsonResponse } from '../../../../src/lib/informeCerrado';

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
    if (jr.valid === false) {
      return NextResponse.json({ error: jr.error }, { status: jr.status });
    }

    const informe = await prisma.informeDiario.findFirst({
      where: { projectId, date, jornadaCatalogoId: jr.id },
      include: { personal: { orderBy: { createdAt: 'asc' } } },
    });

    return NextResponse.json({
      exists: Boolean(informe),
      informeCerrado: informe?.informeCerrado ?? false,
      cerradoEn: informe?.cerradoEn ? informe.cerradoEn.toISOString() : null,
      personal: (informe?.personal ?? []).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        cargo: p.cargo,
        subcontratista: p.subcontratista,
        horaEntrada: p.horaEntrada,
        horaSalida: p.horaSalida,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar personal' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    const userId = payload.sub as string;

    const body = (await req.json()) as {
      projectId?: string;
      date?: string;
      jornadaId?: string;
      jornadaCatalogoId?: string;
      personal?: Array<{
        nombre: string;
        cargo: string;
        subcontratista?: string;
        horaEntrada?: string;
        horaSalida?: string;
      }>;
    };

    const projectId = body.projectId;
    const dateStr = body.date;
    if (!projectId || !dateStr) {
      return NextResponse.json({ error: 'projectId y date son requeridos' }, { status: 400 });
    }
    const date = normalizeDate(dateStr);
    if (!date) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });

    const jr = await resolveJornadaCatalogoId(body.jornadaId ?? body.jornadaCatalogoId);
    if (jr.valid === false) {
      return NextResponse.json({ error: jr.error }, { status: jr.status });
    }

    const project = await prisma.project.findFirst({ where: { id: projectId, isActive: true } });
    if (!project) {
      return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 400 });
    }

    const items = Array.isArray(body.personal) ? body.personal : [];
    const cleaned = items
      .map((p) => ({
        nombre: String(p.nombre ?? '').trim(),
        cargo: String(p.cargo ?? '').trim(),
        subcontratista: p.subcontratista ? String(p.subcontratista).trim() : null,
        horaEntrada: p.horaEntrada ? String(p.horaEntrada).trim() : null,
        horaSalida: p.horaSalida ? String(p.horaSalida).trim() : null,
      }))
      .filter((p) => p.nombre && p.cargo);

    const informe = await prisma.informeDiario.findFirst({
      where: { projectId, date, jornadaCatalogoId: jr.id },
      select: {
        id: true,
        informeConsecutivo: true,
        centroTrabajoConsecutivo: true,
        informeNo: true,
        centroTrabajo: true,
        informeCerrado: true,
      },
    });

    if (informe?.informeCerrado) {
      return informeCerradoJsonResponse();
    }

    // Si no existe el informe del día, lo creamos (upsert por obra+fecha)
    let informeId = informe?.id;
    if (!informeId) {
      const maxByProject = await prisma.informeDiario.aggregate({
        where: { projectId },
        _max: { informeConsecutivo: true, centroTrabajoConsecutivo: true },
      });
      const nextInformeConsecutivo = (maxByProject._max.informeConsecutivo ?? 0) + 1;
      const nextCentroTrabajoConsecutivo = (maxByProject._max.centroTrabajoConsecutivo ?? 0) + 1;
      const year = date.getUTCFullYear();
      const informeNo = `IDO-${year}-${String(nextInformeConsecutivo).padStart(3, '0')}`;
      const centroTrabajo = `CT-${String(nextCentroTrabajoConsecutivo).padStart(3, '0')}`;

      const created = await prisma.informeDiario.create({
        data: {
          userId,
          projectId,
          date,
          jornadaCatalogoId: jr.id,
          informeConsecutivo: nextInformeConsecutivo,
          informeNo,
          centroTrabajoConsecutivo: nextCentroTrabajoConsecutivo,
          centroTrabajo,
        },
        select: { id: true },
      });
      informeId = created.id;
    } else {
      // actualizamos quien editó por última vez
      await prisma.informeDiario.update({
        where: { id: informeId },
        data: { userId },
      });
    }

    // Reemplazar la lista completa (simple y consistente)
    await prisma.personalObra.deleteMany({ where: { informeId } });
    if (cleaned.length > 0) {
      await prisma.personalObra.createMany({
        data: cleaned.map((p) => ({ ...p, informeId: informeId as string })),
      });
    }

    const saved = await prisma.personalObra.findMany({
      where: { informeId: informeId as string },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      ok: true,
      personal: saved.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        cargo: p.cargo,
        subcontratista: p.subcontratista,
        horaEntrada: p.horaEntrada,
        horaSalida: p.horaSalida,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al guardar personal' }, { status: 500 });
  }
}

