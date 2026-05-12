import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from './prisma';
import {
  EVIDENCIA_FASES,
  evidenciaItemUrl,
  parseEvidenciasStored,
  type EvidenciaItem,
} from './evidenciasUrlPayload';

type DbClient = typeof prisma | Prisma.TransactionClient;

type RequestContext = {
  ip: string | null;
  dispositivo: string;
  navegador: string;
  latitud?: number | null;
  longitud?: number | null;
  precisionGps?: number | null;
};

type ActorContext = {
  userId?: string | null;
  userRole?: string | null;
  userName?: string | null;
};

type BitacoraEvidence = {
  url: string;
  previewUrl?: string | null;
  fase?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  precisionGps?: number | null;
  geoEstado?: string | null;
  tomadaEn?: Date | null;
};

type EventDraft = {
  tipoEvento: string;
  moduloOrigen: string;
  descripcion: string;
  fecha: Date;
  hora: string;
  timestampUtc?: Date;
  latitud?: number | null;
  longitud?: number | null;
  precisionGps?: number | null;
  direccionAproximada?: string | null;
  frenteObraId?: string | null;
  contratistaId?: string | null;
  evidenciaFotografica?: string | null;
  firmaAsociada?: string | null;
  observaciones?: string | null;
  sourceModel?: string | null;
  sourceId?: string | null;
  payload?: unknown;
  evidencias?: BitacoraEvidence[];
  firma?: {
    slot: string;
    firmante?: string | null;
    rolFirmante?: string | null;
    firmadoEn?: Date | null;
  } | null;
};

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

function hashIntegridad(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeDateOnly(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function horaFromDate(date: Date | string | null | undefined): string {
  if (!date) return new Date().toISOString().slice(11, 16);
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(11, 16);
  return d.toISOString().slice(11, 16);
}

function normalizeHora(value: string | null | undefined, fallback?: Date | string | null): string {
  const v = String(value ?? '').trim();
  if (/^\d{1,2}:\d{2}/.test(v)) {
    const [h, m] = v.split(':');
    return `${h.padStart(2, '0')}:${m.slice(0, 2)}`;
  }
  return horaFromDate(fallback);
}

function minutosDesdeMedianoche(hora: string): number | null {
  const m = hora.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function horaDentroDeJornada(hora: string, inicio?: string | null, fin?: string | null): boolean | null {
  if (!inicio || !fin) return null;
  const t = minutosDesdeMedianoche(hora);
  const a = minutosDesdeMedianoche(normalizeHora(inicio));
  const b = minutosDesdeMedianoche(normalizeHora(fin));
  if (t == null || a == null || b == null) return null;
  if (a <= b) return t >= a && t <= b;
  return t >= a || t <= b;
}

function evidenciaFromItem(item: EvidenciaItem, fase?: string): BitacoraEvidence | null {
  const url = evidenciaItemUrl(item).trim();
  if (!url) return null;
  if (typeof item === 'string') return { url, fase };
  return {
    url,
    previewUrl: item.previewUrl ?? null,
    fase,
    latitud: item.imagenLatitud ?? null,
    longitud: item.imagenLongitud ?? null,
    precisionGps: item.imagenPrecision ?? null,
    geoEstado: item.imagenGeoEstado ?? null,
    tomadaEn: item.imagenTomadaEn ? new Date(item.imagenTomadaEn) : null,
  };
}

function evidenceFromRecord(record: {
  imagenUrl?: string | null;
  imagenLatitud?: number | null;
  imagenLongitud?: number | null;
  imagenPrecision?: number | null;
  imagenGeoEstado?: string | null;
  imagenTomadaEn?: Date | string | null;
}): BitacoraEvidence[] {
  if (!record.imagenUrl) return [];
  return [
    {
      url: record.imagenUrl,
      latitud: record.imagenLatitud ?? null,
      longitud: record.imagenLongitud ?? null,
      precisionGps: record.imagenPrecision ?? null,
      geoEstado: record.imagenGeoEstado ?? null,
      tomadaEn: record.imagenTomadaEn ? new Date(record.imagenTomadaEn) : null,
    },
  ];
}

export function getBitacoraRequestContext(req: NextRequest): RequestContext {
  const ua = req.headers.get('user-agent') ?? '';
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || req.headers.get('x-real-ip') || null;
  const navegador = /edg/i.test(ua)
    ? 'Edge'
    : /chrome/i.test(ua)
      ? 'Chrome'
      : /safari/i.test(ua)
        ? 'Safari'
        : /firefox/i.test(ua)
          ? 'Firefox'
          : 'Desconocido';
  const dispositivo = /mobile|android|iphone|ipad/i.test(ua) ? 'Móvil' : 'Escritorio';
  const n = (header: string) => {
    const value = Number(req.headers.get(header));
    return Number.isFinite(value) ? value : null;
  };
  return {
    ip,
    dispositivo,
    navegador,
    latitud: n('x-sigocc-latitude'),
    longitud: n('x-sigocc-longitude'),
    precisionGps: n('x-sigocc-accuracy'),
  };
}

function detectarInconsistencias(evento: EventDraft, jornada?: { horaInicio: string; horaFin: string } | null) {
  const out: Array<{ codigo: string; descripcion: string }> = [];
  const enJornada = horaDentroDeJornada(evento.hora, jornada?.horaInicio, jornada?.horaFin);
  if (enJornada === false) {
    out.push({
      codigo: 'FUERA_DE_HORARIO',
      descripcion: `Evento registrado fuera del horario de jornada (${jornada?.horaInicio} - ${jornada?.horaFin}).`,
    });
  }
  if (
    typeof evento.latitud === 'number' &&
    typeof evento.longitud === 'number' &&
    (evento.latitud < -5 || evento.latitud > 13 || evento.longitud < -82 || evento.longitud > -66)
  ) {
    out.push({
      codigo: 'UBICACION_SOSPECHOSA',
      descripcion: 'La ubicación GPS parece estar fuera del rango esperado para Colombia.',
    });
  }
  return out;
}

async function createEvento(
  db: DbClient,
  ctx: RequestContext,
  actor: Required<ActorContext>,
  projectId: string,
  informeId: string,
  jornada: { horaInicio: string; horaFin: string } | null | undefined,
  draft: EventDraft,
) {
  const evidencias = draft.evidencias ?? [];
  const firstEvidence = evidencias[0];
  const latitud = draft.latitud ?? firstEvidence?.latitud ?? ctx.latitud ?? null;
  const longitud = draft.longitud ?? firstEvidence?.longitud ?? ctx.longitud ?? null;
  const precisionGps = draft.precisionGps ?? firstEvidence?.precisionGps ?? ctx.precisionGps ?? null;
  const hashPayload = {
    ...draft,
    usuarioId: actor.userId,
    rolUsuario: actor.userRole,
    projectId,
    informeId,
    latitud,
    longitud,
    precisionGps,
  };
  const inconsistencias = detectarInconsistencias({ ...draft, latitud, longitud, precisionGps }, jornada);
  const evento = await db.bitacoraEvento.create({
    data: {
      tipoEvento: draft.tipoEvento,
      moduloOrigen: draft.moduloOrigen,
      descripcion: draft.descripcion,
      usuarioId: actor.userId,
      usuario: actor.userName,
      rolUsuario: actor.userRole,
      fecha: normalizeDateOnly(draft.fecha),
      hora: draft.hora,
      timestampUtc: draft.timestampUtc ?? new Date(),
      latitud,
      longitud,
      precisionGps,
      direccionAproximada: draft.direccionAproximada ?? null,
      dispositivo: ctx.dispositivo,
      navegador: ctx.navegador,
      ip: ctx.ip,
      projectId,
      informeId,
      frenteObraId: draft.frenteObraId ?? null,
      contratistaId: draft.contratistaId ?? null,
      evidenciaFotografica: draft.evidenciaFotografica ?? firstEvidence?.url ?? null,
      firmaAsociada: draft.firmaAsociada ?? draft.firma?.slot ?? null,
      observaciones: draft.observaciones ?? null,
      estado: inconsistencias.length > 0 ? 'OBSERVADO' : 'ACTIVO',
      hashIntegridad: hashIntegridad(hashPayload),
      sourceModel: draft.sourceModel ?? null,
      sourceId: draft.sourceId ?? null,
      payload: asJson(draft.payload ?? {}),
      inconsistencias: inconsistencias.length > 0 ? asJson(inconsistencias) : undefined,
    },
    select: { id: true },
  });

  if (evidencias.length > 0) {
    await db.bitacoraEvidencia.createMany({
      data: evidencias.map((e) => ({
        eventoId: evento.id,
        url: e.url,
        previewUrl: e.previewUrl ?? null,
        fase: e.fase ?? null,
        latitud: e.latitud ?? null,
        longitud: e.longitud ?? null,
        precisionGps: e.precisionGps ?? null,
        geoEstado: e.geoEstado ?? null,
        tomadaEn: e.tomadaEn ?? null,
      })),
    });
  }

  if (draft.firma) {
    await db.bitacoraFirma.create({
      data: {
        eventoId: evento.id,
        slot: draft.firma.slot,
        firmante: draft.firma.firmante ?? actor.userName,
        rolFirmante: draft.firma.rolFirmante ?? actor.userRole,
        firmadoEn: draft.firma.firmadoEn ?? null,
        hashFirma: hashIntegridad({ eventoId: evento.id, firma: draft.firma }),
      },
    });
  }

  await db.bitacoraAuditoria.create({
    data: {
      eventoId: evento.id,
      accion: 'SYNC',
      tabla: draft.sourceModel ?? draft.moduloOrigen,
      registroId: draft.sourceId ?? informeId,
      valorNuevo: asJson(draft.payload ?? {}),
      usuarioId: actor.userId,
      usuario: actor.userName,
      rolUsuario: actor.userRole,
      ip: ctx.ip,
      latitud,
      longitud,
    },
  });
}

export async function syncBitacoraFromInforme({
  informeId,
  req,
  userId,
  userRole,
}: {
  informeId: string;
  req: NextRequest;
  userId?: string | null;
  userRole?: string | null;
}) {
  const ctx = getBitacoraRequestContext(req);
  const informe = await prisma.informeDiario.findUnique({
    where: { id: informeId },
    include: {
      user: { select: { id: true, name: true, role: true } },
      project: { select: { id: true, name: true, code: true } },
      jornadaCatalogo: { select: { nombre: true, horaInicio: true, horaFin: true } },
      personal: { orderBy: { createdAt: 'asc' } },
      equipos: { orderBy: { createdAt: 'asc' }, include: { horarios: { orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] } } },
      materialIngresos: { orderBy: { createdAt: 'asc' } },
      materialEntregas: { orderBy: { createdAt: 'asc' } },
      actividadesObra: { orderBy: { createdAt: 'asc' } },
      ensayosObra: { orderBy: { createdAt: 'asc' } },
      danosRedesObra: { orderBy: { createdAt: 'asc' } },
      noConformidadesObra: { orderBy: { createdAt: 'asc' } },
      suspensiones: { orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] },
      firmas: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!informe) return { ok: false as const, count: 0 };

  const actorUser = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true } })
    : null;
  const actor = {
    userId: userId ?? informe.user?.id ?? '',
    userRole: userRole ?? actorUser?.role ?? informe.user?.role ?? '',
    userName: actorUser?.name ?? informe.user?.name ?? 'Usuario del sistema',
  };
  const fecha = normalizeDateOnly(informe.date);
  const events: EventDraft[] = [];
  const push = (draft: EventDraft) => events.push(draft);

  push({
    tipoEvento: 'REGISTRO',
    moduloOrigen: 'INFORME_DIARIO',
    descripcion: `Informe diario ${informe.informeNo ?? ''} actualizado para ${informe.project.name}.`,
    fecha,
    hora: normalizeHora(informe.horaEntrada, informe.updatedAt),
    timestampUtc: informe.updatedAt,
    frenteObraId: informe.frenteObraCatalogoId,
    contratistaId: informe.contratistaCatalogoId,
    observaciones: informe.condiciones,
    sourceModel: 'InformeDiario',
    sourceId: informe.id,
    payload: {
      informeNo: informe.informeNo,
      centroTrabajo: informe.centroTrabajo,
      frenteObra: informe.frenteObra,
      contratista: informe.contratista,
      jornada: informe.jornadaCatalogo?.nombre,
      horaEntrada: informe.horaEntrada,
      horaSalida: informe.horaSalida,
      tipoClima: informe.tipoClima,
    },
  });

  for (const p of informe.personal) {
    push({
      tipoEvento: 'REGISTRO',
      moduloOrigen: 'PERSONAL',
      descripcion: `Personal registrado: ${p.nombre} (${p.cargo}).`,
      fecha,
      hora: normalizeHora(p.horaEntrada, p.createdAt),
      timestampUtc: p.createdAt,
      sourceModel: 'PersonalObra',
      sourceId: p.id,
      payload: p,
    });
  }

  for (const e of informe.equipos) {
    push({
      tipoEvento: 'REGISTRO',
      moduloOrigen: 'MAQUINARIA',
      descripcion: `Maquinaria/equipo: ${e.descripcion}${e.placaRef ? ` - ${e.placaRef}` : ''}.`,
      fecha,
      hora: normalizeHora(e.horaIngreso, e.createdAt),
      timestampUtc: e.createdAt,
      latitud: e.imagenLatitud,
      longitud: e.imagenLongitud,
      precisionGps: e.imagenPrecision,
      evidenciaFotografica: e.imagenUrl,
      observaciones: e.observacion,
      sourceModel: 'EquipoObra',
      sourceId: e.id,
      payload: { ...e, horarios: e.horarios },
      evidencias: evidenceFromRecord(e),
    });
  }

  for (const m of informe.materialIngresos) {
    push({
      tipoEvento: 'REGISTRO',
      moduloOrigen: 'MATERIALES',
      descripcion: `Ingreso de material: ${m.tipoMaterial} (${m.cantidad ?? 'N/A'} ${m.unidad}) proveedor ${m.proveedor}.`,
      fecha,
      hora: horaFromDate(m.createdAt),
      timestampUtc: m.createdAt,
      latitud: m.imagenLatitud,
      longitud: m.imagenLongitud,
      precisionGps: m.imagenPrecision,
      evidenciaFotografica: m.imagenUrl,
      observaciones: m.observacion,
      sourceModel: 'MaterialIngreso',
      sourceId: m.id,
      payload: m,
      evidencias: evidenceFromRecord(m),
    });
  }

  for (const m of informe.materialEntregas) {
    push({
      tipoEvento: 'REGISTRO',
      moduloOrigen: 'ENTREGAS',
      descripcion: `Entrega de material: ${m.tipoMaterial} (${m.cantidad ?? 'N/A'} ${m.unidad}) a ${m.contratista}.`,
      fecha,
      hora: horaFromDate(m.createdAt),
      timestampUtc: m.createdAt,
      latitud: m.imagenLatitud,
      longitud: m.imagenLongitud,
      precisionGps: m.imagenPrecision,
      evidenciaFotografica: m.imagenUrl,
      firmaAsociada: m.firmaRecibido ? 'Firma recibido' : null,
      observaciones: m.observacion,
      sourceModel: 'MaterialEntrega',
      sourceId: m.id,
      payload: m,
      evidencias: evidenceFromRecord(m),
    });
  }

  for (const a of informe.actividadesObra) {
    push({
      tipoEvento: 'REGISTRO',
      moduloOrigen: 'ACTIVIDADES',
      descripcion: `Actividad ejecutada: ${a.itemContractual} - ${a.descripcion}.`,
      fecha,
      hora: horaFromDate(a.createdAt),
      timestampUtc: a.createdAt,
      latitud: a.imagenLatitud,
      longitud: a.imagenLongitud,
      precisionGps: a.imagenPrecision,
      evidenciaFotografica: a.imagenUrl,
      observaciones: a.observacionTexto,
      sourceModel: 'ActividadObra',
      sourceId: a.id,
      payload: a,
      evidencias: evidenceFromRecord(a),
    });
  }

  for (const s of informe.suspensiones) {
    push({
      tipoEvento: 'REGISTRO',
      moduloOrigen: 'SUSPENSIONES',
      descripcion: `Suspensión: ${s.motivoSuspension}.`,
      fecha,
      hora: normalizeHora(s.horaSuspension, s.createdAt),
      timestampUtc: s.createdAt,
      latitud: s.imagenLatitud,
      longitud: s.imagenLongitud,
      precisionGps: s.imagenPrecision,
      evidenciaFotografica: s.imagenUrl,
      observaciones: `Reinicio: ${s.horaReinicio || 'N/A'} · Clima: ${s.tipoClima || 'N/A'}`,
      sourceModel: 'InformeSuspension',
      sourceId: s.id,
      payload: s,
      evidencias: evidenceFromRecord(s),
    });
  }

  for (const e of informe.ensayosObra) {
    push({
      tipoEvento: 'REGISTRO',
      moduloOrigen: 'CALIDAD',
      descripcion: `Ensayo ${e.tipoEnsayo}: ${e.resultado}.`,
      fecha,
      hora: horaFromDate(e.createdAt),
      timestampUtc: e.createdAt,
      latitud: e.imagenLatitud,
      longitud: e.imagenLongitud,
      precisionGps: e.imagenPrecision,
      evidenciaFotografica: e.imagenUrl,
      observaciones: e.observacion,
      sourceModel: 'EnsayoObra',
      sourceId: e.id,
      payload: e,
      evidencias: evidenceFromRecord(e),
    });
  }

  for (const d of informe.danosRedesObra) {
    push({
      tipoEvento: 'REGISTRO',
      moduloOrigen: 'INCIDENTES',
      descripcion: `Daño a red: ${d.tipoDano} en ${d.direccion}.`,
      fecha,
      hora: normalizeHora(d.horaReporte, d.createdAt),
      timestampUtc: d.createdAt,
      latitud: d.imagenLatitud,
      longitud: d.imagenLongitud,
      precisionGps: d.imagenPrecision,
      evidenciaFotografica: d.imagenUrl,
      observaciones: d.observacion,
      sourceModel: 'DanoRedesObra',
      sourceId: d.id,
      payload: d,
      evidencias: evidenceFromRecord(d),
    });
  }

  for (const n of informe.noConformidadesObra) {
    push({
      tipoEvento: 'REGISTRO',
      moduloOrigen: 'CALIDAD',
      descripcion: `No conformidad ${n.noConformidad}: ${n.detalle}.`,
      fecha,
      hora: horaFromDate(n.createdAt),
      timestampUtc: n.createdAt,
      latitud: n.imagenLatitud,
      longitud: n.imagenLongitud,
      precisionGps: n.imagenPrecision,
      evidenciaFotografica: n.imagenUrl,
      observaciones: `Origen: ${n.origen || 'N/A'} · Estado: ${n.estado}`,
      sourceModel: 'NoConformidadObra',
      sourceId: n.id,
      payload: n,
      evidencias: evidenceFromRecord(n),
    });
  }

  const evidencias = parseEvidenciasStored(informe.evidenciasUrl);
  for (const fase of EVIDENCIA_FASES) {
    for (const item of evidencias[fase.key]) {
      const ev = evidenciaFromItem(item, fase.key);
      if (!ev) continue;
      push({
        tipoEvento: 'REGISTRO',
        moduloOrigen: 'EVIDENCIAS',
        descripcion: `Evidencia fotográfica cargada en fase ${fase.label}.`,
        fecha,
        hora: horaFromDate(ev.tomadaEn ?? informe.updatedAt),
        timestampUtc: ev.tomadaEn ?? informe.updatedAt,
        latitud: ev.latitud,
        longitud: ev.longitud,
        precisionGps: ev.precisionGps,
        evidenciaFotografica: ev.url,
        sourceModel: 'InformeDiario.evidenciasUrl',
        sourceId: `${informe.id}:${fase.key}:${ev.url}`,
        payload: ev,
        evidencias: [ev],
      });
    }
  }

  for (const f of informe.firmas.filter((firma) => firma.firmado)) {
    push({
      tipoEvento: 'FIRMA',
      moduloOrigen: 'FIRMAS',
      descripcion: `Firma registrada: ${f.slot}.`,
      fecha,
      hora: horaFromDate(f.firmadoEn ?? f.updatedAt),
      timestampUtc: f.firmadoEn ?? f.updatedAt,
      firmaAsociada: f.slot,
      observaciones: f.observacion,
      sourceModel: 'FirmaInforme',
      sourceId: f.id,
      payload: f,
      firma: { slot: f.slot, firmadoEn: f.firmadoEn },
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.bitacoraEvento.updateMany({
      where: { informeId, estado: { in: ['ACTIVO', 'OBSERVADO'] } },
      data: { estado: 'REEMPLAZADO', deletedAt: new Date() },
    });
    for (const event of events) {
      await createEvento(tx, ctx, actor, informe.projectId, informe.id, informe.jornadaCatalogo, event);
    }
  });

  return { ok: true as const, count: events.length };
}

export async function findInformeForBitacora(projectId: string, date: Date, jornadaId?: string | null) {
  return prisma.informeDiario.findFirst({
    where: { projectId, date: normalizeDateOnly(date), jornadaCatalogoId: jornadaId ?? null },
    select: { id: true },
  });
}
