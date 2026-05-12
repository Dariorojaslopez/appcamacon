import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../../src/lib/prisma';

const PERSONA_TYPES = new Set(['Natural', 'Jurídica']);

function auth(req: NextRequest) {
  const authCookie = req.cookies.get('access_token')?.value;
  if (!authCookie) return { status: 401, error: 'No autenticado' } as const;
  const payload = verifyAccessToken(authCookie);
  if (payload.role !== 'SUPER_ADMIN') return { status: 403, error: 'No autorizado' } as const;
  return null;
}

function clean(raw: unknown): string | null {
  const value = String(raw ?? '').trim();
  return value || null;
}

function normalizeTipoPersona(raw: unknown): string | null {
  if (raw === undefined) return null;
  const value = String(raw ?? '').trim();
  return PERSONA_TYPES.has(value) ? value : 'Natural';
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const a = auth(req);
    if (a) return NextResponse.json({ error: a.error }, { status: a.status });
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    const tipoPersona = normalizeTipoPersona(body.tipoPersona);
    if (tipoPersona) data.tipoPersona = tipoPersona;
    if (body.nombreRazonSocial !== undefined) {
      const value = String(body.nombreRazonSocial ?? '').trim();
      if (!value) return NextResponse.json({ error: 'La razón social o nombre es requerido' }, { status: 400 });
      data.nombreRazonSocial = value;
    }
    if (body.nitDocumento !== undefined) {
      const value = String(body.nitDocumento ?? '').trim();
      if (!value) return NextResponse.json({ error: 'El NIT o documento es requerido' }, { status: 400 });
      data.nitDocumento = value;
    }
    if (body.nombreComercial !== undefined) data.nombreComercial = clean(body.nombreComercial);
    if (body.dv !== undefined) data.dv = clean(body.dv);
    if (body.email !== undefined) data.email = clean(body.email);
    if (body.telefono !== undefined) data.telefono = clean(body.telefono);
    if (body.celular !== undefined) data.celular = clean(body.celular);
    if (body.direccion !== undefined) data.direccion = clean(body.direccion);
    if (body.pais !== undefined) data.pais = clean(body.pais);
    if (body.departamento !== undefined) data.departamento = clean(body.departamento);
    if (body.ciudad !== undefined) data.ciudad = clean(body.ciudad);
    if (body.codigoPostal !== undefined) data.codigoPostal = clean(body.codigoPostal);
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);

    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });

    try {
      const item = await prisma.proveedorCatalog.update({ where: { id }, data: data as any });
      return NextResponse.json({ item }, { status: 200 });
    } catch (e: unknown) {
      const pe = e as { code?: string };
      if (pe.code === 'P2002') {
        return NextResponse.json({ error: 'Ya existe un proveedor con ese NIT o documento en esta obra' }, { status: 409 });
      }
      throw e;
    }
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar proveedor' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const a = auth(req);
    if (a) return NextResponse.json({ error: a.error }, { status: a.status });
    const { id } = await params;

    await prisma.$transaction([
      prisma.itemCatalog.updateMany({ where: { proveedorId: id }, data: { proveedorId: null } as any }),
      prisma.proveedorCatalog.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al eliminar proveedor' }, { status: 500 });
  }
}
