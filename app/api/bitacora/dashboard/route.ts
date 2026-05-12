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

function horasPersonal(horaEntrada?: string | null, horaSalida?: string | null) {
  const parse = (h?: string | null) => {
    const m = String(h ?? '').match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const a = parse(horaEntrada);
  const b0 = parse(horaSalida);
  if (a == null || b0 == null) return 0;
  const b = b0 < a ? b0 + 24 * 60 : b0;
  return Math.max(0, (b - a) / 60);
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
    if (!projectId || !dateStr) {
      return NextResponse.json({ error: 'projectId y date son requeridos' }, { status: 400 });
    }

    const date = normalizeDate(dateStr);
    if (!date) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });
    const jr = await resolveJornadaCatalogoId(jornadaId);
    if (jr.valid === false) return NextResponse.json({ error: jr.error }, { status: jr.status });

    const informe = await prisma.informeDiario.findFirst({
      where: { projectId, date, jornadaCatalogoId: jr.id },
      include: {
        personal: true,
        equipos: true,
        materialIngresos: true,
        materialEntregas: true,
        actividadesObra: true,
        ensayosObra: true,
        danosRedesObra: true,
        noConformidadesObra: true,
        suspensiones: true,
        bitacoraClimas: true,
      },
    });

    if (!informe) {
      return NextResponse.json({
        ok: true,
        exists: false,
        metrics: null,
      });
    }

    await syncBitacoraFromInforme({
      informeId: informe.id,
      req,
      userId: payload.sub as string,
      userRole: payload.role,
    });

    const eventos = await prisma.bitacoraEvento.groupBy({
      by: ['moduloOrigen'],
      where: { informeId: informe.id, deletedAt: null },
      _count: { _all: true },
    });

    const horasHombre = informe.personal.reduce(
      (sum, p) => sum + horasPersonal(p.horaEntrada, p.horaSalida),
      0,
    );
    const avanceDiario = informe.actividadesObra.reduce(
      (sum, a) => sum + (typeof a.cantidadTotal === 'number' ? a.cantidadTotal : 0),
      0,
    );
    const clima = informe.bitacoraClimas[0] ?? null;

    return NextResponse.json({
      ok: true,
      exists: true,
      metrics: {
        personalTotal: informe.personal.length,
        horasHombre,
        materialesIngresados: informe.materialIngresos.length,
        actividadesEjecutadas: informe.actividadesObra.length,
        suspensiones: informe.suspensiones.length,
        maquinariaActiva: informe.equipos.filter((e) => e.estado !== 'FUERA_DE_SERVICIO').length,
        incidentes: informe.danosRedesObra.length,
        noConformidades: informe.noConformidadesObra.length,
        avanceDiario,
        clima: clima
          ? {
              tipo: clima.tipo,
              temperatura: clima.temperatura,
              humedad: clima.humedad,
              observaciones: clima.observaciones,
            }
          : {
              tipo: informe.tipoClima,
              temperatura: null,
              humedad: null,
              observaciones: informe.condiciones,
            },
        eventosPorModulo: Object.fromEntries(eventos.map((e) => [e.moduloOrigen, e._count._all])),
      },
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar dashboard de bitácora' }, { status: 500 });
  }
}
