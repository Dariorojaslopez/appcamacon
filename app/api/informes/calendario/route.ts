import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../src/lib/prisma';
import { authFromRequest, isAuthPayload, requireAccessibleProject } from '../../../../src/lib/requireProjectAccess';
import { resolveJornadaCatalogoId } from '../../../../src/lib/informeDailyScope';
import { buildUtcDateRangeInclusive, parseYmdUtc, toYmdUtc } from '../../../../src/lib/registroBitacoraFecha';

export async function GET(req: NextRequest) {
  try {
    const auth = authFromRequest(req);
    if (!isAuthPayload(auth)) return auth;

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim() ?? '';
    const jornadaId = req.nextUrl.searchParams.get('jornadaId')?.trim() ?? '';
    const yearRaw = req.nextUrl.searchParams.get('year');
    const monthRaw = req.nextUrl.searchParams.get('month');

    if (!projectId || !jornadaId) {
      return NextResponse.json({ error: 'projectId y jornadaId son requeridos' }, { status: 400 });
    }

    const denied = await requireAccessibleProject(auth, projectId);
    if (denied) return denied;

    const jr = await resolveJornadaCatalogoId(jornadaId);
    if (jr.valid === false) {
      return NextResponse.json({ error: jr.error }, { status: jr.status });
    }

    const now = new Date();
    const year = yearRaw ? Number(yearRaw) : now.getUTCFullYear();
    const month = monthRaw ? Number(monthRaw) : now.getUTCMonth() + 1;
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'year y month inválidos' }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { startDate: true, endDate: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 404 });
    }

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));
    const { gte, lt } = buildUtcDateRangeInclusive(monthStart, monthEnd);

    const informes = await prisma.informeDiario.findMany({
      where: {
        projectId,
        jornadaCatalogoId: jr.id,
        date: { gte, lt },
      },
      select: {
        date: true,
        informeCerrado: true,
        informeNo: true,
      },
      orderBy: { date: 'asc' },
    });

    const byDate = new Map<
      string,
      { hasInforme: true; informeCerrado: boolean; informeNo: string | null }
    >();
    for (const inf of informes) {
      const ymd = toYmdUtc(inf.date);
      byDate.set(ymd, {
        hasInforme: true,
        informeCerrado: Boolean(inf.informeCerrado),
        informeNo: inf.informeNo ?? null,
      });
    }

    const daysInMonth = monthEnd.getUTCDate();
    const days: Array<{
      date: string;
      hasInforme: boolean;
      informeCerrado: boolean;
      informeNo: string | null;
      inObraRange: boolean;
    }> = [];

    const obraStart = project.startDate ? toYmdUtc(project.startDate) : null;
    const obraEnd = project.endDate ? toYmdUtc(project.endDate) : null;

    for (let d = 1; d <= daysInMonth; d += 1) {
      const ymd = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const parsed = parseYmdUtc(ymd);
      if (!parsed) continue;
      let inObraRange = true;
      if (obraStart && ymd < obraStart) inObraRange = false;
      if (obraEnd && ymd > obraEnd) inObraRange = false;
      const hit = byDate.get(ymd);
      days.push({
        date: ymd,
        hasInforme: Boolean(hit),
        informeCerrado: hit?.informeCerrado ?? false,
        informeNo: hit?.informeNo ?? null,
        inObraRange,
      });
    }

    return NextResponse.json({
      year,
      month,
      obraStart,
      obraEnd,
      days,
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar calendario de informes' }, { status: 500 });
  }
}
