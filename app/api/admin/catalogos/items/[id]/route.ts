import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../../src/lib/prisma';
import { assertSubchapterBelongsToProject } from '../../../../../../src/lib/budgetHierarchy';

function unauthorized(req: NextRequest) {
  const authCookie = req.cookies.get('access_token')?.value;
  if (!authCookie) return { status: 401, error: 'No autenticado' };
  const payload = verifyAccessToken(authCookie);
  if (payload.role !== 'SUPER_ADMIN') return { status: 403, error: 'No autorizado' };
  return null;
}

function isUnknownItemDetailArgError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? '');
  return msg.includes('Unknown argument') && (
    msg.includes('largo') ||
    msg.includes('ancho') ||
    msg.includes('altura') ||
    msg.includes('imagenUrl') ||
    msg.includes('cantidad')
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = unauthorized(req);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    const body = (await req.json()) as {
      subchapterId?: string;
      codigo?: string;
      descripcion?: string;
      unidad?: string | null;
      precioUnitario?: number | null;
      cantidad?: number | null;
      largo?: number | null;
      ancho?: number | null;
      altura?: number | null;
      imagenUrl?: string | null;
      imagenLatitud?: number | null;
      imagenLongitud?: number | null;
      imagenPrecision?: number | null;
      imagenGeoEstado?: string | null;
      imagenTomadaEn?: string | null;
      proveedorId?: string | null;
      isActive?: boolean;
      orden?: number;
    };

    const existing = await prisma.itemCatalog.findFirst({
      where: { id },
      select: { projectId: true },
    });
    if (!existing) return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.subchapterId !== undefined) {
      const sid = String(body.subchapterId).trim();
      if (!sid) return NextResponse.json({ error: 'subchapterId inválido' }, { status: 400 });
      const ok = await assertSubchapterBelongsToProject(prisma, existing.projectId, sid);
      if (!ok) return NextResponse.json({ error: 'Subcapítulo no válido para la obra de este ítem' }, { status: 400 });
      data.subchapterId = sid;
    }
    if (body.codigo !== undefined) {
      const codigo = String(body.codigo).trim();
      if (!codigo) return NextResponse.json({ error: 'El código es requerido' }, { status: 400 });
      data.codigo = codigo;
    }
    if (body.descripcion !== undefined) {
      const descripcion = String(body.descripcion).trim();
      if (!descripcion) return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 });
      data.descripcion = descripcion;
    }
    if (body.unidad !== undefined) data.unidad = body.unidad ? String(body.unidad).trim() : null;
    if (body.precioUnitario !== undefined) {
      const rawPrecio = body.precioUnitario as unknown;
      if (rawPrecio == null || rawPrecio === '') data.precioUnitario = null;
      else {
        const n = Number(rawPrecio);
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'Precio unitario inválido' }, { status: 400 });
        data.precioUnitario = n;
      }
    }
    if (body.cantidad !== undefined) {
      const raw = body.cantidad as unknown;
      if (raw == null || raw === '') data.cantidad = null;
      else {
        const n = Number(raw);
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 });
        data.cantidad = n;
      }
    }
    if (body.largo !== undefined) {
      const raw = body.largo as unknown;
      if (raw == null || raw === '') data.largo = null;
      else {
        const n = Number(raw);
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'Largo inválido' }, { status: 400 });
        data.largo = n;
      }
    }
    if (body.ancho !== undefined) {
      const raw = body.ancho as unknown;
      if (raw == null || raw === '') data.ancho = null;
      else {
        const n = Number(raw);
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'Ancho inválido' }, { status: 400 });
        data.ancho = n;
      }
    }
    if (body.altura !== undefined) {
      const raw = body.altura as unknown;
      if (raw == null || raw === '') data.altura = null;
      else {
        const n = Number(raw);
        if (!Number.isFinite(n)) return NextResponse.json({ error: 'Altura inválida' }, { status: 400 });
        data.altura = n;
      }
    }
    if (body.imagenUrl !== undefined) data.imagenUrl = body.imagenUrl ? String(body.imagenUrl).trim() : null;
    if (body.imagenLatitud !== undefined) {
      data.imagenLatitud =
        typeof body.imagenLatitud === 'number' && Number.isFinite(body.imagenLatitud) ? body.imagenLatitud : null;
    }
    if (body.imagenLongitud !== undefined) {
      data.imagenLongitud =
        typeof body.imagenLongitud === 'number' && Number.isFinite(body.imagenLongitud) ? body.imagenLongitud : null;
    }
    if (body.imagenPrecision !== undefined) {
      data.imagenPrecision =
        typeof body.imagenPrecision === 'number' && Number.isFinite(body.imagenPrecision) ? body.imagenPrecision : null;
    }
    if (body.imagenGeoEstado !== undefined) data.imagenGeoEstado = body.imagenGeoEstado ? String(body.imagenGeoEstado).trim() : null;
    if (body.imagenTomadaEn !== undefined) data.imagenTomadaEn = body.imagenTomadaEn ? new Date(body.imagenTomadaEn) : null;
    if (body.proveedorId !== undefined) {
      const proveedorId = String(body.proveedorId ?? '').trim();
      if (proveedorId) {
        const proveedor = await prisma.proveedorCatalog.findFirst({
          where: { id: proveedorId, projectId: existing.projectId, isActive: true },
          select: { id: true },
        });
        if (!proveedor) return NextResponse.json({ error: 'Proveedor no válido para la obra de este ítem' }, { status: 400 });
        data.proveedorId = proveedorId;
      } else {
        data.proveedorId = null;
      }
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.orden !== undefined) data.orden = Number(body.orden) || 0;

    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Sin cambios' }, { status: 400 });

    try {
      let item: any;
      try {
        item = await prisma.itemCatalog.update({
          where: { id },
          data: data as any,
        });
      } catch (e) {
        if (!isUnknownItemDetailArgError(e)) throw e;
        const fallback = { ...data } as Record<string, unknown>;
        delete fallback.largo;
        delete fallback.ancho;
        delete fallback.altura;
        delete fallback.imagenUrl;
        delete fallback.imagenLatitud;
        delete fallback.imagenLongitud;
        delete fallback.imagenPrecision;
        delete fallback.imagenGeoEstado;
        delete fallback.imagenTomadaEn;
        delete fallback.cantidad;
        item = await prisma.itemCatalog.update({
          where: { id },
          data: fallback as any,
        });
      }
      return NextResponse.json({ item }, { status: 200 });
    } catch (e: unknown) {
      const pe = e as { code?: string };
      if (pe.code === 'P2002') {
        return NextResponse.json({ error: 'Ya existe un ítem con ese código en esta obra' }, { status: 409 });
      }
      throw e;
    }
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar ítem' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = unauthorized(req);
    if (auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    await prisma.itemCatalog.delete({ where: { id } });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al eliminar ítem' }, { status: 500 });
  }
}
