import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../src/lib/prisma';
import { assertSubchapterBelongsToProject, ensureDefaultBudgetHierarchy } from '../../../../../src/lib/budgetHierarchy';

type ParsedItem = {
  codigo: string;
  descripcion: string;
  unidad: string | null;
  precioUnitario: number | null;
  cantidad: number | null;
  largo: number | null;
  ancho: number | null;
  altura: number | null;
  imagenUrl: string | null;
};

function parseMoney(raw: string): number | null {
  const normalized = raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.').trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseItemsFromRawText(rawText: string): ParsedItem[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const result: ParsedItem[] = [];
  for (const line of lines) {
    const parts = line.split('\t').map((p) => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const codigo = parts[0];
    const descripcion = parts[1];
    if (!/^\d+[,.]\d+|\d+$/.test(codigo)) continue;
    if (descripcion.length < 4) continue;
    const unidad = parts[2] && !parts[2].includes('$') ? parts[2] : null;
    const precioChunk = [...parts].reverse().find((p) => p.includes('$') || /\d+[.,]\d+/.test(p));
    const precioUnitario = precioChunk ? parseMoney(precioChunk) : null;
    result.push({
      codigo,
      descripcion,
      unidad,
      precioUnitario,
      cantidad: null,
      largo: null,
      ancho: null,
      altura: null,
      imagenUrl: null,
    });
  }

  const dedup = new Map<string, ParsedItem>();
  for (const item of result) {
    dedup.set(item.codigo, item);
  }
  return Array.from(dedup.values());
}

async function ensureAdmin(req: NextRequest) {
  const authCookie = req.cookies.get('access_token')?.value;
  if (!authCookie) return { ok: false as const, status: 401, error: 'No autenticado' };
  const payload = verifyAccessToken(authCookie);
  if (payload.role !== 'SUPER_ADMIN') return { ok: false as const, status: 403, error: 'No autorizado' };
  return { ok: true as const };
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

export async function GET(req: NextRequest) {
  try {
    const auth = await ensureAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
    const itemsRaw = await prisma.itemCatalog.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: [{ orden: 'asc' }, { codigo: 'asc' }],
      include: {
        subchapter: {
          include: { chapter: { select: { id: true, codigo: true, nombre: true } } },
        },
        proveedor: {
          select: { id: true, nombreRazonSocial: true, nombreComercial: true, nitDocumento: true },
        },
      },
    });
    const items = (itemsRaw as any[]).map((it) => ({
      id: it.id,
      projectId: it.projectId,
      subchapterId: it.subchapterId,
      chapterId: it.subchapter?.chapter?.id ?? null,
      chapterCodigo: it.subchapter?.chapter?.codigo ?? null,
      chapterNombre: it.subchapter?.chapter?.nombre ?? null,
      subchapterNombre: it.subchapter?.nombre ?? null,
      proveedorId: it.proveedorId ?? null,
      proveedorNombre: it.proveedor?.nombreComercial || it.proveedor?.nombreRazonSocial || null,
      codigo: it.codigo,
      descripcion: it.descripcion,
      unidad: it.unidad ?? null,
      precioUnitario: it.precioUnitario ?? null,
      cantidad: it.cantidad ?? null,
      largo: it.largo ?? null,
      ancho: it.ancho ?? null,
      altura: it.altura ?? null,
      imagenUrl: it.imagenUrl ?? null,
      imagenLatitud: it.imagenLatitud ?? null,
      imagenLongitud: it.imagenLongitud ?? null,
      imagenPrecision: it.imagenPrecision ?? null,
      imagenGeoEstado: it.imagenGeoEstado ?? null,
      imagenTomadaEn: it.imagenTomadaEn ? it.imagenTomadaEn.toISOString() : null,
      orden: it.orden ?? 0,
      isActive: Boolean(it.isActive),
    }));
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al listar ítems' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await ensureAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = (await req.json()) as {
      projectId?: string;
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
      rawText?: string;
    };

    const projectId = String(body.projectId ?? '').trim();
    if (!projectId) return NextResponse.json({ error: 'La obra (projectId) es requerida' }, { status: 400 });

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { id: true },
    });
    if (!project) return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 400 });

    if (typeof body.rawText === 'string' && body.rawText.trim()) {
      const parsed = parseItemsFromRawText(body.rawText);
      if (parsed.length === 0) {
        return NextResponse.json({ error: 'No se detectaron ítems válidos en el texto.' }, { status: 400 });
      }

      let subchapterId = String(body.subchapterId ?? '').trim();
      if (!subchapterId) {
        const def = await ensureDefaultBudgetHierarchy(prisma, projectId);
        subchapterId = def.subchapterId;
      } else {
        const ok = await assertSubchapterBelongsToProject(prisma, projectId, subchapterId);
        if (!ok) return NextResponse.json({ error: 'Subcapítulo no válido para esta obra' }, { status: 400 });
      }

      try {
        await prisma.$transaction(
          parsed.map((it, idx) =>
            prisma.itemCatalog.upsert({
              where: { projectId_codigo: { projectId, codigo: it.codigo } },
              create: {
                projectId,
                subchapterId,
                codigo: it.codigo,
                descripcion: it.descripcion,
                unidad: it.unidad,
                precioUnitario: it.precioUnitario,
                cantidad: it.cantidad,
                largo: it.largo,
                ancho: it.ancho,
                altura: it.altura,
                imagenUrl: it.imagenUrl,
                orden: idx,
                isActive: true,
              } as any,
              update: {
                subchapterId,
                descripcion: it.descripcion,
                unidad: it.unidad,
                precioUnitario: it.precioUnitario,
                cantidad: it.cantidad,
                largo: it.largo,
                ancho: it.ancho,
                altura: it.altura,
                imagenUrl: it.imagenUrl,
                isActive: true,
              } as any,
            }),
          ),
        );
      } catch (e) {
        if (!isUnknownItemDetailArgError(e)) throw e;
        await prisma.$transaction(
          parsed.map((it, idx) =>
            prisma.itemCatalog.upsert({
              where: { projectId_codigo: { projectId, codigo: it.codigo } },
              create: {
                projectId,
                subchapterId,
                codigo: it.codigo,
                descripcion: it.descripcion,
                unidad: it.unidad,
                precioUnitario: it.precioUnitario,
                orden: idx,
                isActive: true,
              },
              update: {
                subchapterId,
                descripcion: it.descripcion,
                unidad: it.unidad,
                precioUnitario: it.precioUnitario,
                isActive: true,
              },
            }),
          ),
        );
      }

      return NextResponse.json({ ok: true, imported: parsed.length }, { status: 201 });
    }

    const codigo = String(body.codigo ?? '').trim();
    const descripcion = String(body.descripcion ?? '').trim();
    const unidad = body.unidad != null ? String(body.unidad).trim() : '';
    const rawPrecio = body.precioUnitario as unknown;
    const precioUnitario = rawPrecio == null || rawPrecio === '' ? null : Number(rawPrecio);
    const rawCantidad = body.cantidad as unknown;
    const cantidad = rawCantidad == null || rawCantidad === '' ? null : Number(rawCantidad);
    const rawLargo = body.largo as unknown;
    const largo = rawLargo == null || rawLargo === '' ? null : Number(rawLargo);
    const rawAncho = body.ancho as unknown;
    const ancho = rawAncho == null || rawAncho === '' ? null : Number(rawAncho);
    const rawAltura = body.altura as unknown;
    const altura = rawAltura == null || rawAltura === '' ? null : Number(rawAltura);
    const imagenUrl = body.imagenUrl != null ? String(body.imagenUrl).trim() : '';
    const imagenLatitud =
      typeof body.imagenLatitud === 'number' && Number.isFinite(body.imagenLatitud) ? body.imagenLatitud : null;
    const imagenLongitud =
      typeof body.imagenLongitud === 'number' && Number.isFinite(body.imagenLongitud) ? body.imagenLongitud : null;
    const imagenPrecision =
      typeof body.imagenPrecision === 'number' && Number.isFinite(body.imagenPrecision) ? body.imagenPrecision : null;
    const imagenGeoEstado = body.imagenGeoEstado ? String(body.imagenGeoEstado).trim() : null;
    const imagenTomadaEn = body.imagenTomadaEn ? new Date(body.imagenTomadaEn) : null;
    const proveedorId = body.proveedorId != null ? String(body.proveedorId).trim() : '';

    if (!codigo) return NextResponse.json({ error: 'El código es requerido' }, { status: 400 });
    if (!descripcion) return NextResponse.json({ error: 'La descripción es requerida' }, { status: 400 });
    if (precioUnitario != null && !Number.isFinite(precioUnitario)) {
      return NextResponse.json({ error: 'Precio unitario inválido' }, { status: 400 });
    }
    if (cantidad != null && !Number.isFinite(cantidad)) {
      return NextResponse.json({ error: 'Cantidad inválida' }, { status: 400 });
    }
    if (largo != null && !Number.isFinite(largo)) return NextResponse.json({ error: 'Largo inválido' }, { status: 400 });
    if (ancho != null && !Number.isFinite(ancho)) return NextResponse.json({ error: 'Ancho inválido' }, { status: 400 });
    if (altura != null && !Number.isFinite(altura)) return NextResponse.json({ error: 'Altura inválida' }, { status: 400 });
    if (proveedorId) {
      const proveedor = await prisma.proveedorCatalog.findFirst({
        where: { id: proveedorId, projectId, isActive: true },
        select: { id: true },
      });
      if (!proveedor) return NextResponse.json({ error: 'Proveedor no válido para esta obra' }, { status: 400 });
    }

    let subchapterId = String(body.subchapterId ?? '').trim();
    if (!subchapterId) {
      const def = await ensureDefaultBudgetHierarchy(prisma, projectId);
      subchapterId = def.subchapterId;
    } else {
      const ok = await assertSubchapterBelongsToProject(prisma, projectId, subchapterId);
      if (!ok) return NextResponse.json({ error: 'Subcapítulo no válido para esta obra' }, { status: 400 });
    }

    try {
      const maxRow = await prisma.itemCatalog.aggregate({
        where: { projectId },
        _max: { orden: true },
      });
      const nextOrden = (maxRow._max.orden ?? -1) + 1;
      let item: any;
      try {
        item = await prisma.itemCatalog.create({
          data: {
            projectId,
            subchapterId,
            codigo,
            descripcion,
            unidad: unidad || null,
            precioUnitario,
            cantidad,
            largo,
            ancho,
            altura,
            imagenUrl: imagenUrl || null,
            imagenLatitud,
            imagenLongitud,
            imagenPrecision,
            imagenGeoEstado,
            imagenTomadaEn,
            proveedorId: proveedorId || null,
            orden: nextOrden,
            isActive: true,
          } as any,
        });
      } catch (e) {
        if (!isUnknownItemDetailArgError(e)) throw e;
        item = await prisma.itemCatalog.create({
          data: {
            projectId,
            subchapterId,
            codigo,
            descripcion,
            unidad: unidad || null,
            precioUnitario,
            proveedorId: proveedorId || null,
            orden: nextOrden,
            isActive: true,
          },
        });
      }
      return NextResponse.json({ item }, { status: 201 });
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
    return NextResponse.json({ error: 'Error al crear/importar ítems' }, { status: 500 });
  }
}
