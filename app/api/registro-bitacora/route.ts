import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../src/infrastructure/auth/tokens';
import prisma from '../../../src/lib/prisma';
import {
  jsonRegistroBitacoraSchemaPendiente,
  prismaIndicaTablaRegistroBitacoraDesactualizada,
} from '../../../src/lib/prismaRegistroBitacoraSchema';
import { fechaRegistroEnRangoObra, parseYmdUtc, toYmdUtc } from '../../../src/lib/registroBitacoraFecha';

type SlotPayload = {
  observaciones?: unknown;
  fotoUrl?: unknown;
  firmaUrl?: unknown;
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
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    verifyAccessToken(authCookie);

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim() ?? '';
    const fechaStr = req.nextUrl.searchParams.get('fecha')?.trim() ?? '';
    if (!projectId || !fechaStr) {
      return NextResponse.json({ error: 'projectId y fecha (YYYY-MM-DD) son requeridos' }, { status: 400 });
    }
    const fecha = parseYmdUtc(fechaStr);
    if (!fecha) return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });

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
        interventoriaObservaciones: true,
        interventoriaFotoUrl: true,
        interventoriaFirmaUrl: true,
        iduObservaciones: true,
        iduFotoUrl: true,
        iduFirmaUrl: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      registro: reg
        ? {
            ...reg,
            fecha: toYmdUtc(reg.fecha),
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

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 404 });
    }

    const rango = fechaRegistroEnRangoObra(fecha, project.startDate, project.endDate);
    if (rango.ok === false) return NextResponse.json({ error: rango.error }, { status: 400 });

    const c = body.contratista ?? {};
    const i = body.interventoria ?? {};
    const d = body.idu ?? {};

    const dataSlots = {
      contratistaObservaciones: asString(c.observaciones),
      contratistaFotoUrl: asOptionalUrl(c.fotoUrl),
      contratistaFirmaUrl: asOptionalUrl(c.firmaUrl),
      interventoriaObservaciones: asString(i.observaciones),
      interventoriaFotoUrl: asOptionalUrl(i.fotoUrl),
      interventoriaFirmaUrl: asOptionalUrl(i.firmaUrl),
      iduObservaciones: asString(d.observaciones),
      iduFotoUrl: asOptionalUrl(d.fotoUrl),
      iduFirmaUrl: asOptionalUrl(d.firmaUrl),
      franjaClimaMananaCodigo: null,
      franjaClimaTardeCodigo: null,
      franjaClimaNocheCodigo: null,
    };

    const { row, created } = await prisma.$transaction(async (tx) => {
      const existing = await tx.registroBitacoraObra.findUnique({
        where: { projectId_fecha: { projectId, fecha } },
        select: { id: true },
      });
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

    return NextResponse.json(
      { ok: true, id: row.id, consecutivo: row.consecutivo, fecha: toYmdUtc(row.fecha) },
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
