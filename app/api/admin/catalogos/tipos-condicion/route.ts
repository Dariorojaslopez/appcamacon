import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../src/lib/prisma';

const CODIGO_RE = /^[A-Z0-9_]{1,48}$/;

function baseCodigoFromNombre(nombre: string): string {
  const s = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return s || 'TIPO';
}

async function uniqueCodigo(base: string): Promise<string> {
  let c = base.slice(0, 48);
  let n = 0;
  for (;;) {
    const exists = await prisma.tipoCondicionCatalog.findFirst({ where: { codigo: c }, select: { id: true } });
    if (!exists) return c;
    n += 1;
    const suf = `_${n}`;
    c = (base.slice(0, Math.max(1, 48 - suf.length)) + suf).slice(0, 48);
  }
}

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const items = await prisma.tipoCondicionCatalog.findMany({
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        codigo: true,
        nombre: true,
        orden: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ items });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al listar tipos de condición' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const body = (await req.json()) as { nombre?: string; codigo?: string; orden?: number };
    const nombre = (body.nombre ?? '').trim();
    if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });

    let codigo = (body.codigo ?? '').trim().toUpperCase();
    if (!codigo) {
      codigo = await uniqueCodigo(baseCodigoFromNombre(nombre));
    } else {
      if (!CODIGO_RE.test(codigo)) {
        return NextResponse.json(
          { error: 'Código inválido: use solo letras mayúsculas, números y guión bajo (1–48 caracteres).' },
          { status: 400 },
        );
      }
      const taken = await prisma.tipoCondicionCatalog.findFirst({ where: { codigo }, select: { id: true } });
      if (taken) return NextResponse.json({ error: 'Ese código ya existe' }, { status: 400 });
    }

    const item = await prisma.tipoCondicionCatalog.create({
      data: {
        codigo,
        nombre,
        orden: Number.isFinite(body.orden) ? Number(body.orden) : 0,
        isActive: true,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al crear tipo de condición' }, { status: 500 });
  }
}
