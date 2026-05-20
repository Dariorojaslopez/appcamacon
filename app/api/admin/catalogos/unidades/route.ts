import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../src/lib/prisma';
import {
  baseCodigoFromUnidadNombre,
  isValidUnidadCodigo,
  parseUnidadTipoCalculo,
  uniqueUnidadCodigo,
} from '../../../../../src/lib/unidadCatalog';

export async function GET(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const items = await prisma.unidadCatalog.findMany({
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        codigo: true,
        nombre: true,
        simbolo: true,
        tipoCalculo: true,
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
    return NextResponse.json({ error: 'Error al listar unidades' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const payload = verifyAccessToken(authCookie);
    if (payload.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    const body = (await req.json()) as {
      nombre?: string;
      codigo?: string;
      simbolo?: string;
      tipoCalculo?: string;
      orden?: number;
    };

    const nombre = (body.nombre ?? '').trim();
    if (!nombre) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });

    const tipoCalculo = parseUnidadTipoCalculo(body.tipoCalculo ?? 'manual');
    if (!tipoCalculo) {
      return NextResponse.json(
        { error: 'Tipo de cálculo inválido. Use: m3, m2, length, manual o none.' },
        { status: 400 },
      );
    }

    let codigo = (body.codigo ?? '').trim().toLowerCase();
    if (!codigo) {
      codigo = await uniqueUnidadCodigo(prisma, baseCodigoFromUnidadNombre(nombre));
    } else {
      if (!isValidUnidadCodigo(codigo)) {
        return NextResponse.json(
          { error: 'Código inválido: use solo letras minúsculas, números y guión bajo (1–32 caracteres).' },
          { status: 400 },
        );
      }
      const taken = await prisma.unidadCatalog.findFirst({ where: { codigo }, select: { id: true } });
      if (taken) return NextResponse.json({ error: 'Ese código ya existe' }, { status: 400 });
    }

    const simbolo = body.simbolo != null ? String(body.simbolo).trim() : '';

    const item = await prisma.unidadCatalog.create({
      data: {
        codigo,
        nombre,
        simbolo: simbolo || null,
        tipoCalculo,
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
    return NextResponse.json({ error: 'Error al crear unidad' }, { status: 500 });
  }
}
