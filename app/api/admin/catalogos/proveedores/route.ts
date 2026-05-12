import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../src/lib/prisma';

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

function normalizeTipoPersona(raw: unknown): string {
  const value = String(raw ?? '').trim();
  return PERSONA_TYPES.has(value) ? value : 'Natural';
}

export async function GET(req: NextRequest) {
  try {
    const a = auth(req);
    if (a) return NextResponse.json({ error: a.error }, { status: a.status });

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
    const items = await prisma.proveedorCatalog.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: [{ nombreRazonSocial: 'asc' }, { nitDocumento: 'asc' }],
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al listar proveedores' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const a = auth(req);
    if (a) return NextResponse.json({ error: a.error }, { status: a.status });

    const body = (await req.json()) as Record<string, unknown>;
    const projectId = String(body.projectId ?? '').trim();
    const nombreRazonSocial = String(body.nombreRazonSocial ?? '').trim();
    const nitDocumento = String(body.nitDocumento ?? '').trim();

    if (!projectId) return NextResponse.json({ error: 'La obra (projectId) es requerida' }, { status: 400 });
    if (!nombreRazonSocial) return NextResponse.json({ error: 'La razón social o nombre es requerido' }, { status: 400 });
    if (!nitDocumento) return NextResponse.json({ error: 'El NIT o documento es requerido' }, { status: 400 });

    const project = await prisma.project.findFirst({ where: { id: projectId, isActive: true }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 400 });

    try {
      const item = await prisma.proveedorCatalog.create({
        data: {
          projectId,
          tipoPersona: normalizeTipoPersona(body.tipoPersona),
          nombreRazonSocial,
          nombreComercial: clean(body.nombreComercial),
          nitDocumento,
          dv: clean(body.dv),
          email: clean(body.email),
          telefono: clean(body.telefono),
          celular: clean(body.celular),
          direccion: clean(body.direccion),
          pais: clean(body.pais),
          departamento: clean(body.departamento),
          ciudad: clean(body.ciudad),
          codigoPostal: clean(body.codigoPostal),
          isActive: body.isActive === undefined ? true : Boolean(body.isActive),
        },
      });
      return NextResponse.json({ item }, { status: 201 });
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
    return NextResponse.json({ error: 'Error al crear proveedor' }, { status: 500 });
  }
}
