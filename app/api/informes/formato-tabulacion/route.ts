import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import { resolveJornadaCatalogoId } from '../../../../src/lib/informeDailyScope';
import { buildFormatoTabulacionWorkbookBuffer } from '../../../../src/lib/formatoTabulacionExcel';

function normalizeDate(date: string): Date | null {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function safeFilenamePart(s: string): string {
  return String(s)
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 40);
}

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId')?.trim();
    const dateStr = searchParams.get('date')?.trim();
    const jornadaId = searchParams.get('jornadaId')?.trim();
    if (!projectId || !dateStr || !jornadaId) {
      return NextResponse.json(
        { error: 'projectId, date y jornadaId son requeridos (use la misma obra, fecha y jornada del informe).' },
        { status: 400 },
      );
    }
    const date = normalizeDate(dateStr);
    if (!date) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });

    const jr = await resolveJornadaCatalogoId(jornadaId);
    if (jr.valid === false) {
      return NextResponse.json({ error: jr.error }, { status: jr.status });
    }

    const [project, informe, itemsRaw, jornadaRow] = await Promise.all([
      prisma.project.findFirst({
        where: { id: projectId, isActive: true },
        select: { code: true, name: true },
      }),
      prisma.informeDiario.findFirst({
        where: { projectId, date, jornadaCatalogoId: jr.id },
        include: { actividadesObra: { orderBy: { createdAt: 'asc' } } },
      }),
      prisma.itemCatalog.findMany({
        where: { projectId, isActive: true },
        orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
        include: {
          subchapter: {
            include: { chapter: { select: { codigo: true, nombre: true } } },
          },
        },
      }),
      prisma.jornadaCatalog.findFirst({ where: { id: jr.id }, select: { nombre: true } }),
    ]);

    if (!project) {
      return NextResponse.json({ error: 'Obra no encontrada' }, { status: 404 });
    }

    const items = (itemsRaw as any[]).map((it) => {
      const ch = it.subchapter?.chapter;
      const sub = it.subchapter;
      const rubro =
        ch && sub
          ? `${String(ch.codigo).trim()} ${String(ch.nombre).trim()} › ${String(sub.nombre).trim()}`
          : null;
      return {
        codigo: String(it.codigo ?? ''),
        descripcion: String(it.descripcion ?? ''),
        unidad: it.unidad ?? null,
        cantidad: it.cantidad != null ? Number(it.cantidad) : null,
        precioUnitario: it.precioUnitario != null ? Number(it.precioUnitario) : null,
        rubro,
      };
    });

    const actividades = (informe?.actividadesObra ?? []).map((a: any) => ({
      pk: String(a.pk ?? ''),
      abscisado: a.abscisado != null ? String(a.abscisado) : null,
      itemContractual: String(a.itemContractual ?? ''),
      descripcion: String(a.descripcion ?? ''),
      unidadMedida: a.unidadMedida != null ? String(a.unidadMedida) : null,
      observacionTexto: a.observacionTexto != null ? String(a.observacionTexto) : null,
      cantidadTotal: a.cantidadTotal != null ? Number(a.cantidadTotal) : null,
    }));

    const buffer = await buildFormatoTabulacionWorkbookBuffer({
      obraCode: project.code,
      obraNombre: project.name,
      fechaReporte: dateStr,
      jornadaNombre: jornadaRow?.nombre ?? 'Jornada',
      informeNo: informe?.informeNo ?? null,
      responsable: informe?.encargadoReporte ?? null,
      items,
      actividades,
    });

    const fn = `Informe_Diario_Produccion_${safeFilenamePart(project.code)}_${safeFilenamePart(dateStr)}.xlsx`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fn}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al generar formato de tabulación' }, { status: 500 });
  }
}
