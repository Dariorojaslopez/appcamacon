import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../src/infrastructure/auth/tokens';
import { authFromRequest, isAuthPayload, requireAccessibleProject } from '../../../src/lib/requireProjectAccess';
import prisma from '../../../src/lib/prisma';
import {
  jsonRegistroBitacoraSchemaPendiente,
  prismaIndicaTablaRegistroBitacoraDesactualizada,
} from '../../../src/lib/prismaRegistroBitacoraSchema';
import { fechaRegistroEnRangoObra, parseYmdUtc, toYmdUtc } from '../../../src/lib/registroBitacoraFecha';
import { dbRegistroBitacoraSlotsForRole } from '../../../src/infrastructure/auth/registroBitacoraPermissionsResolver';
import {
  REGISTRO_BITACORA_SLOT_KEYS,
  type RegistroBitacoraSlotKey,
} from '../../../src/shared/registroBitacoraPermissions';
import { notifyBitacoraSaveToOthers } from '../../../src/lib/registroBitacoraNotify';
import { normalizeFirmaDocsForSave, parseFirmaDocsJson } from '../../../src/shared/registroBitacoraFirmaDocs';
import { Prisma } from '@prisma/client';

type SlotPayload = {
  observaciones?: unknown;
  fotoUrl?: unknown;
  firmaUrl?: unknown;
  firmaDocs?: unknown;
};

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asOptionalUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = authFromRequest(req);
    if (!isAuthPayload(auth)) return auth;

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim() ?? '';
    const fechaStr = req.nextUrl.searchParams.get('fecha')?.trim() ?? '';
    if (!projectId || !fechaStr) {
      return NextResponse.json({ error: 'projectId y fecha (YYYY-MM-DD) son requeridos' }, { status: 400 });
    }
    const fecha = parseYmdUtc(fechaStr);
    if (!fecha) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });

    const denied = await requireAccessibleProject(auth, projectId);
    if (denied) return denied;

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!project) return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 404 });

    const rango = fechaRegistroEnRangoObra(fecha, project.startDate, project.endDate);
    if (rango.ok === false) return NextResponse.json({ error: rango.error }, { status: 400 });

    const reg = await prisma.registroBitacoraObra.findUnique({
      where: { projectId_fecha: { projectId, fecha } },
      select: {
        id: true,
        fecha: true,
        consecutivo: true,
        contratistaObservaciones: true,
        contratistaFotoUrl: true,
        contratistaFirmaUrl: true,
        contratistaFirmaDocs: true,
        interventoriaObservaciones: true,
        interventoriaFotoUrl: true,
        interventoriaFirmaUrl: true,
        interventoriaFirmaDocs: true,
        iduObservaciones: true,
        iduFotoUrl: true,
        iduFirmaUrl: true,
        iduFirmaDocs: true,
        contratistaGuardadoPor: true,
        contratistaGuardadoEn: true,
        interventoriaGuardadoPor: true,
        interventoriaGuardadoEn: true,
        iduGuardadoPor: true,
        iduGuardadoEn: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      registro: reg
        ? {
            ...reg,
            fecha: toYmdUtc(reg.fecha),
            contratistaGuardadoEn: reg.contratistaGuardadoEn?.toISOString() ?? null,
            interventoriaGuardadoEn: reg.interventoriaGuardadoEn?.toISOString() ?? null,
            iduGuardadoEn: reg.iduGuardadoEn?.toISOString() ?? null,
            contratistaFirmaDocs: parseFirmaDocsJson(reg.contratistaFirmaDocs),
            interventoriaFirmaDocs: parseFirmaDocsJson(reg.interventoriaFirmaDocs),
            iduFirmaDocs: parseFirmaDocsJson(reg.iduFirmaDocs),
          }
        : null,
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (prismaIndicaTablaRegistroBitacoraDesactualizada(error)) {
      console.error('GET /api/registro-bitacora (schema)', error);
      return jsonRegistroBitacoraSchemaPendiente();
    }
    console.error('GET /api/registro-bitacora', error);
    return NextResponse.json({ error: 'Error al cargar el registro' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    const userId = payload.sub as string;

    const body = (await req.json()) as {
      projectId?: unknown;
      fecha?: unknown;
      contratista?: SlotPayload;
      interventoria?: SlotPayload;
      idu?: SlotPayload;
    };

    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
    const fechaStr = typeof body.fecha === 'string' ? body.fecha.trim() : '';
    if (!projectId) {
      return NextResponse.json({ error: 'Seleccione una obra' }, { status: 400 });
    }
    if (!fechaStr) {
      return NextResponse.json({ error: 'Seleccione la fecha del registro' }, { status: 400 });
    }
    const fecha = parseYmdUtc(fechaStr);
    if (!fecha) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });

    const denied = await requireAccessibleProject(payload, projectId);
    if (denied) return denied;

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 404 });
    }

    const rango = fechaRegistroEnRangoObra(fecha, project.startDate, project.endDate);
    if (rango.ok === false) return NextResponse.json({ error: rango.error }, { status: 400 });

    const allowedSlots = await dbRegistroBitacoraSlotsForRole(payload.role);
    if (allowedSlots.length === 0) {
      return NextResponse.json(
        { error: 'Su rol no tiene permiso para editar ninguna sección del registro de bitácora.' },
        { status: 403 },
      );
    }

    const can = (slot: RegistroBitacoraSlotKey) => allowedSlots.includes(slot);
    const c = body.contratista ?? {};
    const i = body.interventoria ?? {};
    const d = body.idu ?? {};

    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const guardadoPorNombre = me?.name?.trim() || 'Usuario';
    const guardadoEn = new Date();

    const { row, created } = await prisma.$transaction(async (tx) => {
      const existing = await tx.registroBitacoraObra.findUnique({
        where: { projectId_fecha: { projectId, fecha } },
      });

      const dataSlots = {
        contratistaObservaciones: can('contratista')
          ? asString(c.observaciones)
          : (existing?.contratistaObservaciones ?? ''),
        contratistaFotoUrl: can('contratista')
          ? asOptionalUrl(c.fotoUrl)
          : (existing?.contratistaFotoUrl ?? null),
        contratistaFirmaUrl: can('contratista')
          ? asOptionalUrl(c.firmaUrl)
          : (existing?.contratistaFirmaUrl ?? null),
        contratistaFirmaDocs: can('contratista')
          ? (normalizeFirmaDocsForSave(c.firmaDocs) as Prisma.InputJsonValue)
          : ((existing?.contratistaFirmaDocs as Prisma.InputJsonValue) ?? []),
        contratistaGuardadoPor: can('contratista')
          ? guardadoPorNombre
          : (existing?.contratistaGuardadoPor ?? null),
        contratistaGuardadoEn: can('contratista') ? guardadoEn : (existing?.contratistaGuardadoEn ?? null),
        interventoriaObservaciones: can('interventor')
          ? asString(i.observaciones)
          : (existing?.interventoriaObservaciones ?? ''),
        interventoriaFotoUrl: can('interventor')
          ? asOptionalUrl(i.fotoUrl)
          : (existing?.interventoriaFotoUrl ?? null),
        interventoriaFirmaUrl: can('interventor')
          ? asOptionalUrl(i.firmaUrl)
          : (existing?.interventoriaFirmaUrl ?? null),
        interventoriaFirmaDocs: can('interventor')
          ? (normalizeFirmaDocsForSave(i.firmaDocs) as Prisma.InputJsonValue)
          : ((existing?.interventoriaFirmaDocs as Prisma.InputJsonValue) ?? []),
        interventoriaGuardadoPor: can('interventor')
          ? guardadoPorNombre
          : (existing?.interventoriaGuardadoPor ?? null),
        interventoriaGuardadoEn: can('interventor')
          ? guardadoEn
          : (existing?.interventoriaGuardadoEn ?? null),
        iduObservaciones: can('idu') ? asString(d.observaciones) : (existing?.iduObservaciones ?? ''),
        iduFotoUrl: can('idu') ? asOptionalUrl(d.fotoUrl) : (existing?.iduFotoUrl ?? null),
        iduFirmaUrl: can('idu') ? asOptionalUrl(d.firmaUrl) : (existing?.iduFirmaUrl ?? null),
        iduFirmaDocs: can('idu')
          ? (normalizeFirmaDocsForSave(d.firmaDocs) as Prisma.InputJsonValue)
          : ((existing?.iduFirmaDocs as Prisma.InputJsonValue) ?? []),
        iduGuardadoPor: can('idu') ? guardadoPorNombre : (existing?.iduGuardadoPor ?? null),
        iduGuardadoEn: can('idu') ? guardadoEn : (existing?.iduGuardadoEn ?? null),
        franjaClimaMananaCodigo: existing?.franjaClimaMananaCodigo ?? null,
        franjaClimaTardeCodigo: existing?.franjaClimaTardeCodigo ?? null,
        franjaClimaNocheCodigo: existing?.franjaClimaNocheCodigo ?? null,
      };

      if (existing) {
        const updated = await tx.registroBitacoraObra.update({
          where: { id: existing.id },
          data: dataSlots,
        });
        return { row: updated, created: false };
      }
      const agg = await tx.registroBitacoraObra.aggregate({
        where: { projectId },
        _max: { consecutivo: true },
      });
      const nextConsecutivo = (agg._max.consecutivo ?? 0) + 1;
      const createdRow = await tx.registroBitacoraObra.create({
        data: {
          projectId,
          userId,
          fecha,
          consecutivo: nextConsecutivo,
          ...dataSlots,
        },
      });
      return { row: createdRow, created: true };
    });

    const savedSlots = REGISTRO_BITACORA_SLOT_KEYS.filter((slot) => can(slot));
    let notificacionesEnviadas = 0;
    try {
      const notifyResult = await notifyBitacoraSaveToOthers({
        projectId,
        fechaYmd: fechaStr,
        savedSlots,
        savedByUserId: userId,
        savedByName: guardadoPorNombre,
      });
      notificacionesEnviadas = notifyResult.emailsSent;
      if (notifyResult.skipReason) {
        console.info('POST /api/registro-bitacora notificaciones', {
          projectId,
          savedSlots,
          skipReason: notifyResult.skipReason,
        });
      }
    } catch (err) {
      console.error('notifyBitacoraSaveToOthers', err);
    }

    return NextResponse.json(
      {
        ok: true,
        id: row.id,
        consecutivo: row.consecutivo,
        fecha: toYmdUtc(row.fecha),
        notificacionesEnviadas,
      },
      { status: created ? 201 : 200 },
    );
  } catch (error: unknown) {
    const err = error as { code?: string; name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    if (err?.code === 'P2003' || err?.code === 'P2025') {
      return NextResponse.json({ error: 'Obra o usuario no válido' }, { status: 400 });
    }
    if (err?.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un registro para esa obra y fecha.' }, { status: 409 });
    }
    if (prismaIndicaTablaRegistroBitacoraDesactualizada(error)) {
      console.error('POST /api/registro-bitacora (schema)', error);
      return jsonRegistroBitacoraSchemaPendiente();
    }
    console.error('POST /api/registro-bitacora', error);
    return NextResponse.json({ error: 'Error al guardar el registro' }, { status: 500 });
  }
}
