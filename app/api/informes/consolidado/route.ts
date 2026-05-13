import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import {
  EVIDENCIA_FASES,
  evidenciaItemUrl,
  parseEvidenciasStored,
  type EvidenciaItem,
} from '../../../../src/lib/evidenciasUrlPayload';

const MAX_ROWS = 600;

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

function fmtSiNo(v: boolean | null | undefined): string {
  if (v === true) return 'Sí';
  if (v === false) return 'No';
  return '—';
}

function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return String(n);
}

function fmtGeoLine(label: string, lat?: number | null, lon?: number | null, prec?: number | null, estado?: string | null, tomada?: Date | string | null): string | null {
  const has =
    (lat != null && Number.isFinite(lat)) ||
    (lon != null && Number.isFinite(lon)) ||
    (prec != null && Number.isFinite(prec)) ||
    (estado != null && String(estado).trim()) ||
    tomada != null;
  if (!has) return null;
  const t =
    tomada instanceof Date
      ? tomada.toISOString()
      : tomada != null && String(tomada).trim()
        ? String(tomada)
        : '—';
  return `${label}: lat ${fmtNum(lat)} · lon ${fmtNum(lon)} · precisión m ${fmtNum(prec)} · estado ${estado?.trim() || '—'} · capturada ${t}`;
}

function fmtEvidenciaItemDetalle(idx: number, item: EvidenciaItem): string {
  const url = evidenciaItemUrl(item);
  const lines = [`  ${idx + 1}. URL: ${url || '—'}`];
  if (typeof item === 'object' && item) {
    const g = fmtGeoLine(
      '     GPS foto',
      item.imagenLatitud,
      item.imagenLongitud,
      item.imagenPrecision,
      item.imagenGeoEstado,
      item.imagenTomadaEn ?? null,
    );
    if (g) lines.push(g);
    if (item.previewUrl?.trim()) lines.push(`     Preview: ${item.previewUrl.trim()}`);
  }
  return lines.join('\n');
}

function fmtEvidenciasPorFase(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const porFase = parseEvidenciasStored(raw);
  const bloques: string[] = [];
  for (const { key, label } of EVIDENCIA_FASES) {
    const arr = porFase[key] ?? [];
    if (arr.length === 0) continue;
    bloques.push(
      `${label} (${arr.length}):\n${arr.map((it, i) => fmtEvidenciaItemDetalle(i, it)).join('\n')}`,
    );
  }
  if (bloques.length === 0 && raw.trim()) {
    return `Evidencias (raw JSON no estándar, primeros 2000 caracteres):\n${raw.trim().slice(0, 2000)}`;
  }
  return bloques.length ? bloques.join('\n\n') : null;
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
        jornadaCatalogo: { select: { id: true, nombre: true, horaInicio: true, horaFin: true } },
        user: { select: { id: true, name: true, identification: true, email: true, role: true } },
        frenteObraCatalogo: { select: { id: true, nombre: true } },
        contratistaCatalog: { select: { id: true, nombre: true, cedula: true } },
        encargadoReporteCatalog: { select: { id: true, nombre: true, cedula: true } },
        cargoCatalog: { select: { id: true, nombre: true, consecutivo: true } },
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
        bitacoraClimas: { orderBy: { createdAt: 'asc' } },
      },
    });

    const rows = informes.map((inf) => {
      const obraCodigo = inf.project?.code ?? '';
      const obraNombre = inf.project?.name ?? '';
      const fecha = ymdUtc(inf.date);
      const jornadaNombre = inf.jornadaCatalogo
        ? `${inf.jornadaCatalogo.nombre} (${inf.jornadaCatalogo.horaInicio}–${inf.jornadaCatalogo.horaFin})`
        : '— (sin jornada)';

      const metadatos = joinBlocks(
        [
          `ID informe: ${inf.id}`,
          `ID obra: ${inf.projectId}`,
          `ID jornada catálogo: ${inf.jornadaCatalogoId ?? '—'}`,
          `Usuario informe (ID): ${inf.userId}`,
          inf.user
            ? `Usuario: ${inf.user.name} · CC/NIT ${inf.user.identification} · ${inf.user.email} · Rol ${inf.user.role}`
            : null,
          `Creado: ${inf.createdAt.toISOString()} · Actualizado: ${inf.updatedAt.toISOString()}`,
          inf.informeCerrado && inf.cerradoEn ? `Cerrado en: ${inf.cerradoEn.toISOString()}` : null,
        ],
        '\n',
      );

      const datosGenerales = joinBlocks(
        [
          metadatos,
          inf.informeConsecutivo != null ? `Consecutivo informe: ${inf.informeConsecutivo}` : null,
          inf.informeNo ? `Informe N°: ${inf.informeNo}` : null,
          inf.centroTrabajoConsecutivo != null ? `Consecutivo centro trabajo: ${inf.centroTrabajoConsecutivo}` : null,
          inf.centroTrabajo ? `Centro de trabajo: ${inf.centroTrabajo}` : null,
          inf.frenteObra ? `Frente (texto): ${inf.frenteObra}` : null,
          inf.frenteObraCatalogoId
            ? `Frente catálogo ID: ${inf.frenteObraCatalogoId}${inf.frenteObraCatalogo ? ` · ${inf.frenteObraCatalogo.nombre}` : ''}`
            : null,
          inf.contratista ? `Contratista (texto): ${inf.contratista}` : null,
          inf.contratistaCatalogoId
            ? `Contratista catálogo ID: ${inf.contratistaCatalogoId}${
                inf.contratistaCatalog
                  ? ` · ${inf.contratistaCatalog.nombre} · NIT/CC ${inf.contratistaCatalog.cedula}`
                  : ''
              }`
            : null,
          inf.encargadoReporte ? `Encargado (texto): ${inf.encargadoReporte}` : null,
          inf.encargadoReporteCatalogoId
            ? `Encargado catálogo ID: ${inf.encargadoReporteCatalogoId}${
                inf.encargadoReporteCatalog
                  ? ` · ${inf.encargadoReporteCatalog.nombre} · ${inf.encargadoReporteCatalog.cedula}`
                  : ''
              }`
            : null,
          inf.cargo ? `Cargo (texto): ${inf.cargo}` : null,
          inf.cargoCatalogoId
            ? `Cargo catálogo ID: ${inf.cargoCatalogoId}${
                inf.cargoCatalog
                  ? ` · ${inf.cargoCatalog.nombre}${inf.cargoCatalog.consecutivo != null ? ` · cons. ${inf.cargoCatalog.consecutivo}` : ''}`
                  : ''
              }`
            : null,
          inf.horaEntrada || inf.horaSalida
            ? `Horario obra: ${inf.horaEntrada ?? '—'} – ${inf.horaSalida ?? '—'}`
            : null,
          `Informe cerrado: ${fmtSiNo(inf.informeCerrado)}`,
        ],
        '\n',
      );

      const climaBitacora =
        inf.bitacoraClimas.length > 0
          ? inf.bitacoraClimas
              .map(
                (c, i) =>
                  `${i + 1}. ${c.tipo} · Temp ${fmtNum(c.temperatura)} · Hum ${fmtNum(c.humedad)} · Obs: ${c.observaciones ?? '—'}\n${fmtGeoLine('   GPS clima', c.latitud, c.longitud, c.precisionGps, null, c.capturadoEn) ?? '   (sin GPS clima)'}`,
              )
              .join('\n\n')
          : null;

      const jornadaCondiciones = joinBlocks(
        [
          climaBitacora ? `Clima (bitácora / registro diario):\n${climaBitacora}` : null,
          inf.condiciones ? `Condiciones de obra: ${inf.condiciones}` : null,
          inf.actividades ? `Actividades (texto libre del informe): ${inf.actividades}` : null,
          inf.incidentes ? `Incidentes: ${inf.incidentes}` : null,
          `Suspensión en cabecera (legacy): ${fmtSiNo(inf.huboSuspension)}${inf.motivoSuspension ? ` — ${inf.motivoSuspension}` : ''}`,
          inf.horaSuspension || inf.horaReinicio
            ? `Hora susp./reinicio cabecera: ${inf.horaSuspension ?? '—'} / ${inf.horaReinicio ?? '—'}`
            : null,
          inf.tipoClima ? `Tipo clima cabecera: ${inf.tipoClima}${inf.horasClima != null ? ` · ${inf.horasClima} h` : ''}` : null,
          inf.suspensiones.length > 0
            ? `Suspensiones (detalle completo):\n${inf.suspensiones
                .map((s, i) => {
                  const geo =
                    fmtGeoLine(
                      '  GPS imagen',
                      s.imagenLatitud,
                      s.imagenLongitud,
                      s.imagenPrecision,
                      s.imagenGeoEstado,
                      s.imagenTomadaEn,
                    ) ?? '';
                  return [
                    `  ${i + 1}. ${s.motivoSuspension}`,
                    `     Horas: ${s.horaSuspension} – ${s.horaReinicio}`,
                    s.tipoClima ? `     Clima fila: ${s.tipoClima} · ${fmtNum(s.horasClima)} h` : null,
                    s.imagenUrl ? `     Imagen: ${s.imagenUrl}` : null,
                    geo || null,
                    `     Orden: ${s.orden} · ID: ${s.id}`,
                  ]
                    .filter(Boolean)
                    .join('\n');
                })
                .join('\n\n')}`
            : null,
        ],
        '\n\n',
      );

      const personalTxt =
        inf.personal.length > 0
          ? inf.personal
              .map((p, i) => {
                const he =
                  p.horaEntrada || p.horaSalida
                    ? `Entrada/salida: ${p.horaEntrada ?? '—'} – ${p.horaSalida ?? '—'}`
                    : 'Entrada/salida: —';
                return [
                  `${i + 1}. ${p.nombre}`,
                  `   Cargo: ${p.cargo}`,
                  p.subcontratista ? `   Subcontratista: ${p.subcontratista}` : null,
                  `   ${he}`,
                  `   ID fila: ${p.id}`,
                ]
                  .filter(Boolean)
                  .join('\n');
              })
              .join('\n\n')
          : '—';

      const equiposTxt = joinBlocks(
        [
          inf.equipos.length > 0
            ? `Equipos:\n${inf.equipos
                .map((eq, i) => {
                  const hz = eq.horarios.length
                    ? eq.horarios
                        .map(
                          (h, j) =>
                            `     Horario ${j + 1}: ${h.horaIngreso}–${h.horaSalida} · ${h.horasTrabajadas} h (id ${h.id})`,
                        )
                        .join('\n')
                    : '     (sin horarios)';
                  const geo =
                    fmtGeoLine(
                      '   GPS equipo/foto',
                      eq.imagenLatitud,
                      eq.imagenLongitud,
                      eq.imagenPrecision,
                      eq.imagenGeoEstado,
                      eq.imagenTomadaEn,
                    ) ?? null;
                  return [
                    `  ${i + 1}. ${eq.descripcion}`,
                    eq.placaRef ? `     Placa/ref: ${eq.placaRef}` : null,
                    eq.propiedad ? `     Propiedad: ${eq.propiedad}` : null,
                    eq.estado ? `     Estado: ${eq.estado}` : null,
                    eq.observacion ? `     Observación: ${eq.observacion}` : null,
                    eq.horaIngreso || eq.horaSalida
                      ? `     Ingreso/salida equipo: ${eq.horaIngreso ?? '—'} – ${eq.horaSalida ?? '—'}`
                      : null,
                    eq.horasTrabajadas != null ? `     Horas trabajadas (total): ${eq.horasTrabajadas}` : null,
                    eq.imagenUrl ? `     Imagen URL: ${eq.imagenUrl}` : null,
                    geo,
                    `     ID: ${eq.id}`,
                    hz,
                  ]
                    .filter(Boolean)
                    .join('\n');
                })
                .join('\n\n')}`
            : null,
          inf.materialIngresos.length > 0
            ? `Ingresos materiales:\n${inf.materialIngresos
                .map((m, i) => {
                  const geo =
                    fmtGeoLine(
                      '  GPS',
                      m.imagenLatitud,
                      m.imagenLongitud,
                      m.imagenPrecision,
                      m.imagenGeoEstado,
                      m.imagenTomadaEn,
                    ) ?? null;
                  return [
                    `  ${i + 1}. ${m.tipoMaterial} · Proveedor: ${m.proveedor}`,
                    `     Remisión: ${m.noRemision} · Cant ${fmtNum(m.cantidad)} ${m.unidad}`,
                    m.observacion ? `     Obs: ${m.observacion}` : null,
                    m.imagenUrl ? `     Imagen: ${m.imagenUrl}` : null,
                    geo,
                    `     ID: ${m.id}`,
                  ]
                    .filter(Boolean)
                    .join('\n');
                })
                .join('\n\n')}`
            : null,
          inf.materialEntregas.length > 0
            ? `Entregas materiales:\n${inf.materialEntregas
                .map((m, i) => {
                  const geo =
                    fmtGeoLine(
                      '  GPS',
                      m.imagenLatitud,
                      m.imagenLongitud,
                      m.imagenPrecision,
                      m.imagenGeoEstado,
                      m.imagenTomadaEn,
                    ) ?? null;
                  return [
                    `  ${i + 1}. ${m.tipoMaterial} · ${fmtNum(m.cantidad)} ${m.unidad}`,
                    `     Contratista: ${m.contratista} · Firma recibido: ${fmtSiNo(m.firmaRecibido)}`,
                    m.observacion ? `     Obs: ${m.observacion}` : null,
                    m.imagenUrl ? `     Imagen: ${m.imagenUrl}` : null,
                    geo,
                    `     ID: ${m.id}`,
                  ]
                    .filter(Boolean)
                    .join('\n');
                })
                .join('\n\n')}`
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
                const geo =
                  fmtGeoLine(
                    '   GPS',
                    a.imagenLatitud,
                    a.imagenLongitud,
                    a.imagenPrecision,
                    a.imagenGeoEstado,
                    a.imagenTomadaEn,
                  ) ?? null;
                return [
                  `${i + 1}. PK: ${a.pk} · Abscisados: ${abs}`,
                  `   Ítem: ${a.itemContractual} · ${a.descripcion}`,
                  `   Unidad: ${a.unidadMedida} · Cantidad total: ${fmtNum(a.cantidadTotal)}`,
                  `   L×A×H: ${fmtNum(a.largo)} × ${fmtNum(a.ancho)} × ${fmtNum(a.altura)}`,
                  `   Marcó observación (flag): ${fmtSiNo(a.observacion)}`,
                  a.observacionTexto ? `   Texto observación: ${a.observacionTexto}` : null,
                  a.imagenUrl ? `   Imagen: ${a.imagenUrl}` : null,
                  geo,
                  `   ID: ${a.id}`,
                ]
                  .filter(Boolean)
                  .join('\n');
              })
              .join('\n\n')
          : '—';

      const calidadTxt = joinBlocks(
        [
          inf.ensayosObra.length > 0
            ? `Ensayos:\n${inf.ensayosObra
                .map((e, i) => {
                  const geo =
                    fmtGeoLine(
                      '  GPS',
                      e.imagenLatitud,
                      e.imagenLongitud,
                      e.imagenPrecision,
                      e.imagenGeoEstado,
                      e.imagenTomadaEn,
                    ) ?? null;
                  return [
                    `  ${i + 1}. ${e.tipoEnsayo} · Material/actividad: ${e.materialActividad}`,
                    `     Muestra: ${e.idMuestra} · Lab: ${e.laboratorio} · Loc: ${e.localizacion}`,
                    e.descripcion ? `     Descripción: ${e.descripcion}` : null,
                    `     Resultado: ${e.resultado}`,
                    e.observacion ? `     Obs: ${e.observacion}` : null,
                    e.imagenUrl ? `     Imagen: ${e.imagenUrl}` : null,
                    geo,
                    `     ID: ${e.id}`,
                  ]
                    .filter(Boolean)
                    .join('\n');
                })
                .join('\n\n')}`
            : null,
          inf.danosRedesObra.length > 0
            ? `Daños a redes:\n${inf.danosRedesObra
                .map((d, i) => {
                  const geo =
                    fmtGeoLine(
                      '  GPS',
                      d.imagenLatitud,
                      d.imagenLongitud,
                      d.imagenPrecision,
                      d.imagenGeoEstado,
                      d.imagenTomadaEn,
                    ) ?? null;
                  return [
                    `  ${i + 1}. ${d.tipoDano} · ${d.direccion}`,
                    `     Entidad: ${d.entidad} · Reporte N°: ${d.noReporte}`,
                    d.horaReporte ? `     Hora reporte: ${d.horaReporte}` : null,
                    d.observacion ? `     Obs: ${d.observacion}` : null,
                    d.imagenUrl ? `     Imagen: ${d.imagenUrl}` : null,
                    geo,
                    `     ID: ${d.id}`,
                  ]
                    .filter(Boolean)
                    .join('\n');
                })
                .join('\n\n')}`
            : null,
          inf.noConformidadesObra.length > 0
            ? `No conformidades:\n${inf.noConformidadesObra
                .map((n, i) => {
                  const geo =
                    fmtGeoLine(
                      '  GPS',
                      n.imagenLatitud,
                      n.imagenLongitud,
                      n.imagenPrecision,
                      n.imagenGeoEstado,
                      n.imagenTomadaEn,
                    ) ?? null;
                  return [
                    `  ${i + 1}. ${n.noConformidad} · Estado: ${n.estado}`,
                    n.detalle ? `     Detalle: ${n.detalle}` : null,
                    n.origen ? `     Origen: ${n.origen}` : null,
                    n.imagenUrl ? `     Imagen: ${n.imagenUrl}` : null,
                    geo,
                    `     ID: ${n.id}`,
                  ]
                    .filter(Boolean)
                    .join('\n');
                })
                .join('\n\n')}`
            : null,
        ],
        '\n\n',
      );

      const fotosEvidencias = fmtEvidenciasPorFase(inf.evidenciasUrl);

      const evidenciasTxt = joinBlocks(
        [
          `Registro fotográfico (¿se cargó?): ${inf.registroFotografico == null ? '—' : fmtSiNo(inf.registroFotografico)}`,
          fotosEvidencias ? `Evidencias fotográficas por fase:\n${fotosEvidencias}` : null,
          inf.observacionesGenerales ? `Observaciones generales:\n${inf.observacionesGenerales}` : null,
          inf.observaciones ? `Observaciones (campo adicional):\n${inf.observaciones}` : null,
          inf.firmas.length > 0
            ? `Firmas (detalle completo):\n${inf.firmas
                .map((f) =>
                  [
                    `  · Slot: ${f.slot}`,
                    `    Firmado: ${fmtSiNo(f.firmado)}`,
                    `    Código ingresado: ${f.codigo ? f.codigo : '(vacío)'}`,
                    f.observacion ? `    Observación: ${f.observacion}` : '    Observación: —',
                    f.firmadoEn ? `    Firmado en: ${f.firmadoEn.toISOString()}` : '    Firmado en: —',
                    `    ID firma: ${f.id}`,
                  ].join('\n'),
                )
                .join('\n\n')}`
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
