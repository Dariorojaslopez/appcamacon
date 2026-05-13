import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import {
  EVIDENCIA_FASES,
  evidenciaItemUrl,
  parseEvidenciasStored,
  type EvidenciaItem,
} from '../../../../src/lib/evidenciasUrlPayload';
import { buildConsolidadoExportWorkbookBuffer } from '../../../../src/lib/consolidadoExportExcel';
import { FIRMA_SLOT_KEYS, FIRMA_SLOT_LABELS, type FirmaSlotKey } from '../../../../src/shared/firmaPolicies';

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
  const lines = [`  ${idx + 1}. Imagen (enlace): ${url || '—'}`];
  if (typeof item === 'object' && item) {
    const g = fmtGeoLine(
      '     Ubicación (foto)',
      item.imagenLatitud,
      item.imagenLongitud,
      item.imagenPrecision,
      item.imagenGeoEstado,
      item.imagenTomadaEn ?? null,
    );
    if (g) lines.push(g);
    if (item.previewUrl?.trim()) lines.push(`     Miniatura (enlace): ${item.previewUrl.trim()}`);
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

function fmtFechaInformeEs(ymd: string): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtFechaHoraEs(d: Date): string {
  return d.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

function formatHorasTotalesOperacion(
  horaEntrada: string | null | undefined,
  horaSalida: string | null | undefined,
): string {
  const entrada = (horaEntrada ?? '').trim();
  const salida = (horaSalida ?? '').trim();
  if (!entrada || !salida) return '—';
  const [eh, em] = entrada.split(':').map(Number);
  const [sh, sm] = salida.split(':').map(Number);
  if (![eh, em, sh, sm].every((n) => Number.isFinite(n))) return '—';
  let min = sh * 60 + sm - (eh * 60 + em);
  if (min < 0) min += 24 * 60;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

function etiquetaFirmaSlot(slot: string): string {
  if ((FIRMA_SLOT_KEYS as readonly string[]).includes(slot)) {
    return FIRMA_SLOT_LABELS[slot as FirmaSlotKey];
  }
  return slot;
}

function etiquetaPropiedadEquipo(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  if (s === 'PROPIO') return 'Propio';
  if (s === 'ALQUILADO') return 'Alquilado';
  return s || '—';
}

function etiquetaEstadoEquipo(v: string | null | undefined): string {
  const s = (v ?? '').trim();
  if (s === 'OPERATIVO') return 'Operativo';
  if (s === 'EN_MANTENIMIENTO') return 'En mantenimiento';
  if (s === 'FUERA_DE_SERVICIO') return 'Fuera de servicio';
  return s || '—';
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

      const frenteLine =
        inf.frenteObraCatalogo?.nombre?.trim() || inf.frenteObra?.trim() || '—';

      const contratistaLine = inf.contratistaCatalog
        ? `${String(inf.contratistaCatalog.cedula ?? '').trim() || '—'} - ${String(inf.contratistaCatalog.nombre ?? '').trim() || '—'}`
        : inf.contratista?.trim() || '—';

      const encargadoLine = inf.encargadoReporteCatalog
        ? `${String(inf.encargadoReporteCatalog.cedula ?? '').trim() || '—'} - ${String(inf.encargadoReporteCatalog.nombre ?? '').trim() || '—'}`
        : inf.encargadoReporte?.trim() || '—';

      const cargoLine = inf.cargoCatalog?.nombre?.trim()
        ? `${inf.cargoCatalog.consecutivo != null ? `${inf.cargoCatalog.consecutivo}. ` : ''}${inf.cargoCatalog.nombre.trim()}`
        : inf.cargo?.trim() || '—';

      const horasTotalesStr = formatHorasTotalesOperacion(inf.horaEntrada, inf.horaSalida);

      const registradoPorLine = inf.user
        ? `${inf.user.name?.trim() || '—'}${inf.user.identification ? ` · ${String(inf.user.identification).trim()}` : ''}${inf.user.role ? ` · Rol: ${inf.user.role}` : ''}`
        : '—';

      const estadoInformeLine = inf.informeCerrado
        ? `Estado del informe: Cerrado${inf.cerradoEn ? ` · ${fmtFechaHoraEs(inf.cerradoEn)}` : ''}`
        : 'Estado del informe: Abierto';

      const datosGenerales = joinBlocks(
        [
          `FECHA DE REPORTE: ${fmtFechaInformeEs(fecha)}`,
          `INFORME N°: ${inf.informeNo?.trim() || '—'}`,
          `CENTRO DE TRABAJO: ${inf.centroTrabajo?.trim() || '—'}`,
          `FRENTE DE OBRA: ${frenteLine}`,
          `CONTRATISTA: ${contratistaLine}`,
          `ENCARGADO DE REPORTE: ${encargadoLine}`,
          `CARGO: ${cargoLine}`,
          `HORA DE ENTRADA: ${inf.horaEntrada?.trim() || '—'}`,
          `HORA DE SALIDA: ${inf.horaSalida?.trim() || '—'}`,
          `HORAS TOTALES DE OPERACIÓN: ${horasTotalesStr}`,
          '',
          `Registrado por: ${registradoPorLine}`,
          estadoInformeLine,
        ],
        '\n',
      );

      const climaBitacora =
        inf.bitacoraClimas.length > 0
          ? inf.bitacoraClimas
              .map(
                (c, i) =>
                  `Registro de clima ${i + 1}: ${c.tipo} · Temperatura: ${fmtNum(c.temperatura)} °C · Humedad: ${fmtNum(c.humedad)} % · Observaciones: ${c.observaciones ?? '—'}\n${fmtGeoLine('   Ubicación (clima)', c.latitud, c.longitud, c.precisionGps, null, c.capturadoEn) ?? '   (sin ubicación GPS)'}`,
              )
              .join('\n\n')
          : null;

      const franjasClimaDia =
        inf.franjaClimaMananaCodigo || inf.franjaClimaTardeCodigo || inf.franjaClimaNocheCodigo
          ? joinBlocks(
              [
                inf.franjaClimaMananaCodigo ? `Mañana: ${inf.franjaClimaMananaCodigo}` : null,
                inf.franjaClimaTardeCodigo ? `Tarde: ${inf.franjaClimaTardeCodigo}` : null,
                inf.franjaClimaNocheCodigo ? `Noche: ${inf.franjaClimaNocheCodigo}` : null,
              ],
              '\n',
            )
          : null;

      const jornadaCondiciones = joinBlocks(
        [
          franjasClimaDia ? `CONDICIÓN CLIMÁTICA POR FRANJA\n${franjasClimaDia}` : null,
          climaBitacora ? `REGISTRO DE CLIMA (BITÁCORA)\n${climaBitacora}` : null,
          inf.condiciones ? `Condiciones de obra:\n${inf.condiciones}` : null,
          inf.actividades ? `Actividades u observaciones (texto del día):\n${inf.actividades}` : null,
          inf.incidentes ? `Incidentes:\n${inf.incidentes}` : null,
          `¿Hubo suspensión (resumen en cabecera)?: ${fmtSiNo(inf.huboSuspension)}${inf.motivoSuspension ? `\nMotivo: ${inf.motivoSuspension}` : ''}`,
          inf.horaSuspension || inf.horaReinicio
            ? `Horas suspensión / reinicio (cabecera): ${inf.horaSuspension ?? '—'} / ${inf.horaReinicio ?? '—'}`
            : null,
          inf.tipoClima
            ? `Tipo de clima (cabecera): ${inf.tipoClima}${inf.horasClima != null ? ` · Horas: ${fmtNum(inf.horasClima)} h` : ''}`
            : null,
          inf.suspensiones.length > 0
            ? `Suspensiones registradas\n${inf.suspensiones
                .map((s, i) => {
                  const geo =
                    fmtGeoLine(
                      '  Ubicación (imagen)',
                      s.imagenLatitud,
                      s.imagenLongitud,
                      s.imagenPrecision,
                      s.imagenGeoEstado,
                      s.imagenTomadaEn,
                    ) ?? '';
                  return [
                    `  ${i + 1}. Motivo: ${s.motivoSuspension}`,
                    `     Desde – hasta: ${s.horaSuspension} – ${s.horaReinicio}`,
                    s.tipoClima ? `     Tipo de clima: ${s.tipoClima} · Horas: ${fmtNum(s.horasClima)} h` : null,
                    s.imagenUrl ? `     Foto (enlace): ${s.imagenUrl}` : null,
                    geo || null,
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
                    ? `Horario: ${p.horaEntrada ?? '—'} – ${p.horaSalida ?? '—'}`
                    : 'Horario: —';
                return [
                  `Persona en obra ${i + 1}`,
                  `  Nombre: ${p.nombre}`,
                  `  Cargo: ${p.cargo}`,
                  p.subcontratista ? `  Subcontratista: ${p.subcontratista}` : null,
                  `  ${he}`,
                ]
                  .filter(Boolean)
                  .join('\n');
              })
              .join('\n\n')
          : '—';

      const equiposTxt = joinBlocks(
        [
          inf.equipos.length > 0
            ? `Maquinaria y equipos\n${inf.equipos
                .map((eq, i) => {
                  const hz = eq.horarios.length
                    ? eq.horarios
                        .map(
                          (h, j) =>
                            `     Horario ${j + 1}: ${h.horaIngreso} – ${h.horaSalida} · ${h.horasTrabajadas} h`,
                        )
                        .join('\n')
                    : '     (sin horarios detallados)';
                  const geo =
                    fmtGeoLine(
                      '   Ubicación (foto del equipo)',
                      eq.imagenLatitud,
                      eq.imagenLongitud,
                      eq.imagenPrecision,
                      eq.imagenGeoEstado,
                      eq.imagenTomadaEn,
                    ) ?? null;
                  return [
                    `  Equipo ${i + 1}: ${eq.descripcion}`,
                    eq.placaRef ? `     Placa / referencia: ${eq.placaRef}` : null,
                    eq.propiedad ? `     Propio / alquilado: ${etiquetaPropiedadEquipo(eq.propiedad)}` : null,
                    eq.estado ? `     Estado: ${etiquetaEstadoEquipo(eq.estado)}` : null,
                    eq.observacion ? `     Observación: ${eq.observacion}` : null,
                    eq.horaIngreso || eq.horaSalida
                      ? `     Resumen horario (equipo): ${eq.horaIngreso ?? '—'} – ${eq.horaSalida ?? '—'}`
                      : null,
                    eq.horasTrabajadas != null ? `     Horas trabajadas (total): ${eq.horasTrabajadas}` : null,
                    eq.imagenUrl ? `     Registro fotográfico (enlace): ${eq.imagenUrl}` : null,
                    geo,
                    hz,
                  ]
                    .filter(Boolean)
                    .join('\n');
                })
                .join('\n\n')}`
            : null,
          inf.materialIngresos.length > 0
            ? `Ingreso de materiales\n${inf.materialIngresos
                .map((m, i) => {
                  const geo =
                    fmtGeoLine(
                      '  Ubicación (foto)',
                      m.imagenLatitud,
                      m.imagenLongitud,
                      m.imagenPrecision,
                      m.imagenGeoEstado,
                      m.imagenTomadaEn,
                    ) ?? null;
                  return [
                    `  Ingreso ${i + 1}: ${m.tipoMaterial}`,
                    `     Proveedor: ${m.proveedor}`,
                    `     N° remisión: ${m.noRemision} · Cantidad: ${fmtNum(m.cantidad)} ${m.unidad}`,
                    m.observacion ? `     Observación: ${m.observacion}` : null,
                    m.imagenUrl ? `     Foto (enlace): ${m.imagenUrl}` : null,
                    geo,
                  ]
                    .filter(Boolean)
                    .join('\n');
                })
                .join('\n\n')}`
            : null,
          inf.materialEntregas.length > 0
            ? `Entregas de material\n${inf.materialEntregas
                .map((m, i) => {
                  const geo =
                    fmtGeoLine(
                      '  Ubicación (foto)',
                      m.imagenLatitud,
                      m.imagenLongitud,
                      m.imagenPrecision,
                      m.imagenGeoEstado,
                      m.imagenTomadaEn,
                    ) ?? null;
                  return [
                    `  Entrega ${i + 1}: ${m.tipoMaterial}`,
                    `     Cantidad: ${fmtNum(m.cantidad)} ${m.unidad}`,
                    `     Contratista: ${m.contratista} · ¿Firma recibido?: ${fmtSiNo(m.firmaRecibido)}`,
                    m.observacion ? `     Observación: ${m.observacion}` : null,
                    m.imagenUrl ? `     Foto (enlace): ${m.imagenUrl}` : null,
                    geo,
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
                    '   Ubicación (foto)',
                    a.imagenLatitud,
                    a.imagenLongitud,
                    a.imagenPrecision,
                    a.imagenGeoEstado,
                    a.imagenTomadaEn,
                  ) ?? null;
                return [
                  `Actividad ${i + 1}`,
                  `  Punto kilométrico (PK): ${a.pk}`,
                  `  Abscisados: ${abs}`,
                  `  Ítem contractual: ${a.itemContractual}`,
                  `  Descripción: ${a.descripcion}`,
                  `  Unidad de medida: ${a.unidadMedida ?? '—'} · Cantidad total: ${fmtNum(a.cantidadTotal)}`,
                  `  Largo × ancho × altura: ${fmtNum(a.largo)} × ${fmtNum(a.ancho)} × ${fmtNum(a.altura)}`,
                  `  ¿Marcó observación?: ${fmtSiNo(a.observacion)}`,
                  a.observacionTexto ? `  Texto de la observación: ${a.observacionTexto}` : null,
                  a.imagenUrl ? `  Foto (enlace): ${a.imagenUrl}` : null,
                  geo,
                ]
                  .filter(Boolean)
                  .join('\n');
              })
              .join('\n\n')
          : '—';

      const calidadTxt = joinBlocks(
        [
          inf.ensayosObra.length > 0
            ? `Ensayos\n${inf.ensayosObra
                .map((e, i) => {
                  const geo =
                    fmtGeoLine(
                      '  Ubicación (foto)',
                      e.imagenLatitud,
                      e.imagenLongitud,
                      e.imagenPrecision,
                      e.imagenGeoEstado,
                      e.imagenTomadaEn,
                    ) ?? null;
                  return [
                    `  Ensayo ${i + 1}: ${e.tipoEnsayo}`,
                    `     Material o actividad: ${e.materialActividad}`,
                    `     ID muestra: ${e.idMuestra} · Laboratorio: ${e.laboratorio} · Localización: ${e.localizacion}`,
                    e.descripcion ? `     Descripción: ${e.descripcion}` : null,
                    `     Resultado: ${e.resultado}`,
                    e.observacion ? `     Observación: ${e.observacion}` : null,
                    e.imagenUrl ? `     Foto (enlace): ${e.imagenUrl}` : null,
                    geo,
                  ]
                    .filter(Boolean)
                    .join('\n');
                })
                .join('\n\n')}`
            : null,
          inf.danosRedesObra.length > 0
            ? `Daños a redes\n${inf.danosRedesObra
                .map((d, i) => {
                  const geo =
                    fmtGeoLine(
                      '  Ubicación (foto)',
                      d.imagenLatitud,
                      d.imagenLongitud,
                      d.imagenPrecision,
                      d.imagenGeoEstado,
                      d.imagenTomadaEn,
                    ) ?? null;
                  return [
                    `  Registro ${i + 1}: ${d.tipoDano}`,
                    `     Dirección: ${d.direccion}`,
                    `     Entidad: ${d.entidad} · N° reporte: ${d.noReporte}`,
                    d.horaReporte ? `     Hora del reporte: ${d.horaReporte}` : null,
                    d.observacion ? `     Observación: ${d.observacion}` : null,
                    d.imagenUrl ? `     Foto (enlace): ${d.imagenUrl}` : null,
                    geo,
                  ]
                    .filter(Boolean)
                    .join('\n');
                })
                .join('\n\n')}`
            : null,
          inf.noConformidadesObra.length > 0
            ? `No conformidades\n${inf.noConformidadesObra
                .map((n, i) => {
                  const geo =
                    fmtGeoLine(
                      '  Ubicación (foto)',
                      n.imagenLatitud,
                      n.imagenLongitud,
                      n.imagenPrecision,
                      n.imagenGeoEstado,
                      n.imagenTomadaEn,
                    ) ?? null;
                  return [
                    `  Caso ${i + 1}: ${n.noConformidad}`,
                    `     Estado: ${n.estado}`,
                    n.detalle ? `     Detalle: ${n.detalle}` : null,
                    n.origen ? `     Origen: ${n.origen}` : null,
                    n.imagenUrl ? `     Foto (enlace): ${n.imagenUrl}` : null,
                    geo,
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
          `¿Se cargó registro fotográfico?: ${inf.registroFotografico == null ? '—' : fmtSiNo(inf.registroFotografico)}`,
          fotosEvidencias ? `Carga de fotografías (Antes / Durante / Después)\n${fotosEvidencias}` : null,
          inf.observacionesGenerales ? `Observaciones generales:\n${inf.observacionesGenerales}` : null,
          inf.observaciones ? `Observaciones adicionales:\n${inf.observaciones}` : null,
          inf.firmas.length > 0
            ? `Firmas y responsables\n${inf.firmas
                .map((f) =>
                  [
                    `  ${etiquetaFirmaSlot(f.slot)}`,
                    `     Estado: ${f.firmado ? 'Firma completa' : 'Pendiente'}`,
                    f.observacion ? `     Observación: ${f.observacion}` : '     Observación: —',
                    f.firmadoEn ? `     Fecha de registro: ${fmtFechaHoraEs(f.firmadoEn)}` : null,
                  ]
                    .filter(Boolean)
                    .join('\n'),
                )
                .join('\n\n')}`
            : null,
        ],
        '\n\n',
      );

      return {
        informeId: inf.id,
        informeCerrado: Boolean(inf.informeCerrado),
        cerradoEn: inf.cerradoEn ? inf.cerradoEn.toISOString() : null,
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

    const format = searchParams.get('format')?.trim().toLowerCase();
    if (format === 'xlsx') {
      const buf = await buildConsolidadoExportWorkbookBuffer(rows);
      const safeFrom = dateFrom.replace(/[^\d-]/g, '') || 'desde';
      const safeTo = dateTo.replace(/[^\d-]/g, '') || 'hasta';
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="informes_diarios_${safeFrom}_${safeTo}.xlsx"`,
        },
      });
    }

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
