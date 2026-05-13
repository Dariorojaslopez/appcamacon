import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';

const MAX_ROWS = 400;

function ymdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDayStartUtc(ymd: string): Date | null {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDayEndUtc(ymd: string): Date | null {
  const d = new Date(`${ymd}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function joinBlocks(parts: (string | null | undefined)[], sep = '\n\n'): string {
  return parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(sep);
}

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get('dateFrom')?.trim();
    const dateTo = searchParams.get('dateTo')?.trim();
    const projectId = searchParams.get('projectId')?.trim();
    const jornadaId = searchParams.get('jornadaId')?.trim();

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'dateFrom y dateTo son requeridos (YYYY-MM-DD).' }, { status: 400 });
    }

    const t0 = parseDayStartUtc(dateFrom);
    const t1 = parseDayEndUtc(dateTo);
    if (!t0 || !t1 || t0 > t1) {
      return NextResponse.json({ error: 'Rango de fechas no válido.' }, { status: 400 });
    }

    const where: Parameters<typeof prisma.informeDiario.findMany>[0]['where'] = {
      date: { gte: t0, lte: t1 },
    };

    if (projectId && projectId !== 'all') {
      where.projectId = projectId;
    }

    if (jornadaId && jornadaId !== 'all') {
      where.jornadaCatalogoId = jornadaId;
    }

    const informes = await prisma.informeDiario.findMany({
      where,
      take: MAX_ROWS,
      orderBy: [{ date: 'asc' }, { projectId: 'asc' }, { jornadaCatalogoId: 'asc' }],
      include: {
        project: { select: { code: true, name: true } },
        jornadaCatalogo: { select: { nombre: true, horaInicio: true, horaFin: true } },
        personal: { orderBy: { createdAt: 'asc' } },
        equipos: {
          orderBy: { createdAt: 'asc' },
          include: { horarios: { orderBy: { orden: 'asc' } } },
        },
        materialIngresos: { orderBy: { createdAt: 'asc' } },
        materialEntregas: { orderBy: { createdAt: 'asc' } },
        actividadesObra: { orderBy: { createdAt: 'asc' } },
        ensayosObra: { orderBy: { createdAt: 'asc' } },
        danosRedesObra: { orderBy: { createdAt: 'asc' } },
        noConformidadesObra: { orderBy: { createdAt: 'asc' } },
        suspensiones: { orderBy: { orden: 'asc' } },
        firmas: { orderBy: { slot: 'asc' } },
      },
    });

    const rows = informes.map((inf) => {
      const obraCodigo = inf.project?.code ?? '';
      const obraNombre = inf.project?.name ?? '';
      const fecha = ymdUtc(inf.date);
      const jornadaNombre = inf.jornadaCatalogo
        ? `${inf.jornadaCatalogo.nombre} (${inf.jornadaCatalogo.horaInicio}–${inf.jornadaCatalogo.horaFin})`
        : '— (sin jornada)';

      const datosGenerales = joinBlocks(
        [
          inf.informeNo ? `Informe N°: ${inf.informeNo}` : null,
          inf.centroTrabajo ? `Centro de trabajo: ${inf.centroTrabajo}` : null,
          inf.frenteObra ? `Frente de obra: ${inf.frenteObra}` : null,
          inf.contratista ? `Contratista: ${inf.contratista}` : null,
          inf.encargadoReporte ? `Encargado reporte: ${inf.encargadoReporte}` : null,
          inf.cargo ? `Cargo: ${inf.cargo}` : null,
          inf.horaEntrada || inf.horaSalida
            ? `Horario obra: ${inf.horaEntrada ?? '—'} – ${inf.horaSalida ?? '—'}`
            : null,
          inf.informeCerrado ? 'Estado informe: CERRADO' : 'Estado informe: Abierto',
        ],
        '\n',
      );

      const jornadaCondiciones = joinBlocks(
        [
          inf.condiciones ? `Condiciones: ${inf.condiciones}` : null,
          inf.actividades ? `Actividades (texto): ${inf.actividades}` : null,
          inf.incidentes ? `Incidentes: ${inf.incidentes}` : null,
          inf.huboSuspension != null
            ? `Suspensión jornada (cabecera): ${inf.huboSuspension ? 'Sí' : 'No'}${inf.motivoSuspension ? ` — ${inf.motivoSuspension}` : ''}`
            : null,
          inf.horaSuspension || inf.horaReinicio
            ? `Hora susp./reinicio (cabecera): ${inf.horaSuspension ?? '—'} / ${inf.horaReinicio ?? '—'}`
            : null,
          inf.tipoClima ? `Clima: ${inf.tipoClima}${inf.horasClima != null ? ` (${inf.horasClima} h)` : ''}` : null,
          inf.suspensiones.length > 0
            ? `Suspensiones detalle:\n${inf.suspensiones
                .map(
                  (s, i) =>
                    `  ${i + 1}. ${s.motivoSuspension} · ${s.horaSuspension}–${s.horaReinicio}${s.tipoClima ? ` · clima ${s.tipoClima}` : ''}`,
                )
                .join('\n')}`
            : null,
        ],
        '\n',
      );

      const personalTxt =
        inf.personal.length > 0
          ? inf.personal
              .map((p, i) => {
                const sub = p.subcontratista ? ` · Sub: ${p.subcontratista}` : '';
                const he = p.horaEntrada && p.horaSalida ? ` · ${p.horaEntrada}–${p.horaSalida}` : '';
                return `${i + 1}. ${p.nombre} (${p.cargo})${sub}${he}`;
              })
              .join('\n')
          : '—';

      const equiposTxt = joinBlocks(
        [
          inf.equipos.length > 0
            ? inf.equipos
                .map((eq, i) => {
                  const hz = eq.horarios
                    .map((h) => `${h.horaIngreso}–${h.horaSalida} (${h.horasTrabajadas} h)`)
                    .join(' | ');
                  const base = `${i + 1}. ${eq.descripcion}${eq.placaRef ? ` · ${eq.placaRef}` : ''}${eq.propiedad ? ` · ${eq.propiedad}` : ''}${eq.estado ? ` · ${eq.estado}` : ''}${eq.horasTrabajadas != null ? ` · Total h: ${eq.horasTrabajadas}` : ''}`;
                  return hz ? `${base}\n   Horarios: ${hz}` : base;
                })
                .join('\n\n')
            : null,
          inf.materialIngresos.length > 0
            ? `Ingresos materiales:\n${inf.materialIngresos
                .map(
                  (m, i) =>
                    `  ${i + 1}. ${m.tipoMaterial} · ${m.proveedor} · Rem. ${m.noRemision} · ${m.cantidad ?? '—'} ${m.unidad}${m.observacion ? ` · ${m.observacion}` : ''}`,
                )
                .join('\n')}`
            : null,
          inf.materialEntregas.length > 0
            ? `Entregas materiales:\n${inf.materialEntregas
                .map(
                  (m, i) =>
                    `  ${i + 1}. ${m.tipoMaterial} · ${m.cantidad ?? '—'} ${m.unidad} · ${m.contratista} · Firma: ${m.firmaRecibido ? 'Sí' : 'No'}${m.observacion ? ` · ${m.observacion}` : ''}`,
                )
                .join('\n')}`
            : null,
        ],
        '\n\n',
      );

      const actividadesTxt =
        inf.actividadesObra.length > 0
          ? inf.actividadesObra
              .map((a, i) => {
                const abs =
                  [a.abscisadoInicial, a.abscisadoFinal].filter(Boolean).join(' → ') || '—';
                const obs = a.observacionTexto ? ` · Obs: ${a.observacionTexto}` : '';
                return `${i + 1}. PK ${a.pk} · Abs. ${abs} · Ítem ${a.itemContractual} · ${a.descripcion} · ${a.cantidadTotal ?? '—'} ${a.unidadMedida}${obs}`;
              })
              .join('\n')
          : '—';

      const calidadTxt = joinBlocks(
        [
          inf.ensayosObra.length > 0
            ? `Ensayos:\n${inf.ensayosObra
                .map(
                  (e, i) =>
                    `  ${i + 1}. ${e.tipoEnsayo} · ${e.materialActividad} · Muestra ${e.idMuestra} · ${e.laboratorio} · ${e.localizacion} · ${e.resultado}${e.observacion ? ` · ${e.observacion}` : ''}`,
                )
                .join('\n')}`
            : null,
          inf.danosRedesObra.length > 0
            ? `Daños redes:\n${inf.danosRedesObra
                .map(
                  (d, i) =>
                    `  ${i + 1}. ${d.tipoDano} · ${d.direccion} · ${d.entidad} · Reporte ${d.noReporte}${d.observacion ? ` · ${d.observacion}` : ''}`,
                )
                .join('\n')}`
            : null,
          inf.noConformidadesObra.length > 0
            ? `No conformidades:\n${inf.noConformidadesObra
                .map(
                  (n, i) =>
                    `  ${i + 1}. ${n.noConformidad} · ${n.estado}${n.detalle ? ` · ${n.detalle}` : ''}${n.origen ? ` · Origen: ${n.origen}` : ''}`,
                )
                .join('\n')}`
            : null,
        ],
        '\n\n',
      );

      const evidenciasTxt = joinBlocks(
        [
          inf.registroFotografico != null
            ? `Registro fotográfico cargado: ${inf.registroFotografico ? 'Sí' : 'No'}`
            : null,
          inf.observacionesGenerales ? `Observaciones generales:\n${inf.observacionesGenerales}` : null,
          inf.observaciones ? `Observaciones (campo histórico):\n${inf.observaciones}` : null,
          inf.evidenciasUrl ? `Evidencias URL: ${inf.evidenciasUrl}` : null,
          inf.firmas.length > 0
            ? `Firmas:\n${inf.firmas
                .map(
                  (f) =>
                    `  · ${f.slot}: ${f.firmado ? 'Firmado' : 'Pendiente'}${f.observacion ? ` — ${f.observacion}` : ''}`,
                )
                .join('\n')}`
            : null,
        ],
        '\n\n',
      );

      return {
        informeId: inf.id,
        obraCodigo,
        obraNombre,
        fecha,
        jornadaNombre,
        datosGenerales: datosGenerales || '—',
        jornadaCondiciones: jornadaCondiciones || '—',
        personal: personalTxt,
        equiposMateriales: equiposTxt || '—',
        actividades: actividadesTxt,
        calidad: calidadTxt || '—',
        evidencias: evidenciasTxt || '—',
      };
    });

    return NextResponse.json({
      rows,
      truncated: informes.length >= MAX_ROWS,
      maxRows: MAX_ROWS,
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al consolidar informes' }, { status: 500 });
  }
}
