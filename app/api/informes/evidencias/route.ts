import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../../src/lib/prisma';
import { resolveJornadaCatalogoId } from '../../../../src/lib/informeDailyScope';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import { generarTokenFirma } from '../../../../src/infrastructure/auth/firmaToken';
import { dbPuedeFirmarEnSlot } from '../../../../src/infrastructure/auth/firmaPermissionsResolver';
import { FIRMA_SLOT_KEYS, type FirmaSlotKey, FIRMA_SLOT_LABELS } from '../../../../src/shared/firmaPolicies';
import { informeCerradoJsonResponse } from '../../../../src/lib/informeCerrado';
import {
  normalizeEvidenciasBody,
  parseEvidenciasStored,
  serializeEvidenciasForDb,
} from '../../../../src/lib/evidenciasUrlPayload';

function normalizeDate(date: string): Date | null {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export type FirmaEvidenciaPayload = {
  codigo: string;
  observacion: string;
  firmado: boolean;
  firmadoEn: string | null;
};

function emptyFirma(): FirmaEvidenciaPayload {
  return { codigo: '', observacion: '', firmado: false, firmadoEn: null };
}

function mapFirmasFromRows(
  rows: { slot: string; firmado: boolean; codigo: string; observacion: string; firmadoEn: Date | null }[],
): Record<FirmaSlotKey, FirmaEvidenciaPayload> {
  const base: Record<FirmaSlotKey, FirmaEvidenciaPayload> = {
    responsableDiligenciamiento: emptyFirma(),
    residenteObra: emptyFirma(),
    auxiliarIngenieria: emptyFirma(),
    vistoBuenoDirectorObra: emptyFirma(),
  };
  for (const r of rows) {
    if (!FIRMA_SLOT_KEYS.includes(r.slot as FirmaSlotKey)) continue;
    const k = r.slot as FirmaSlotKey;
    base[k] = {
      codigo: (r.codigo ?? '').trim(),
      observacion: (r.observacion ?? '').trim(),
      firmado: Boolean(r.firmado),
      firmadoEn: r.firmadoEn ? r.firmadoEn.toISOString() : null,
    };
  }
  return base;
}

function normalizeFirmaBody(input: unknown): FirmaEvidenciaPayload {
  if (!input || typeof input !== 'object') return emptyFirma();
  const o = input as Record<string, unknown>;
  return {
    codigo: String(o.codigo ?? '').trim(),
    observacion: String(o.observacion ?? '').trim(),
    firmado: Boolean(o.firmado),
    firmadoEn: o.firmadoEn != null && o.firmadoEn !== '' ? String(o.firmadoEn) : null,
  };
}

function padNumber(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

async function validarFirmasEvidencias(
  payload: { sub: string; role: string },
  firmas: Record<FirmaSlotKey, FirmaEvidenciaPayload>,
): Promise<{ ok: true } | { ok: false; status: 400 | 403; error: string }> {
  const expectedToken = generarTokenFirma(payload.sub, payload.role);

  for (const slot of FIRMA_SLOT_KEYS) {
    const firma = firmas[slot];
    if (!firma.firmado) continue;

    if (!(await dbPuedeFirmarEnSlot(payload.role, slot))) {
      return {
        ok: false,
        status: 403,
        error: `Tu rol no puede registrar firmas en: ${FIRMA_SLOT_LABELS[slot]}.`,
      };
    }

    if (firma.codigo !== expectedToken) {
      return {
        ok: false,
        status: 400,
        error: 'Código de firma inválido o expirado. Debe coincidir con el de la barra superior (mismo día).',
      };
    }

    if (!firma.observacion.trim()) {
      return {
        ok: false,
        status: 400,
        error: `La observación es obligatoria para registrar la firma en: ${FIRMA_SLOT_LABELS[slot]}.`,
      };
    }
  }

  return { ok: true };
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
      select: {
        registroFotografico: true,
        observacionesGenerales: true,
        observaciones: true,
        evidenciasUrl: true,
        informeCerrado: true,
        cerradoEn: true,
        firmas: {
          select: {
            slot: true,
            firmado: true,
            codigo: true,
            observacion: true,
            firmadoEn: true,
          },
        },
      },
    });

    const firmasPayload = informe ? mapFirmasFromRows(informe.firmas) : mapFirmasFromRows([]);

    return NextResponse.json({
      exists: Boolean(informe),
      informeCerrado: informe?.informeCerrado ?? false,
      cerradoEn: informe?.cerradoEn ? informe.cerradoEn.toISOString() : null,
      registroFotografico: informe?.registroFotografico ?? false,
      observacionesGenerales: informe?.observacionesGenerales ?? '',
      observaciones: informe?.observaciones ?? '',
      responsableDiligenciamiento: firmasPayload.responsableDiligenciamiento,
      residenteObra: firmasPayload.residenteObra,
      auxiliarIngenieria: firmasPayload.auxiliarIngenieria,
      vistoBuenoDirectorObra: firmasPayload.vistoBuenoDirectorObra,
      evidenciaUrls: parseEvidenciasStored(informe?.evidenciasUrl ?? null),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al cargar evidencias' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    const userId = payload.sub as string;
    const userRole = payload.role;

    const body = (await req.json()) as {
      projectId?: string;
      date?: string;
      jornadaId?: string;
      jornadaCatalogoId?: string;
      registroFotografico?: boolean;
      observacionesGenerales?: string;
      observaciones?: string | null;
      responsableDiligenciamiento?: unknown;
      residenteObra?: unknown;
      auxiliarIngenieria?: unknown;
      vistoBuenoDirectorObra?: unknown;
      evidenciaUrls?: unknown;
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

    const evidenciaUrlsPorFase = normalizeEvidenciasBody(body.evidenciaUrls);

    const fRespObj = normalizeFirmaBody(body.responsableDiligenciamiento);
    const fResObj = normalizeFirmaBody(body.residenteObra);
    const fAuxObj = normalizeFirmaBody(body.auxiliarIngenieria);
    const fVisObj = normalizeFirmaBody(body.vistoBuenoDirectorObra);

    const firmasRecord: Record<FirmaSlotKey, FirmaEvidenciaPayload> = {
      responsableDiligenciamiento: fRespObj,
      residenteObra: fResObj,
      auxiliarIngenieria: fAuxObj,
      vistoBuenoDirectorObra: fVisObj,
    };

    const validacion = await validarFirmasEvidencias({ sub: userId, role: userRole }, firmasRecord);
    if (validacion.ok === false) {
      return NextResponse.json({ error: validacion.error }, { status: validacion.status });
    }

    const informeExistente = await prisma.informeDiario.findFirst({
      where: { projectId, date, jornadaCatalogoId: jr.id },
      select: { id: true, informeCerrado: true },
    });

    if (informeExistente?.informeCerrado) {
      return informeCerradoJsonResponse();
    }

    const cerradoResult = await prisma.$transaction(async (tx) => {
      let informeId: string;

      if (!informeExistente) {
        const maxByProject = await tx.informeDiario.aggregate({
          where: { projectId },
          _max: { informeConsecutivo: true, centroTrabajoConsecutivo: true },
        });
        const nextInformeConsecutivo = (maxByProject._max.informeConsecutivo ?? 0) + 1;
        const nextCentroTrabajoConsecutivo = (maxByProject._max.centroTrabajoConsecutivo ?? 0) + 1;
        const year = date.getUTCFullYear();
        const informeNo = `IDO-${year}-${padNumber(nextInformeConsecutivo, 3)}`;
        const centroTrabajo = `CT-${padNumber(nextCentroTrabajoConsecutivo, 3)}`;

        const created = await tx.informeDiario.create({
          data: {
            userId,
            projectId,
            date,
            jornadaCatalogoId: jr.id,
            informeConsecutivo: nextInformeConsecutivo,
            informeNo,
            centroTrabajoConsecutivo: nextCentroTrabajoConsecutivo,
            centroTrabajo,
            registroFotografico: Boolean(body.registroFotografico),
            observacionesGenerales: body.observacionesGenerales ?? null,
            observaciones: body.observaciones === undefined ? null : (body.observaciones as string | null),
            evidenciasUrl: serializeEvidenciasForDb(evidenciaUrlsPorFase),
          },
          select: { id: true },
        });
        informeId = created.id;
      } else {
        informeId = informeExistente.id;
        await tx.informeDiario.update({
          where: { id: informeId },
          data: {
            userId,
            registroFotografico: Boolean(body.registroFotografico),
            observacionesGenerales: body.observacionesGenerales ?? null,
            observaciones: body.observaciones === undefined ? undefined : (body.observaciones as string | null),
            evidenciasUrl: serializeEvidenciasForDb(evidenciaUrlsPorFase),
          },
        });
      }

      for (const slot of FIRMA_SLOT_KEYS) {
        const f = firmasRecord[slot];
        await tx.firmaInforme.upsert({
          where: {
            informeId_slot: { informeId, slot },
          },
          create: {
            informeId,
            slot,
            firmado: f.firmado,
            codigo: f.codigo,
            observacion: f.observacion,
            firmadoEn: f.firmadoEn ? new Date(f.firmadoEn) : null,
          },
          update: {
            firmado: f.firmado,
            codigo: f.codigo,
            observacion: f.observacion,
            firmadoEn: f.firmadoEn ? new Date(f.firmadoEn) : null,
          },
        });
      }

      const firmasRows = await tx.firmaInforme.findMany({
        where: { informeId },
        select: { slot: true, firmado: true },
      });
      const bySlot = new Map(firmasRows.map((r) => [r.slot, r.firmado]));
      const allSigned = FIRMA_SLOT_KEYS.every((k) => bySlot.get(k) === true);
      const cerradoEn = allSigned ? new Date() : null;
      await tx.informeDiario.update({
        where: { id: informeId },
        data: {
          informeCerrado: allSigned,
          cerradoEn: allSigned ? cerradoEn : null,
        },
      });
      return { informeCerrado: allSigned, cerradoEn };
    });

    return NextResponse.json(
      {
        ok: true,
        informeCerrado: cerradoResult.informeCerrado,
        cerradoEn: cerradoResult.cerradoEn ? cerradoResult.cerradoEn.toISOString() : null,
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al guardar evidencias' }, { status: 500 });
  }
}
